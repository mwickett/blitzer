import { act, fireEvent, render, screen } from "@testing-library/react";
import { RoundRecap } from "@/components/scoring/RoundRecap";

const speak = jest.fn();
const cancel = jest.fn();
class FakeUtterance {
  onend: (() => void) | null = null;
  constructor(public text: string) {}
}

beforeEach(() => {
  jest.clearAllMocks();
  Object.assign(window, { speechSynthesis: { speak, cancel }, SpeechSynthesisUtterance: FakeUtterance });
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ text: "Carol surges ahead!" }) });
});

it("stays hidden before the first round", () => {
  const { container } = render(<RoundRecap gameId="game-1" roundsPlayed={0} />);
  expect(container).toBeEmptyDOMElement();
});

it("fetches the recap, reads it aloud and shows the text", async () => {
  render(<RoundRecap gameId="game-1" roundsPlayed={2} />);
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Play recap" })));
  expect(global.fetch).toHaveBeenCalledWith("/api/games/game-1/recap", { method: "POST" });
  expect(screen.getByText("Carol surges ahead!")).toBeInTheDocument();
  expect(speak).toHaveBeenCalledWith(expect.objectContaining({ text: "Carol surges ahead!" }));
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Stop" })));
  expect(cancel).toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Play again" })).toBeInTheDocument();
});

it("shows the server's message when no recap comes back", async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "Recaps are temporarily unavailable" }) });
  render(<RoundRecap gameId="game-1" roundsPlayed={2} />);
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Play recap" })));
  expect(screen.getByRole("alert")).toHaveTextContent("Recaps are temporarily unavailable");
  expect(speak).not.toHaveBeenCalled();
});
