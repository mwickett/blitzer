import NewGameChooser from "./newGameChooser";
import { getAllUsers } from "@/server/queries";

export default async function NewGame() {
  const users = await getAllUsers();

  return <NewGameChooser users={users} />;
}
