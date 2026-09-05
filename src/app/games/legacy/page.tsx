import GameList from "@/components/GamesList";
import { getLegacyGames } from "@/server/queries/games";
import type { GameListSearchParams } from "@/lib/gameList";

export default async function LegacyGamesPage({
  searchParams,
}: {
  searchParams: Promise<GameListSearchParams>;
}) {
  return <GameList page={await getLegacyGames(await searchParams)} legacy />;
}
