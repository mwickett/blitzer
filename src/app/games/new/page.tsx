import NewGameChooser from "./newGameChooser";
import { getFriends, getFriendsForNewGame } from "@/server/queries";

export default async function NewGame() {
  const users = await getFriendsForNewGame();

  return <NewGameChooser users={users} />;
}
