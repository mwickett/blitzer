import { render, screen } from "@testing-library/react";
import {
  RoundMvpsCard,
  computeRoundMvps,
} from "../../scoring/graphs/RoundMvpsCard";
import { BlitzPileCard } from "../../scoring/graphs/BlitzPileCard";
import { GameHighlights } from "../../scoring/GameHighlights";
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

describe("BlitzPileCard", () => {
  it("marks blitzes, heavy piles, and missing scores", () => {
    render(
      <BlitzPileCard
        players={players}
        blitzByRound={{ a: [0, 3], b: [8, 0], c: [2, null] }}
      />,
    );
    expect(screen.getByLabelText("Alice, round 1: blitzed")).toHaveTextContent(
      "⚡",
    );
    expect(screen.getByLabelText("Bob, round 1: 8 left")).toHaveTextContent(
      "8",
    );
    expect(
      screen.getByLabelText("Cara, round 2: no score"),
    ).toBeInTheDocument();
    expect(screen.getByText(/Blitzes:/)).toHaveTextContent(
      "Blitzes: Alice 1, Bob 1",
    );
  });
});

describe("GameHighlights", () => {
  it("renders readable highlight copy", () => {
    render(
      <GameHighlights
        players={players}
        highlights={[
          { kind: "comeback", playerId: "a", deficit: 22, roundNumber: 2 },
          { kind: "photo_finish", playerId: "a", margin: 0 },
        ]}
      />,
    );
    expect(
      screen.getByText("Alice was 22 points back after round 2 and still won."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Level on points; decided on the tiebreak."),
    ).toBeInTheDocument();
  });

  it("renders nothing when the game had no highlights", () => {
    const { container } = render(
      <GameHighlights players={players} highlights={[]} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
