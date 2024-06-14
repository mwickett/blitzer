import NewGameChooser from "./newGameChooser";
import { getFriends } from "@/server/queries";

export default async function NewGame() {
  const users = await getFriends();

  return <NewGameChooser users={users} />;
}
