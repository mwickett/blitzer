import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LobbyControls } from "../games/[id]/lobby/LobbyControls";
import { JoinLobbyButton } from "../join/[token]/JoinLobbyButton";
import { JoinByCodeForm } from "../join/JoinByCodeForm";
import { PickupGameSetup } from "../games/new/PickupGameSetup";
import { MAX_PICKUP_PLAYERS } from "@/lib/lobbies";

const mockRouter = { push: jest.fn(), refresh: jest.fn() };
const mockCreate = jest.fn();
const mockJoin = jest.fn();
const mockJoinByCode = jest.fn();
const mockStart = jest.fn();

jest.mock("next/navigation", () => ({ useRouter: () => mockRouter }));
jest.mock("@/server/mutations/lobbies", () => ({
  createPickupGame: (...args: unknown[]) => mockCreate(...args),
  joinPickupGame: (...args: unknown[]) => mockJoin(...args),
  joinPickupGameByCode: (...args: unknown[]) => mockJoinByCode(...args),
  startPickupGame: (...args: unknown[]) => mockStart(...args),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe("PickupGameSetup", () => {
  it("creates a lobby with the threshold and named guests, then opens it", async () => {
    const user = userEvent.setup();
    mockCreate.mockResolvedValue({ ok: true, gameId: "lobby-1" });
    render(<PickupGameSetup />);

    const threshold = screen.getByLabelText("Points to win");
    await user.clear(threshold);
    await user.type(threshold, "100");
    await user.click(screen.getByRole("button", { name: "Add guest" }));
    await user.type(screen.getByLabelText("Guest 1 name"), "Gran");
    await user.click(screen.getByRole("button", { name: "Create lobby" }));

    await waitFor(() =>
      expect(mockRouter.push).toHaveBeenCalledWith("/games/lobby-1/lobby"),
    );
    expect(mockCreate).toHaveBeenCalledWith({
      winThreshold: 100,
      guestNames: ["Gran"],
    });
  });

  it.each(["", "24", "201", "50.5"])(
    "blocks creation for threshold %p",
    async (value) => {
      const user = userEvent.setup();
      render(<PickupGameSetup />);
      const threshold = screen.getByLabelText("Points to win");
      await user.clear(threshold);
      if (value) await user.type(threshold, value);

      expect(
        screen.getByText("Enter a whole number between 25 and 200."),
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Create lobby" })).toBeDisabled();
    },
  );

  it("blocks creation while a guest row is blank, until it is removed", async () => {
    const user = userEvent.setup();
    render(<PickupGameSetup />);
    await user.click(screen.getByRole("button", { name: "Add guest" }));

    expect(
      screen.getByText("Name every guest, or remove the empty rows."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create lobby" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Remove guest" }));
    expect(screen.getByRole("button", { name: "Create lobby" })).toBeEnabled();
  });

  it("stops adding guests once every seat but the host's is taken", async () => {
    const user = userEvent.setup();
    render(<PickupGameSetup />);
    const add = screen.getByRole("button", { name: "Add guest" });
    for (let i = 0; i < MAX_PICKUP_PLAYERS - 1; i++) await user.click(add);

    expect(add).toBeDisabled();
    expect(screen.getByText(/Room for 0 more seats/)).toBeInTheDocument();
  });

  it("shows a refusal from the server and stays on the form", async () => {
    const user = userEvent.setup();
    mockCreate.mockResolvedValue({ ok: false, message: "Too many lobbies" });
    render(<PickupGameSetup />);
    await user.click(screen.getByRole("button", { name: "Create lobby" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Too many lobbies",
    );
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it("shows a thrown error's message", async () => {
    const user = userEvent.setup();
    mockCreate.mockRejectedValue(new Error("Network down"));
    render(<PickupGameSetup />);
    await user.click(screen.getByRole("button", { name: "Create lobby" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Network down");
  });
});

describe("JoinByCodeForm", () => {
  it("normalises the code and only submits a full six characters", async () => {
    const user = userEvent.setup();
    mockJoinByCode.mockResolvedValue({ ok: true, gameId: "lobby-2" });
    render(<JoinByCodeForm />);
    const input = screen.getByPlaceholderText("Lobby code");
    const submit = screen.getByRole("button", { name: "Join game" });

    await user.type(input, "ab-1 2");
    expect(input).toHaveValue("AB12");
    expect(submit).toBeDisabled();

    await user.type(input, "cd9");
    expect(input).toHaveValue("AB12CD");
    await user.click(submit);

    await waitFor(() =>
      expect(mockRouter.push).toHaveBeenCalledWith("/games/lobby-2/lobby"),
    );
    expect(mockJoinByCode).toHaveBeenCalledWith("AB12CD");
  });

  it("shows why a code was refused", async () => {
    const user = userEvent.setup();
    mockJoinByCode.mockResolvedValue({ ok: false, message: "Lobby expired" });
    render(<JoinByCodeForm />);
    await user.type(screen.getByPlaceholderText("Lobby code"), "ABCDEF");
    await user.click(screen.getByRole("button", { name: "Join game" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Lobby expired");
    expect(mockRouter.push).not.toHaveBeenCalled();
  });
});

describe("JoinLobbyButton", () => {
  it("joins with the link token and opens the lobby", async () => {
    const user = userEvent.setup();
    mockJoin.mockResolvedValue({ ok: true, gameId: "lobby-3" });
    render(<JoinLobbyButton token="join-token" />);
    await user.click(screen.getByRole("button", { name: "Join this game" }));

    await waitFor(() =>
      expect(mockRouter.push).toHaveBeenCalledWith("/games/lobby-3/lobby"),
    );
    expect(mockJoin).toHaveBeenCalledWith("join-token");
  });

  it("shows a refusal or a thrown error instead of navigating", async () => {
    const user = userEvent.setup();
    mockJoin
      .mockResolvedValueOnce({ ok: false, message: "Lobby is full" })
      .mockRejectedValueOnce("not an Error");
    render(<JoinLobbyButton token="join-token" />);
    const button = screen.getByRole("button", { name: "Join this game" });

    await user.click(button);
    expect(await screen.findByRole("alert")).toHaveTextContent("Lobby is full");
    await user.click(button);
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Unable to join"),
    );
    expect(mockRouter.push).not.toHaveBeenCalled();
  });
});

describe("LobbyControls", () => {
  const props = {
    gameId: "lobby-4",
    joinUrl: "https://blitzer.example/join/token",
    isHost: true,
    canStart: true,
  };

  it("lets the host start the game and moves everyone to scoring", async () => {
    const user = userEvent.setup();
    mockStart.mockResolvedValue({ ok: true });
    render(<LobbyControls {...props} />);
    await user.click(screen.getByRole("button", { name: "Start game" }));

    await waitFor(() =>
      expect(mockRouter.push).toHaveBeenCalledWith("/games/lobby-4"),
    );
    expect(mockStart).toHaveBeenCalledWith("lobby-4");
  });

  it("keeps the host waiting until another player joins", () => {
    render(<LobbyControls {...props} canStart={false} />);
    expect(
      screen.getByRole("button", { name: "Waiting for another player" }),
    ).toBeDisabled();
  });

  it("shows guests a waiting message instead of a start button", () => {
    render(<LobbyControls {...props} isHost={false} />);
    expect(
      screen.getByText("Waiting for the host to start the game…"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /start/i })).toBeNull();
  });

  it("shows a refused start", async () => {
    const user = userEvent.setup();
    mockStart.mockResolvedValue({ ok: false, message: "Need two players" });
    render(<LobbyControls {...props} />);
    await user.click(screen.getByRole("button", { name: "Start game" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Need two players",
    );
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it("copies the join link, and points at the lobby code when copying fails", async () => {
    const user = userEvent.setup();
    const writeText = jest
      .spyOn(navigator.clipboard, "writeText")
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("insecure context"));
    render(<LobbyControls {...props} />);

    await user.click(screen.getByRole("button", { name: "Copy join link" }));
    expect(writeText).toHaveBeenCalledWith(props.joinUrl);
    expect(await screen.findByRole("button", { name: "Copied" })).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Copied" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "share the lobby code instead",
    );
  });

  it("refreshes the roster every few seconds only while the page is visible", () => {
    jest.useFakeTimers();
    try {
      const visibility = jest.spyOn(document, "visibilityState", "get");
      visibility.mockReturnValue("visible");
      const { unmount } = render(<LobbyControls {...props} />);

      act(() => jest.advanceTimersByTime(5_000));
      expect(mockRouter.refresh).toHaveBeenCalledTimes(1);

      visibility.mockReturnValue("hidden");
      act(() => jest.advanceTimersByTime(5_000));
      expect(mockRouter.refresh).toHaveBeenCalledTimes(1);

      // Returning to the tab refreshes at once
      visibility.mockReturnValue("visible");
      act(() => {
        document.dispatchEvent(new Event("visibilitychange"));
      });
      expect(mockRouter.refresh).toHaveBeenCalledTimes(2);

      unmount();
      act(() => jest.advanceTimersByTime(20_000));
      expect(mockRouter.refresh).toHaveBeenCalledTimes(2);
      visibility.mockRestore();
    } finally {
      jest.useRealTimers();
    }
  });
});
