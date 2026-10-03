import { render, screen } from "@testing-library/react";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import InsightsPage from "../page";
import { isLlmFeaturesEnabled } from "@/featureFlags";
import { getPlayerHighlightsForClerkUser } from "@/server/queries/playerHighlights";

jest.mock("server-only", () => ({}));
jest.mock("@clerk/nextjs/server", () => ({ auth: { protect: jest.fn() } }));
jest.mock("next/navigation", () => ({
  redirect: jest.fn((path: string) => {
    throw new Error(`REDIRECT ${path}`);
  }),
}));
jest.mock("@/featureFlags", () => ({ isLlmFeaturesEnabled: jest.fn() }));
jest.mock("@/server/queries/playerHighlights", () => ({
  getPlayerHighlightsForClerkUser: jest.fn(),
}));
jest.mock("@/components/insights/PlayerHighlights", () => ({
  __esModule: true,
  default: () => <div>player highlights</div>,
}));
jest.mock("../ModernChatUI", () => ({
  __esModule: true,
  default: () => <div>chat</div>,
}));

const mockProtect = auth.protect as unknown as jest.Mock;
const mockFlag = isLlmFeaturesEnabled as jest.Mock;
const mockHighlights = getPlayerHighlightsForClerkUser as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockProtect.mockResolvedValue({ userId: "user_1", orgId: "org_1" });
});

describe("InsightsPage", () => {
  it("leaves signed-out visitors to Clerk's sign-in redirect", async () => {
    mockProtect.mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(InsightsPage()).rejects.toThrow("NEXT_REDIRECT");
    expect(mockHighlights).not.toHaveBeenCalled();
  });

  it("sends signed-in players without a Circle to setup", async () => {
    mockProtect.mockResolvedValue({ userId: "user_1", orgId: null });
    await expect(InsightsPage()).rejects.toThrow("REDIRECT /circles/setup");
    expect(redirect).toHaveBeenCalledWith("/circles/setup");
    expect(mockHighlights).not.toHaveBeenCalled();
  });

  it("shows highlights and chat when the llm-features flag is on", async () => {
    mockFlag.mockResolvedValue(true);
    mockHighlights.mockResolvedValue({ recentGames: [] });
    render(await InsightsPage());

    expect(mockHighlights).toHaveBeenCalledWith("user_1");
    expect(screen.getByText("player highlights")).toBeInTheDocument();
    expect(screen.getByText("chat")).toBeInTheDocument();
  });

  it("shows the placeholder without querying highlights when the flag is off", async () => {
    mockFlag.mockResolvedValue(false);
    render(await InsightsPage());

    expect(mockHighlights).not.toHaveBeenCalled();
    expect(screen.getByText("Coming Soon")).toBeInTheDocument();
    expect(screen.queryByText("chat")).not.toBeInTheDocument();
  });
});
