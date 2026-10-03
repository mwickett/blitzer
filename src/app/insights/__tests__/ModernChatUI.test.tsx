import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ModernChatUI from "../ModernChatUI";

const mockSendMessage = jest.fn();
let chatState: {
  messages: { id: string; role: "user" | "assistant"; parts: { type: string; text?: string }[] }[];
  status: "ready" | "submitted" | "streaming" | "error";
  error?: Error;
};

jest.mock("@ai-sdk/react", () => ({
  useChat: () => ({ ...chatState, sendMessage: mockSendMessage }),
}));

beforeEach(() => {
  mockSendMessage.mockClear();
  chatState = { messages: [], status: "ready" };
});

describe("ModernChatUI", () => {
  it("sends a suggested question from the empty state", async () => {
    render(<ModernChatUI />);
    await userEvent.click(screen.getByRole("button", { name: "Who is my nemesis?" }));
    expect(mockSendMessage).toHaveBeenCalledWith({ text: "Who is my nemesis?" });
  });

  it("sends typed questions and clears the input, ignoring blank ones", async () => {
    render(<ModernChatUI />);
    const input = screen.getByPlaceholderText("Ask about your game data...");
    const send = screen.getByRole("button", { name: "Send" });

    expect(send).toBeDisabled();
    await userEvent.type(input, "   ");
    expect(send).toBeDisabled();

    await userEvent.clear(input);
    await userEvent.type(input, "How did I do this week?{enter}");
    expect(mockSendMessage).toHaveBeenCalledTimes(1);
    expect(mockSendMessage).toHaveBeenCalledWith({ text: "How did I do this week?" });
    expect(input).toHaveValue("");
  });

  it("shows the conversation's text parts and hides other parts", () => {
    chatState.messages = [
      { id: "1", role: "user", parts: [{ type: "text", text: "Who beats me most?" }] },
      {
        id: "2",
        role: "assistant",
        parts: [{ type: "step-start" }, { type: "text", text: "Grandma, 3 games to 1." }],
      },
    ];
    render(<ModernChatUI />);

    expect(screen.getByText("Who beats me most?")).toBeInTheDocument();
    expect(screen.getByText("Grandma, 3 games to 1.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Who is my nemesis?" })).not.toBeInTheDocument();
  });

  it("blocks new questions while a reply is streaming", () => {
    chatState.status = "streaming";
    render(<ModernChatUI />);

    expect(screen.getByPlaceholderText("Ask about your game data...")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Thinking..." })).toBeDisabled();
    screen.getByRole("button", { name: "Who is my nemesis?" }).click();
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it("shows the request error", () => {
    chatState = { messages: [], status: "error", error: new Error("Rate limited") };
    render(<ModernChatUI />);
    expect(screen.getByText(/Rate limited/)).toBeInTheDocument();
  });
});
