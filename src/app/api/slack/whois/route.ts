import { NextRequest, NextResponse } from "next/server";
import prisma from "@/server/db/db";
import crypto from "crypto";
import { getPlayerBattingAverageForUser, getCumulativeScoreForUser } from "@/server/queries/stats";

// Verify Slack request signature
function verifySlackRequest(body: string, timestamp: string, signature: string): boolean {
  const slackSigningSecret = process.env.SLACK_SIGNING_SECRET;
  if (!slackSigningSecret) {
    console.error("SLACK_SIGNING_SECRET not configured");
    return false;
  }

  // Slack's signature covers the timestamp, but authentic old requests can
  // still be replayed unless freshness is checked independently.
  if (!/^\d{1,12}$/.test(timestamp) ||
      Math.abs(Date.now() / 1000 - Number(timestamp)) > 300 ||
      !/^v0=[a-f0-9]{64}$/.test(signature)) return false;

  const baseString = `v0:${timestamp}:${body}`;
  const expectedSignature = `v0=${crypto
    .createHmac("sha256", slackSigningSecret)
    .update(baseString)
    .digest("hex")}`;

  // Ensure both buffers have the same length for timingSafeEqual
  if (signature.length !== expectedSignature.length) {
    return false;
  }

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

async function getUserStats(userId: string) {
  const participation = { players: { some: { userId } }, startedAt: { not: null } };
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [user, totalGames, recentGames, batting, cumulativeScore, lastGame] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId }, select: { username: true, createdAt: true },
    }),
    prisma.game.count({ where: participation }),
    prisma.game.count({ where: { ...participation, startedAt: { gte: thirtyDaysAgo } } }),
    getPlayerBattingAverageForUser(userId),
    getCumulativeScoreForUser(userId),
    prisma.game.findFirst({
      where: participation, orderBy: { startedAt: "desc" }, select: { startedAt: true },
    }),
  ]);
  if (!user) return null;
  return {
    user, totalGames, recentGames, cumulativeScore,
    totalRounds: batting.totalHandsPlayed,
    roundsWon: batting.totalHandsWon,
    battingAverage: batting.battingAverage,
    lastActivity: lastGame?.startedAt ?? undefined,
  };
}

interface SlackUserStats {
  user: { createdAt: Date; username: string };
  totalGames: number;
  recentGames: number;
  totalRounds: number;
  roundsWon: number;
  battingAverage: string;
  cumulativeScore: number;
  lastActivity: Date | undefined;
}

// Format stats for Slack display
function formatSlackResponse(stats: SlackUserStats) {
  const { user, totalGames, recentGames, totalRounds, roundsWon, battingAverage, cumulativeScore, lastActivity } = stats;
  
  const memberSince = user.createdAt.toLocaleDateString();
  const lastSeen = lastActivity ? lastActivity.toLocaleDateString() : "Never";
  
  return {
    response_type: "ephemeral",
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: `🎯 User Report: ${user.username}`,
        },
      },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*Member Since:*\n${memberSince}`,
          },
          {
            type: "mrkdwn",
            text: `*Last Activity:*\n${lastSeen}`,
          },
        ],
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "*🎮 Gaming Stats*",
        },
      },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*Total Games:*\n${totalGames}`,
          },
          {
            type: "mrkdwn",
            text: `*Recent Games (30d):*\n${recentGames}`,
          },
          {
            type: "mrkdwn",
            text: `*Total Rounds:*\n${totalRounds}`,
          },
          {
            type: "mrkdwn",
            text: `*Rounds Won:*\n${roundsWon}`,
          },
        ],
      },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*Batting Average:*\n${battingAverage}`,
          },
          {
            type: "mrkdwn",
            text: `*Cumulative Score:*\n${cumulativeScore}`,
          },
        ],
      },
    ],
  };
}

// Error response for Slack
function errorResponse(message: string) {
  return {
    response_type: "ephemeral",
    text: `❌ ${message}`,
  };
}

export async function POST(request: NextRequest) {
  try {
    // Verify this is a valid Slack request
    const body = await request.text();
    const timestamp = request.headers.get("x-slack-request-timestamp");
    const signature = request.headers.get("x-slack-signature");

    if (!timestamp || !signature) {
      return NextResponse.json(errorResponse("Invalid request headers"), { status: 400 });
    }

    // Verify signature
    if (!verifySlackRequest(body, timestamp, signature)) {
      return NextResponse.json(errorResponse("Invalid request signature"), { status: 401 });
    }

    // Parse the form data
    const formData = new URLSearchParams(body);
    const allowedTeam = process.env.SLACK_WHOIS_TEAM_ID?.trim();
    const allowedUsers = new Set((process.env.SLACK_WHOIS_USER_IDS ?? "")
      .split(",").map((id) => id.trim()).filter(Boolean));
    if (!allowedTeam || formData.get("team_id") !== allowedTeam ||
        !allowedUsers.has(formData.get("user_id") ?? "")) {
      return NextResponse.json(errorResponse("You are not authorized to use this command"), { status: 403 });
    }
    const userIdentifier = (formData.get("text") ?? "").trim();
    if (userIdentifier.length > 254) {
      return NextResponse.json(errorResponse("Username or email is too long"), { status: 400 });
    }

    if (!userIdentifier) {
      return NextResponse.json(
        errorResponse("Please provide a username or email address. Usage: `/whois alice@example.com` or `/whois username`"),
        { status: 200 }
      );
    }

    // Look up user by email or username
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: { equals: userIdentifier, mode: "insensitive" } },
          { username: { equals: userIdentifier, mode: "insensitive" } },
        ],
      },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json(
        errorResponse("User not found"),
        { status: 200 }
      );
    }

    // Get comprehensive user stats
    const stats = await getUserStats(user.id);

    if (!stats) {
      return NextResponse.json(
        errorResponse("Error retrieving user stats"),
        { status: 200 }
      );
    }

    // Format and return the response
    return NextResponse.json(formatSlackResponse(stats), { status: 200 });

  } catch (error) {
    console.error("Slack whois error:", error);
    return NextResponse.json(
      errorResponse("Internal server error"),
      { status: 500 }
    );
  }
}