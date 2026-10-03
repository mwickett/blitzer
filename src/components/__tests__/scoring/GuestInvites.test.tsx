import { act, fireEvent, render, screen } from "@testing-library/react";
import { GuestInvites, inviteMessage } from "../../scoring/GuestInvites";
import { type PlayerWithScore } from "../../scoring/types";

const mockCapture = jest.fn();
jest.mock("posthog-js/react", () => ({
  usePostHog: () => ({ capture: mockCapture }),
}));

const gran: PlayerWithScore = {
  id: "g1",
  name: "Gran",
  color: "#00aa00",
  isGuest: true,
  guestId: "g1",
  score: 82,
};

function setNavigator(share?: jest.Mock, writeText?: jest.Mock) {
  Object.defineProperty(navigator, "share", { value: share, configurable: true });
  Object.defineProperty(navigator, "clipboard", {
    value: writeText ? { writeText } : undefined,
    configurable: true,
  });
}

beforeEach(() => mockCapture.mockReset());

it("renders nothing when every player has an account", () => {
  const { container } = render(<GuestInvites guests={[]} winnerId="u1" />);
  expect(container).toBeEmptyDOMElement();
});

it("opens the share sheet with a personal message and records only the method", async () => {
  const share = jest.fn().mockResolvedValue(undefined);
  setNavigator(share);
  render(<GuestInvites guests={[gran]} winnerId="g1" />);

  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Invite Gran to Blitzer" }));
  });

  expect(share).toHaveBeenCalledWith({
    title: "Join me on Blitzer",
    text: inviteMessage(gran, true),
    url: window.location.origin,
  });
  expect(inviteMessage(gran, true)).toContain("you won our Dutch Blitz game with 82 points");
  expect(screen.getByRole("button", { name: "Invite Gran to Blitzer" })).toHaveTextContent("Sent");
  expect(mockCapture).toHaveBeenCalledWith("game_over_guest_invite", {
    method: "share",
    guest_count: 1,
  });
});

it("copies the invite when the device cannot share", async () => {
  const writeText = jest.fn().mockResolvedValue(undefined);
  setNavigator(undefined, writeText);
  render(<GuestInvites guests={[gran]} winnerId="u1" />);

  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Invite Gran to Blitzer" }));
  });

  expect(writeText).toHaveBeenCalledWith(
    `${inviteMessage(gran, false)} ${window.location.origin}`,
  );
  expect(screen.getByRole("status")).toHaveTextContent("Invite copied");
  expect(mockCapture).toHaveBeenCalledWith("game_over_guest_invite", {
    method: "copy",
    guest_count: 1,
  });
});

it("treats a dismissed share sheet as no invite", async () => {
  const share = jest.fn().mockRejectedValue(new DOMException("closed", "AbortError"));
  setNavigator(share);
  render(<GuestInvites guests={[gran]} winnerId="u1" />);

  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Invite Gran to Blitzer" }));
  });

  expect(screen.getByRole("button", { name: "Invite Gran to Blitzer" })).toHaveTextContent("Invite");
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(mockCapture).not.toHaveBeenCalled();
});

it("explains the fallback when sharing and copying both fail", async () => {
  setNavigator(undefined, jest.fn().mockRejectedValue(new Error("denied")));
  render(<GuestInvites guests={[gran]} winnerId="u1" />);

  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Invite Gran to Blitzer" }));
  });

  expect(screen.getByRole("alert")).toHaveTextContent("blitzer.fun");
});
