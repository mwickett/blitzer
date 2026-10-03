import { act, render, screen, within } from "@testing-library/react";
import { RaceTrack } from "../../scoring/RaceTrack";
import { Standings } from "../../scoring/Standings";
import { CelebrationOverlay } from "../../scoring/CelebrationOverlay";
import type { PlayerWithScore } from "../../scoring/types";

const player = (id: string, name: string, score: number, color = "#123456"): PlayerWithScore => ({
  id,
  name,
  score,
  color,
  isGuest: false,
});

describe("RaceTrack", () => {
  it("labels the track from its lowest bound to the win threshold", () => {
    render(<RaceTrack players={[player("a", "Ana", -20), player("b", "Ben", 30)]} winThreshold={75} />);
    // The lower bound sits 5 below the lowest score
    expect(screen.getByText("-25")).toBeInTheDocument();
    expect(screen.getByText("75 to win")).toBeInTheDocument();
  });

  it("merges close scores into one pill and keeps distant ones apart", () => {
    const { container } = render(
      <RaceTrack players={[player("a", "Ana", 10), player("b", "Ben", 12), player("c", "Cy", 60)]} />,
    );
    const pills = container.querySelectorAll(".absolute.top-1\\/2");
    expect(pills).toHaveLength(2);
    expect(within(pills[0] as HTMLElement).getByText("10")).toBeInTheDocument();
    expect(within(pills[0] as HTMLElement).getByText("12")).toBeInTheDocument();
    expect(within(pills[1] as HTMLElement).getByText("60")).toBeInTheDocument();
  });

  it("orders the legend by score and marks negative scores in red", () => {
    render(<RaceTrack players={[player("a", "Ana", 40), player("b", "Ben", -3), player("c", "Cy", 15)]} />);
    const names = ["Ben", "Cy", "Ana"].map((name) => screen.getByText(name));
    expect(names[0].compareDocumentPosition(names[1]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(names[1].compareDocumentPosition(names[2]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(names[0]).toHaveStyle({ color: "#b91c1c" });
    expect(names[2]).toHaveStyle({ color: "#123456" });
  });
});

describe("Standings", () => {
  it("sorts by score, shares ranks on ties, and shows the distance to win", () => {
    render(
      <Standings
        winThreshold={75}
        players={[player("a", "Ana", 20), player("b", "Ben", 50), player("c", "Cy", 20), player("d", "Dee", -4)]}
      />,
    );
    const rows = screen.getAllByText(/away$/).map((away) => away.closest(".flex.items-center.justify-between") as HTMLElement);
    const summary = rows.map((row) => row.textContent);
    expect(summary).toEqual(["1Ben5025 away", "2Ana2055 away", "2Cy2055 away", "4Dee-479 away"]);
  });
});

describe("CelebrationOverlay", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("announces the winner, then hides and reports completion", () => {
    const onComplete = jest.fn();
    render(<CelebrationOverlay winnerName="Ana" winnerScore={78} winnerColor="#ff0000" onComplete={onComplete} />);
    expect(screen.getByText("Ana")).toBeInTheDocument();
    expect(screen.getByText("78")).toBeInTheDocument();

    act(() => jest.advanceTimersByTime(2499));
    expect(onComplete).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(1));
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("wins the game!")).not.toBeInTheDocument();
  });

  it("does not report completion after it is unmounted early", () => {
    const onComplete = jest.fn();
    const { unmount } = render(
      <CelebrationOverlay winnerName="Ana" winnerScore={78} winnerColor="#ff0000" onComplete={onComplete} />,
    );
    unmount();
    act(() => jest.advanceTimersByTime(5000));
    expect(onComplete).not.toHaveBeenCalled();
  });
});
