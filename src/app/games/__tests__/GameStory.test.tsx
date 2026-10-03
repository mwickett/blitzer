import { render, screen } from "@testing-library/react";
import GameStory from "../[id]/GameStory";
import { tellGameStory } from "@/server/ai/gameStory";
import type { GameDetail } from "@/server/queries/games";

jest.mock("@/server/ai/gameStory", () => ({ tellGameStory: jest.fn() }));

const game = { id: "game-1" } as GameDetail;

it("shows the stored story", async () => {
  (tellGameStory as jest.Mock).mockResolvedValue({ story: "Mike stormed back.", createdAt: new Date() });
  render(await GameStory({ game, viewerId: "viewer" }));
  expect(tellGameStory).toHaveBeenCalledWith(game, "viewer", "game_story");
  expect(screen.getByRole("heading", { name: /story of this game/i })).toBeInTheDocument();
  expect(screen.getByText("Mike stormed back.")).toBeInTheDocument();
});

it("renders nothing without a story", async () => {
  (tellGameStory as jest.Mock).mockResolvedValue(null);
  expect(await GameStory({ game, viewerId: "viewer" })).toBeNull();
});
