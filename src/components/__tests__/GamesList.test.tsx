import { render, screen, within } from "@testing-library/react";
import GameList from "../GamesList";
import {
  gameListHref,
  parseGameListFilters,
  type GameListPage,
} from "@/lib/gameList";

jest.mock("next/form", () => ({
  __esModule: true,
  default: ({ children, ...props }: React.ComponentProps<"form">) => (
    <form {...props}>{children}</form>
  ),
}));

const player = {
  key: "user:11111111-1111-4111-8111-111111111111",
  name: "Player One",
};
const page: GameListPage = {
  games: [
    {
      id: "game-1",
      kind: "PICKUP",
      status: "active",
      startedAt: "2026-01-02T12:00:00Z",
      roundCount: 5,
      players: [player],
      winnerName: null,
    },
  ],
  filters: {
    status: "active",
    players: [player.key],
    search: "Player",
    cursor: "previous",
  },
  totalMatches: 30,
  nextCursor: "next",
  playerOptions: [player],
  hasMorePlayerOptions: false,
  legacyCount: 0,
};

it("renders each game once, with the actual start date and filter-preserving pagination", () => {
  render(<GameList page={page} />);
  const list = screen.getByRole("list", { name: "Games" });
  expect(within(list).getAllByRole("listitem")).toHaveLength(1);
  expect(within(list).getAllByRole("link")).toHaveLength(1);
  expect(within(list).getByText("Jan 2, 2026")).toBeInTheDocument();
  expect(within(list).queryByText("Jan 1, 2026")).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Next page" })).toHaveAttribute(
    "href",
    gameListHref("/games", page.filters, "next"),
  );
  expect(screen.getByRole("link", { name: "First page" })).toHaveAttribute(
    "href",
    gameListHref("/games", page.filters),
  );
});

it("submits status and every selected player while clearing the old cursor", () => {
  const { container } = render(<GameList page={page} />);
  expect(screen.getByRole("combobox", { name: "Game status" })).toHaveValue(
    "active",
  );
  expect(screen.getByRole("checkbox", { name: "Player One" })).toBeChecked();
  const data = new FormData(container.querySelector("form")!);
  expect(data.getAll("player")).toEqual([player.key]);
  expect(data.get("status")).toBe("active");
  expect(data.has("cursor")).toBe(false);
});

it("shows unstarted and expired lobbies explicitly", () => {
  render(
    <GameList
      page={{
        ...page,
        games: [{ ...page.games[0], startedAt: null, status: "expired" }],
      }}
    />,
  );
  const list = screen.getByRole("list", { name: "Games" });
  expect(within(list).getByText("Not started")).toBeInTheDocument();
  expect(within(list).getByText("Expired lobby")).toBeInTheDocument();
});

it("retains an over-cap selection as invalid instead of broadening to the first eight players", () => {
  const players = Array.from(
    { length: 9 },
    (_, i) => `user:11111111-1111-4111-8111-${String(i).padStart(12, "0")}`,
  );
  expect(parseGameListFilters({ player: players }).players).toHaveLength(9);
});
