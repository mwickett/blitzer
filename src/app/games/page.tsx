import GameList from "@/components/GamesList";
import { getGames } from "@/server/queries";

export default async function GamesList() {
  const games = await getGames();

  return <GameList games={games} />;
}
