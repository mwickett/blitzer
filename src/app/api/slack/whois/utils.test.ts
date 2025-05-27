import crypto from "crypto";

// Extract the utility functions for testing
function verifySlackRequest(body: string, timestamp: string, signature: string, signingSecret: string): boolean {
  const baseString = `v0:${timestamp}:${body}`;
  const expectedSignature = `v0=${crypto
    .createHmac("sha256", signingSecret)
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

describe("Slack Integration Utils", () => {
  describe("verifySlackRequest", () => {
    it("verifies valid Slack signatures", () => {
      const signingSecret = "test_secret";
      const timestamp = "1234567890";
      const body = "token=test&text=hello";
      
      const baseString = `v0:${timestamp}:${body}`;
      const signature = `v0=${crypto
        .createHmac("sha256", signingSecret)
        .update(baseString)
        .digest("hex")}`;

      const result = verifySlackRequest(body, timestamp, signature, signingSecret);
      expect(result).toBe(true);
    });

    it("rejects invalid signatures", () => {
      const result = verifySlackRequest(
        "token=test&text=hello",
        "1234567890",
        "v0=invalid_signature",
        "test_secret"
      );
      expect(result).toBe(false);
    });
  });

  describe("formatSlackResponse", () => {
    it("formats user stats correctly", () => {
      const mockStats = {
        user: {
          username: "testuser",
          email: "test@example.com",
          createdAt: new Date("2024-01-01"),
        },
        friendCount: 5,
        totalGames: 10,
        recentGames: 3,
        totalRounds: 25,
        roundsWon: 8,
        battingAverage: "0.320",
        cumulativeScore: 125,
        lastActivity: new Date("2024-01-15"),
      };

      const result = formatSlackResponse(mockStats);
      
      expect(result.response_type).toBe("in_channel");
      expect(result.blocks).toBeDefined();
      expect(result.blocks[0].text.text).toContain("testuser");
      
      // Check that stats are included in the response
      const fieldsText = JSON.stringify(result.blocks);
      expect(fieldsText).toContain("test@example.com");
      expect(fieldsText).toContain("5"); // friend count
      expect(fieldsText).toContain("10"); // total games
      expect(fieldsText).toContain("3"); // recent games
      expect(fieldsText).toContain("0.320"); // batting average
    });

    it("handles null last activity", () => {
      const mockStats = {
        user: {
          username: "testuser",
          email: "test@example.com",
          createdAt: new Date("2024-01-01"),
        },
        friendCount: 0,
        totalGames: 0,
        recentGames: 0,
        totalRounds: 0,
        roundsWon: 0,
        battingAverage: "0.000",
        cumulativeScore: 0,
        lastActivity: null,
      };

      const result = formatSlackResponse(mockStats);
      const fieldsText = JSON.stringify(result.blocks);
      expect(fieldsText).toContain("Never");
    });
  });
});