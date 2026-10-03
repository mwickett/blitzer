import { fireEvent, render, screen } from "@testing-library/react";
import GameNote from "../[id]/GameNote";
import { saveGameNote } from "@/server/mutations/games";

const mockRefresh = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));
jest.mock("@/server/mutations/games", () => ({ saveGameNote: jest.fn() }));

beforeEach(() => {
  mockRefresh.mockReset();
  jest.mocked(saveGameNote).mockReset();
});

it("shows the note read-only to spectators and nothing when there is none", () => {
  const { rerender, container } = render(
    <GameNote gameId="g1" note="Gran blitzed twice" canEdit={false} />,
  );
  expect(screen.getByText("Gran blitzed twice")).toBeInTheDocument();
  expect(screen.queryByRole("button")).not.toBeInTheDocument();

  rerender(<GameNote gameId="g1" note={null} canEdit={false} />);
  expect(container).toBeEmptyDOMElement();
});

it("lets a player add a note and shows it once saved", async () => {
  jest
    .mocked(saveGameNote)
    .mockResolvedValue({ ok: true, note: "Lucky pump deck" });
  render(<GameNote gameId="g1" note={null} canEdit />);

  fireEvent.click(screen.getByRole("button", { name: "Add a note" }));
  fireEvent.change(screen.getByLabelText("Game note"), {
    target: { value: " Lucky pump deck " },
  });
  expect(screen.getByText("17/280")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Save note" }));

  // The draft text is in the textarea until the save finishes.
  await screen.findByRole("button", { name: "Edit note" });
  expect(screen.getByText("Lucky pump deck")).toBeInTheDocument();
  expect(saveGameNote).toHaveBeenCalledWith("g1", " Lucky pump deck ");
  expect(mockRefresh).toHaveBeenCalled();
});

it("keeps the draft and shows the error when saving fails", async () => {
  jest
    .mocked(saveGameNote)
    .mockResolvedValue({
      ok: false,
      message: "Keep the note to 280 characters.",
    });
  render(<GameNote gameId="g1" note="Old" canEdit />);

  fireEvent.click(screen.getByRole("button", { name: "Edit note" }));
  expect(screen.getByLabelText("Game note")).toHaveValue("Old");
  fireEvent.change(screen.getByLabelText("Game note"), {
    target: { value: "New" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save note" }));

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Keep the note to 280 characters.",
  );
  expect(screen.getByLabelText("Game note")).toHaveValue("New");
});
