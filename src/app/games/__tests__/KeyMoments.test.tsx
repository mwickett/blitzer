import { render, screen } from "@testing-library/react";
import KeyMoments from "../[id]/KeyMoments";
import { getKeyMomentsForGame } from "@/server/queries/keyMoments";

jest.mock("@/server/queries/keyMoments", () => ({ getKeyMomentsForGame: jest.fn() }));
jest.mock("next/navigation", () => ({ useRouter: () => ({ refresh: jest.fn() }) }));

const rounds = [{ id: "r1", round: 1 }];

it("shows captioned photos with their round and uploader", async () => {
  (getKeyMomentsForGame as jest.Mock).mockResolvedValue([
    { id: "m1", url: "https://blob.example/a.jpg", caption: "Big Blitz", roundNumber: 3, uploaderName: "mike", canDelete: true },
    { id: "m2", url: "https://blob.example/b.jpg", caption: null, roundNumber: null, uploaderName: null, canDelete: false },
  ]);
  render(await KeyMoments({ gameId: "g", viewerId: "clerk-1", canUpload: false, rounds }));
  expect(screen.getByAltText("Big Blitz")).toHaveAttribute("src", "https://blob.example/a.jpg");
  expect(screen.getByText("Round 3 · mike")).toBeInTheDocument();
  expect(screen.getByText("This game")).toBeInTheDocument();
  expect(screen.getAllByRole("button", { name: "Remove" })).toHaveLength(1);
  expect(screen.queryByRole("button", { name: "Add a photo" })).not.toBeInTheDocument();
  expect(getKeyMomentsForGame).toHaveBeenCalledWith("g", "clerk-1");
});

it("offers upload to players and hides an empty gallery from spectators", async () => {
  (getKeyMomentsForGame as jest.Mock).mockResolvedValue([]);
  render(await KeyMoments({ gameId: "g", viewerId: "clerk-1", canUpload: true, rounds }));
  expect(screen.getByRole("button", { name: "Add a photo" })).toBeInTheDocument();

  const spectator = await KeyMoments({ gameId: "g", viewerId: null, canUpload: false, rounds });
  expect(spectator).toBeNull();
});
