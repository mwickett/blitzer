import GameList from "@/components/GamesList";
import { getGames } from "@/server/queries/games";
import type { GameListSearchParams } from "@/lib/gameList";
import Link from "next/link";

export default async function GamesPage({
  searchParams,
}: {
  searchParams: Promise<GameListSearchParams>;
}) {
  const page = await getGames(await searchParams);
  return (
    <>
      {page.legacyCount > 0 && (
        <div className="container mx-auto px-4 pt-4">
          <p className="rounded-lg border border-[#e6d7c3] bg-[#f7f2e9] p-3 text-sm text-[#5a341f]">
            You have {page.legacyCount}{" "}
            {page.legacyCount === 1 ? "game" : "games"} from before Circles.{" "}
            <Link href="/games/legacy" className="font-medium underline">
              View legacy games
            </Link>
          </p>
        </div>
      )}
      <GameList page={page} />
    </>
  );
}
