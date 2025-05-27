import { NextRequest, NextResponse } from "next/server";
import prisma from "@/server/db/db";
import crypto from "crypto";

// Slack slash command payload interface
interface SlackCommand {
  token: string;
  team_id: string;
  team_domain: string;
  channel_id: string;
  channel_name: string;
  user_id: string;
  user_name: string;
  command: string;
  text: string;
  response_url: string;
  trigger_id: string;
}

// Verify Slack request signature
function verifySlackRequest(body: string, timestamp: string, signature: string): boolean {
  const slackSigningSecret = process.env.SLACK_SIGNING_SECRET;
  if (!slackSigningSecret) {
    console.error("SLACK_SIGNING_SECRET not configured");
    return false;
  }

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

// Get user stats aggregated for Slack display
async function getUserStats(userId: string) {
  // Get basic user info
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      email: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) return null;

  // Get friend count
  const friendCount = await prisma.friend.count({
    where: {
      OR: [{ user1Id: userId }, { user2Id: userId }],
    },
  });

  // Get total games played
  const totalGames = await prisma.game.count({
    where: {
      players: {
        some: { userId },
      },
    },
  });

  // Get recent games (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const recentGames = await prisma.game.count({
    where: {
      players: {
        some: { userId },
      },
      createdAt: {
        gte: thirtyDaysAgo,
      },
    },
  });

  // Get batting average
  const totalRounds = await prisma.score.count({
    where: { userId },
  });

  const roundsWon = await prisma.score.count({
    where: {
      userId,
      blitzPileRemaining: 0,
    },
  });

  const battingAverage = totalRounds > 0 ? (roundsWon / totalRounds).toFixed(3) : "0.000";

  // Get cumulative score
  const scoreAgg = await prisma.score.aggregate({
    where: { userId },
    _sum: {
      totalCardsPlayed: true,
      blitzPileRemaining: true,
    },
  });

  const cumulativeScore = scoreAgg._sum.totalCardsPlayed && scoreAgg._sum.blitzPileRemaining
    ? scoreAgg._sum.totalCardsPlayed - (scoreAgg._sum.blitzPileRemaining * 2)
    : 0;

  // Get last activity date
  const lastGame = await prisma.game.findFirst({
    where: {
      players: {
        some: { userId },
      },
    },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });

  return {
    user,
    friendCount,
    totalGames,
    recentGames,
    totalRounds,
    roundsWon,
    battingAverage,
    cumulativeScore,
    lastActivity: lastGame?.createdAt,
  };
}

// Format stats for Slack display
function formatSlackResponse(stats: any) {
  const { user, friendCount, totalGames, recentGames, totalRounds, roundsWon, battingAverage, cumulativeScore, lastActivity } = stats;
  
  const memberSince = user.createdAt.toLocaleDateString();
  const lastSeen = lastActivity ? lastActivity.toLocaleDateString() : "Never";
  
  return {
    response_type: "in_channel",
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
            text: `*Email:*\n${user.email}`,
          },
          {
            type: "mrkdwn",
            text: `*Member Since:*\n${memberSince}`,
          },
          {
            type: "mrkdwn",
            text: `*Friends:*\n${friendCount}`,
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
    const command: SlackCommand = {
      token: formData.get("token") || "",
      team_id: formData.get("team_id") || "",
      team_domain: formData.get("team_domain") || "",
      channel_id: formData.get("channel_id") || "",
      channel_name: formData.get("channel_name") || "",
      user_id: formData.get("user_id") || "",
      user_name: formData.get("user_name") || "",
      command: formData.get("command") || "",
      text: formData.get("text") || "",
      response_url: formData.get("response_url") || "",
      trigger_id: formData.get("trigger_id") || "",
    };

    const userIdentifier = command.text.trim();

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
        errorResponse(`User not found: ${userIdentifier}`),
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