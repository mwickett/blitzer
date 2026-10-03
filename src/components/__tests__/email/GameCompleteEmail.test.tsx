import { render, screen } from "@testing-library/react";
import { GameCompleteEmail } from "@/components/email/game-complete-template";

jest.mock("react-email", () => {
  const actual = jest.requireActual("react-email");
  return { ...actual, render: () => Promise.resolve("") };
});

const base = { username: "Mike", winnerUsername: "Carol", isWinner: false, gameId: "game-1" };

it("includes the game story when one is provided", () => {
  render(GameCompleteEmail({ ...base, story: "Carol never trailed." }).component);
  expect(screen.getByText("The story of this game")).toBeInTheDocument();
  expect(screen.getByText("Carol never trailed.")).toBeInTheDocument();
});

it("leaves the story section out otherwise", () => {
  render(GameCompleteEmail(base).component);
  expect(screen.queryByText("The story of this game")).not.toBeInTheDocument();
});

it("names guests so the recipient can invite them", () => {
  render(GameCompleteEmail({ ...base, guestNames: ["Gran", "Ollie", "Sam"] }).component);
  expect(screen.getByText(/Gran, Ollie and Sam played as guests/)).toBeInTheDocument();
});

it("says nothing about guests when there were none", () => {
  render(GameCompleteEmail(base).component);
  expect(screen.queryByText(/played as/)).not.toBeInTheDocument();
});
