import prisma from "../db/db";
import { saveStoryPrompt } from "../mutations/insights";
import { requireAuthContext } from "../mutations/common";
import { captureServerEvent } from "../telemetry";
import { isLlmFeaturesEnabled } from "@/featureFlags";

jest.mock("../mutations/common", () => ({ requireAuthContext: jest.fn() }));
jest.mock("../telemetry", () => ({ captureServerEvent: jest.fn() }));
jest.mock("@/featureFlags", () => ({ isLlmFeaturesEnabled: jest.fn() }));
jest.mock("../db/db", () => ({
  __esModule: true,
  default: { user: { update: jest.fn() } },
}));

describe("saveStoryPrompt", () => {
  const posthog = { captureImmediate: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    (requireAuthContext as jest.Mock).mockResolvedValue({ userId: "clerk-user", prismaUserId: "user-id", posthog });
    (isLlmFeaturesEnabled as jest.Mock).mockResolvedValue(true);
  });

  it("stores the trimmed style for the signed-in player without sending it to analytics", async () => {
    await expect(saveStoryPrompt("  Like a nature documentary  ")).resolves.toEqual({
      ok: true,
      storyPrompt: "Like a nature documentary",
    });
    expect(requireAuthContext).toHaveBeenCalledWith("prismaId");
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-id" },
      data: { storyPrompt: "Like a nature documentary" },
    });
    expect(captureServerEvent).toHaveBeenCalledWith(posthog, { distinctId: "clerk-user", event: "story_prompt_saved" });
  });

  it("clears the style when it is blank", async () => {
    await expect(saveStoryPrompt("   ")).resolves.toEqual({ ok: true, storyPrompt: null });
    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: "user-id" }, data: { storyPrompt: null } });
    expect(captureServerEvent).toHaveBeenCalledWith(posthog, expect.objectContaining({ event: "story_prompt_cleared" }));
  });

  it.each([undefined, 42, "x".repeat(281)])("rejects invalid input %#", async (input) => {
    expect((await saveStoryPrompt(input)).ok).toBe(false);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("refuses while llm-features is off", async () => {
    (isLlmFeaturesEnabled as jest.Mock).mockResolvedValue(false);
    expect((await saveStoryPrompt("Short and sweet")).ok).toBe(false);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
