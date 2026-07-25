import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { JoinByCodeForm } from "./JoinByCodeForm";

jest.mock("@/server/mutations/lobbies", () => ({
  joinPickupGameByCode: jest.fn(),
}));

describe("JoinByCodeForm", () => {
  it("normalizes a lobby code and requires all six characters", async () => {
    const user = userEvent.setup();
    render(<JoinByCodeForm />);

    const input = screen.getByPlaceholderText("Lobby code");
    const submit = screen.getByRole("button", { name: "Join game" });
    expect(submit).toBeDisabled();

    await user.type(input, "ab-c234");

    expect(input).toHaveValue("ABC234");
    expect(submit).toBeEnabled();
  });
});
