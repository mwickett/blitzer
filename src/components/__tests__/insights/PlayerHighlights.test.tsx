import { render, screen } from "@testing-library/react";
import PlayerHighlights, { highlightMoments } from "@/components/insights/PlayerHighlights";
import { EMPTY_HIGHLIGHTS, type PlayerHighlights as Highlights } from "@/server/queries/playerHighlights";

jest.mock("@/server/db/db", () => ({ __esModule: true, default: {} }));

const game = (gameId: string, finalMargin: number, maxDeficit = 0) => ({
  gameId, finishedAt: new Date("2026-09-02T12:00:00Z"), finalMargin, maxDeficit, rounds: 3,
});

const highlights: Highlights = {
  ...EMPTY_HIGHLIGHTS,
  sampledGames: 4,
  recentResults: ["W", "W", "L"],
  currentStreak: { result: "W", length: 2 },
  longestWinStreak: 2,
  rivals: {
    mostPlayed: { name: "Aunt Carol", gamesPlayed: 3, wins: 1, losses: 2 },
    nemesis: { name: "Aunt Carol", gamesPlayed: 3, wins: 1, losses: 2 },
    favoriteOpponent: null,
  },
  biggestComeback: game("comeback", 4, 30),
  heartbreaker: game("close-loss", -1),
};

it("turns highlights into linked moment cards", () => {
  render(<PlayerHighlights highlights={highlights} />);
  expect(screen.getByText("2 wins in a row")).toBeInTheDocument();
  expect(screen.getByText("Best recent run: 2 wins")).toBeInTheDocument();
  expect(screen.getByText("Down 30, still won").closest("a")).toHaveAttribute("href", "/games/comeback");
  expect(screen.getByText("Lost by 1 point").closest("a")).toHaveAttribute("href", "/games/close-loss");
  expect(screen.getByText("Aunt Carol")).toBeInTheDocument();
  expect(screen.getByText("You 1, Aunt Carol 2 across 3 games")).toBeInTheDocument();
  expect(screen.getByLabelText("Recent results, newest first")).toHaveTextContent("WWL");
});

it("names tiebreak finishes instead of a zero-point margin", () => {
  const tied = { ...highlights, closestWin: game("tie-win", 0), heartbreaker: game("tie-loss", 0) };
  render(<PlayerHighlights highlights={tied} />);
  expect(screen.getByText("Won on a tiebreak")).toBeInTheDocument();
  expect(screen.getByText("Lost on a tiebreak")).toBeInTheDocument();
});

it("only falls back to the usual opponent without a nemesis or favorite", () => {
  expect(highlightMoments(highlights).map((moment) => moment.key)).not.toContain("rival");
  const friendly = { ...highlights, rivals: { ...highlights.rivals, nemesis: null } };
  expect(highlightMoments(friendly).map((moment) => moment.key)).toContain("rival");
});

it("invites a first game when there is no history", () => {
  render(<PlayerHighlights highlights={EMPTY_HIGHLIGHTS} />);
  expect(screen.getByText("Finish a game to start collecting highlights.")).toBeInTheDocument();
});
