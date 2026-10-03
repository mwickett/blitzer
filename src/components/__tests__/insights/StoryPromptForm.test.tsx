import { act, fireEvent, render, screen } from "@testing-library/react";
import { StoryPromptForm } from "@/components/insights/StoryPromptForm";
import { saveStoryPrompt } from "@/server/mutations/insights";

jest.mock("@/server/mutations/insights", () => ({ saveStoryPrompt: jest.fn() }));
const mockSave = saveStoryPrompt as jest.Mock;

beforeEach(() => mockSave.mockReset());

it("saves a new style and confirms it", async () => {
  mockSave.mockResolvedValue({ ok: true, storyPrompt: "As a pirate shanty" });
  render(<StoryPromptForm initialPrompt={null} />);
  const save = screen.getByRole("button", { name: "Save style" });
  expect(save).toBeDisabled();

  fireEvent.change(screen.getByLabelText("Story style"), { target: { value: " As a pirate shanty " } });
  expect(screen.getByText("20/280")).toBeInTheDocument();
  await act(async () => fireEvent.click(save));

  expect(mockSave).toHaveBeenCalledWith(" As a pirate shanty ");
  expect(screen.getByRole("status")).toHaveTextContent("Saved. Your next game email will use it.");
  expect(screen.getByLabelText("Story style")).toHaveValue("As a pirate shanty");
  expect(screen.getByRole("button", { name: "Use the standard story" })).toBeInTheDocument();
});

it("clears a saved style", async () => {
  mockSave.mockResolvedValue({ ok: true, storyPrompt: null });
  render(<StoryPromptForm initialPrompt="As a pirate shanty" />);
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Use the standard story" })));

  expect(mockSave).toHaveBeenCalledWith("");
  expect(screen.getByLabelText("Story style")).toHaveValue("");
  expect(screen.getByRole("status")).toHaveTextContent("Back to the standard story.");
  expect(screen.queryByRole("button", { name: "Use the standard story" })).not.toBeInTheDocument();
});

it("shows the server's message when saving fails", async () => {
  mockSave.mockResolvedValue({ ok: false, message: "This feature is currently disabled." });
  render(<StoryPromptForm initialPrompt={null} />);
  fireEvent.change(screen.getByLabelText("Story style"), { target: { value: "Short" } });
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Save style" })));
  expect(screen.getByRole("alert")).toHaveTextContent("This feature is currently disabled.");

  mockSave.mockRejectedValue(new Error("offline"));
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Save style" })));
  expect(screen.getByRole("alert")).toHaveTextContent("Couldn't save your story style.");
});
