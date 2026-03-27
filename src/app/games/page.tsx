import GameList from "@/components/GamesList";
import { getGames, getLegacyGames } from "@/server/queries";
import Link from "next/link";

export default async function GamesList() {
  const [games, legacyGames] = await Promise.all([
    getGames(),
    getLegacyGames(),
  ]);

  return (
    <>
      {legacyGames.length > 0 && (
        <div className="container mx-auto px-4 pt-4">
          <div className="rounded-lg border border-[#e6d7c3] bg-[#f7f2e9] p-3 text-sm text-[#5a341f]">
            You have {legacyGames.length} {legacyGames.length === 1 ? "game" : "games"} from before Circles.{" "}
            <Link href="/games/legacy" className="font-medium underline hover:text-[#2a0e02]">
              View legacy games
            </Link>
          </div>
        </div>
      )}
      <GameList games={games} />
    </>
  );
}
