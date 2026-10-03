import GameList from "@/components/GamesList";
import { getLegacyGames } from "@/server/queries/games";
import type { GameListSearchParams } from "@/lib/gameList";
import { requireCircle } from "@/server/pageAuth";

export default async function LegacyGamesPage({
  searchParams,
}: {
  searchParams: Promise<GameListSearchParams>;
}) {
  await requireCircle();
  return <GameList page={await getLegacyGames(await searchParams)} legacy />;
}
