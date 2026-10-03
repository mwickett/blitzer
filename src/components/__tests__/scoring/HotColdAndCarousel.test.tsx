import { fireEvent, render, screen, within } from "@testing-library/react";
import { HotColdCard } from "@/components/scoring/graphs/HotColdCard";
import { GraphCarousel } from "@/components/scoring/GraphCarousel";
import type { PlayerWithScore } from "@/components/scoring/types";

const player = (id: string, name: string): PlayerWithScore => ({
  id,
  name,
  color: "#356f9f",
  isGuest: false,
  userId: id,
  score: 0,
});

describe("HotColdCard", () => {
  const players = [player("ann", "Ann"), player("bo", "Bo")];

  function rowFor(name: string) {
    return screen.getByText(name).parentElement as HTMLElement;
  }

  it("labels one column per round and signs each delta", () => {
    render(
      <HotColdCard
        players={players}
        deltasByRound={{ ann: [4, 12, -3], bo: [0, 6, 8] }}
      />,
    );

    expect(screen.getByText("R1")).toBeInTheDocument();
    expect(screen.getByText("R3")).toBeInTheDocument();
    expect(screen.queryByText("R4")).toBeNull();
    const ann = within(rowFor("Ann"));
    expect(ann.getByText("+4")).toBeInTheDocument();
    expect(ann.getByText("-3")).toBeInTheDocument();
    expect(within(rowFor("Bo")).getByText("0")).toBeInTheDocument();
  });

  it("marks each player's best round, keeping the earliest on a tie", () => {
    render(
      <HotColdCard
        players={players}
        deltasByRound={{ ann: [4, 12, -3], bo: [8, 6, 8] }}
      />,
    );

    expect(within(rowFor("Ann")).getByText("+12")).toHaveTextContent("🔥");
    expect(within(rowFor("Bo")).getAllByText("+8")[0]).toHaveTextContent("🔥");
    expect(within(rowFor("Bo")).getAllByText("🔥")).toHaveLength(1);
  });

  it("awards no fire to a player who never scored above zero", () => {
    render(
      <HotColdCard
        players={players}
        deltasByRound={{ ann: [-2, 0], bo: [3, 1] }}
      />,
    );

    expect(within(rowFor("Ann")).queryByText("🔥")).toBeNull();
    expect(within(rowFor("Bo")).getByText("🔥")).toBeInTheDocument();
  });

  it("renders an empty grid before any round is played", () => {
    render(<HotColdCard players={players} deltasByRound={{}} />);
    expect(screen.queryByText("R1")).toBeNull();
    expect(screen.getByText("Ann")).toBeInTheDocument();
  });
});

describe("GraphCarousel", () => {
  const dots = (container: HTMLElement) =>
    Array.from(container.querySelectorAll(".rounded-full"));

  it("shows no page dots for a single card", () => {
    const { container } = render(
      <GraphCarousel>{[<p key="a">Only card</p>]}</GraphCarousel>,
    );
    expect(screen.getByText("Only card")).toBeInTheDocument();
    expect(dots(container)).toHaveLength(0);
  });

  it("moves the active dot as the cards are scrolled", () => {
    const { container } = render(
      <GraphCarousel>
        {[<p key="a">One</p>, <p key="b">Two</p>, <p key="c">Three</p>]}
      </GraphCarousel>,
    );
    const scroller = screen.getByText("One").parentElement!
      .parentElement as HTMLDivElement;
    Object.defineProperty(scroller.firstElementChild, "offsetWidth", {
      value: 288,
    });
    const active = () =>
      dots(container).findIndex((dot) => dot.className.includes("bg-[#290806]"));

    expect(dots(container)).toHaveLength(3);
    expect(active()).toBe(0);

    // One card is 288px wide plus a 12px gap
    scroller.scrollLeft = 300;
    fireEvent.scroll(scroller);
    expect(active()).toBe(1);

    // Overscrolling past the last card keeps the last dot active
    scroller.scrollLeft = 2_000;
    fireEvent.scroll(scroller);
    expect(active()).toBe(2);
  });
});
