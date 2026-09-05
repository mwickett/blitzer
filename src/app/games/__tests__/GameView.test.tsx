import { render, screen } from "@testing-library/react";
import GameView from "../[id]/page";
import { getGameById, getPredictionProfilesForGame } from "@/server/queries";

jest.mock("@/server/queries", () => ({
  getGameById: jest.fn(),
  getPredictionProfilesForGame: jest.fn().mockResolvedValue({}),
}));
jest.mock("@clerk/nextjs/server", () => ({
  auth: jest.fn().mockResolvedValue({ userId: "clerk-a", orgId: "circle" }),
}));
jest.mock("@/components/scoring/ScoringShell", () => ({
  ScoringShell: (props: {
    isFinished: boolean;
    canEdit: boolean;
    rounds: unknown[];
  }) => (
    <div
      data-testid="scoring"
      data-finished={props.isFinished}
      data-editable={props.canEdit}
      data-rounds={props.rounds.length}
    />
  ),
}));

it("keeps historical rounds editable when a legacy finalization flag disagrees with final totals", async () => {
  (getGameById as jest.Mock).mockResolvedValue({
    id: "game",
    kind: "CIRCLE",
    organizationId: "circle",
    isFinished: true,
    winnerId: "a",
    endedAt: new Date(),
    winThreshold: 50,
    players: ["a", "b"].map((id) => ({
      id,
      userId: id,
      user: { username: id, clerk_user_id: `clerk-${id}` },
    })),
    rounds: [30, 30, -20].map((points, index) => ({
      id: `r${index}`,
      round: index + 1,
      revision: 0,
      scores: [
        {
          userId: "a",
          totalCardsPlayed: Math.max(0, points),
          blitzPileRemaining: points < 0 ? 10 : 0,
        },
        { userId: "b", totalCardsPlayed: 4, blitzPileRemaining: 0 },
      ],
    })),
  });
  render(await GameView({ params: Promise.resolve({ id: "game" }) }));
  expect(screen.getByTestId("scoring")).toHaveAttribute(
    "data-finished",
    "false",
  );
  expect(screen.getByTestId("scoring")).toHaveAttribute(
    "data-editable",
    "true",
  );
  expect(screen.getByTestId("scoring")).toHaveAttribute("data-rounds", "3");
  expect(getPredictionProfilesForGame).toHaveBeenCalled();
});
