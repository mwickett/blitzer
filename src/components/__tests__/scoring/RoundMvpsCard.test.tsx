import { render, screen } from "@testing-library/react";
import {
  RoundMvpsCard,
  computeRoundMvps,
} from "../../scoring/graphs/RoundMvpsCard";
import { type PlayerWithScore } from "../../scoring/types";

const player = (id: string, name: string): PlayerWithScore => ({
  id,
  name,
  color: "#356f9f",
  isGuest: false,
  userId: id,
  score: 0,
});

const players = [player("a", "Alice"), player("b", "Bob"), player("c", "Cara")];

describe("computeRoundMvps", () => {
  it("credits the top scorer each round and shares ties", () => {
    const result = computeRoundMvps(players, {
      a: [12, -4, 8],
      b: [5, 10, 8],
      c: [-2, 3, 1],
    });
    expect(result.mvpsByRound).toEqual([["a"], ["b"], ["a", "b"]]);
    expect(result.winsByPlayer).toEqual({ a: 2, b: 2, c: 0 });
  });

  it("picks the least-bad score when everyone goes negative", () => {
    const result = computeRoundMvps(players, {
      a: [-6],
      b: [-2],
      c: [-10],
    });
    expect(result.mvpsByRound).toEqual([["b"]]);
  });

  it("handles a game with no rounds", () => {
    expect(computeRoundMvps(players, { a: [], b: [], c: [] })).toEqual({
      mvpsByRound: [],
      winsByPlayer: { a: 0, b: 0, c: 0 },
    });
  });
});

describe("RoundMvpsCard", () => {
  it("labels each round's MVP and lists round winners", () => {
    render(
      <RoundMvpsCard
        players={players}
        deltasByRound={{ a: [12, -4, 9], b: [5, 10, 8], c: [-2, 3, 1] }}
      />,
    );
    expect(screen.getByLabelText("Round 1: Alice")).toBeInTheDocument();
    expect(screen.getByLabelText("Round 2: Bob")).toBeInTheDocument();
    expect(screen.getByText("2 rounds")).toBeInTheDocument();
    expect(screen.getByText("1 round")).toBeInTheDocument();
    expect(screen.queryByText("Cara")).not.toBeInTheDocument();
  });
});
