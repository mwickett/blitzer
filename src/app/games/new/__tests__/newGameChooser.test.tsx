import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import NewGameChooser from "../newGameChooser";

const mockCreateGame = jest.fn();
const mockSaveDefault = jest.fn();
const mockSaveDeck = jest.fn();
const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
let mockStep: string | null = null;
let mockIsLoaded = true;

jest.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
  useSearchParams: () => ({ get: (key: string) => key === "step" ? mockStep : null }),
}));
jest.mock("@clerk/nextjs", () => ({
  useUser: () => ({ isLoaded: mockIsLoaded, user: mockIsLoaded ? { id: "clerk-alice" } : null }),
}));
jest.mock("@/server/mutations/games", () => ({
  createGame: (...args: unknown[]) => mockCreateGame(...args),
  saveUserAccentColor: (...args: unknown[]) => mockSaveDefault(...args),
  saveUserPreferredDeck: (...args: unknown[]) => mockSaveDeck(...args),
}));

const users = [{ id: "alice", clerk_user_id: "clerk-alice", username: "Alice", avatarUrl: null, accentColor: null, preferredDeck: "pump" }];

beforeEach(() => {
  jest.clearAllMocks();
  mockStep = null;
  mockIsLoaded = true;
  mockCreateGame.mockResolvedValue({ ok: true, gameId: "new-game" });
  mockSaveDefault.mockResolvedValue(undefined);
  mockSaveDeck.mockResolvedValue(undefined);
});

async function selectGuestAndColors() {
  const user = userEvent.setup();
  const view = render(<NewGameChooser users={users} />);
  await user.click(screen.getByRole("button", { name: "Add Player" }));
  await user.click(screen.getByRole("tab", { name: "Guest" }));
  await user.type(screen.getByPlaceholderText("Enter guest name"), "Bob");
  await user.click(screen.getByRole("button", { name: "Add" }));
  await user.click(screen.getByRole("button", { name: "50" }));
  await user.click(screen.getByRole("button", { name: "Next" }));
  expect(mockRouter.push).toHaveBeenCalledWith("/games/new?type=circle&step=colors");
  mockStep = "colors";
  view.rerender(<NewGameChooser users={users} />);
  return view;
}

it("waits for Clerk and sends an empty colors draft back to player selection", () => {
  mockStep = "colors";
  mockIsLoaded = false;
  const { rerender } = render(<NewGameChooser users={users} />);
  expect(screen.getByRole("status")).toHaveTextContent("Loading players");
  expect(mockRouter.replace).not.toHaveBeenCalled();
  mockIsLoaded = true;
  rerender(<NewGameChooser users={users} />);
  expect(mockRouter.replace).toHaveBeenCalledWith("/games/new?type=circle");
  expect(screen.getByText("Selected Players (1)")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  expect(screen.queryByRole("button", { name: "Start Game" })).not.toBeInTheDocument();
  expect(mockCreateGame).not.toHaveBeenCalled();
});

it("retains the roster and threshold across Back and Forward step navigation", async () => {
  const { rerender } = await selectGuestAndColors();
  fireEvent.click(screen.getByRole("button", { name: "Back" }));
  expect(mockRouter.back).toHaveBeenCalledTimes(1);
  mockStep = null;
  rerender(<NewGameChooser users={users} />);
  expect(screen.getByText("Selected Players (2)")).toBeInTheDocument();
  expect(screen.getByText("Bob")).toBeInTheDocument();
  mockStep = "colors";
  rerender(<NewGameChooser users={users} />);
  fireEvent.click(screen.getByRole("button", { name: "Start Game" }));
  await waitFor(() => expect(mockCreateGame).toHaveBeenCalledWith(
    [expect.objectContaining({ id: "alice" }), expect.objectContaining({ username: "Bob", isGuest: true })],
    50,
  ));
});

it("creates once during a slow request and waits for navigation before enabling another action", async () => {
  let finish!: (value: { ok: true; gameId: string }) => void;
  mockCreateGame.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
  await selectGuestAndColors();
  const start = screen.getByRole("button", { name: "Start Game" });
  fireEvent.click(start);
  fireEvent.click(start);
  expect(mockCreateGame).toHaveBeenCalledTimes(1);
  expect(start).toBeDisabled();
  expect(screen.getByRole("button", { name: "Back" })).toBeDisabled();
  await act(async () => { finish({ ok: true, gameId: "new-game" }); });
  expect(mockRouter.replace).toHaveBeenCalledWith("/games/new-game");
  expect(start).toBeDisabled();
});

it.each([
  ["request failure", () => Promise.reject(new Error("Connection interrupted")), "Connection interrupted"],
  ["validation failure", () => Promise.resolve({ ok: false, message: "A player is no longer in this Circle" }), "A player is no longer in this Circle"],
])("keeps the draft and allows retry after %s", async (_name, fail, message) => {
  mockCreateGame.mockImplementationOnce(fail);
  await selectGuestAndColors();
  fireEvent.click(screen.getByRole("button", { name: "Start Game" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(message);
  expect(screen.getByText("Bob")).toBeInTheDocument();
  expect(mockRouter.replace).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Start Game" }));
  await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith("/games/new-game"));
  expect(mockCreateGame.mock.calls[1]).toEqual(mockCreateGame.mock.calls[0]);
});

it("starts from the saved deck, lets each player pick one, and saves the creator's deck", async () => {
  await selectGuestAndColors();
  const user = userEvent.setup();
  const aliceDecks = screen.getByRole("group", { name: "Deck for Alice (optional)" });
  expect(within(aliceDecks).getByRole("button", { name: "Pump" })).toHaveAttribute("aria-pressed", "true");
  await user.click(within(aliceDecks).getByRole("button", { name: "Carriage" }));
  const bobDecks = screen.getByRole("group", { name: "Deck for Bob (optional)" });
  await user.click(within(bobDecks).getByRole("button", { name: "Bucket" }));
  // Picking the selected deck again clears it.
  await user.click(within(bobDecks).getByRole("button", { name: "Bucket" }));
  expect(within(bobDecks).getByRole("button", { name: "Bucket" })).toHaveAttribute("aria-pressed", "false");

  await user.click(screen.getByRole("button", { name: "Start Game" }));
  await waitFor(() => expect(mockCreateGame).toHaveBeenCalledWith(
    [
      expect.objectContaining({ id: "alice", deck: "carriage" }),
      expect.objectContaining({ username: "Bob", deck: null }),
    ],
    50,
  ));
  expect(mockSaveDeck).toHaveBeenCalledWith("carriage");
});
