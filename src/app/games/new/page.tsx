import NewGameChooser from "./newGameChooser";
import { getFriendsForNewGame } from "@/server/queries";
import ClientLink from "@/components/helpers/ClientLink";

export default async function NewGame() {
  const users = await getFriendsForNewGame();

  if (users.length === 0) {
    return (
      <div className="flex flex-col items-center h-screen gap-4 mt-4">
        <p>No friends yet</p>
        <ClientLink href="/friends/add" label="Add friends" />
      </div>
    );
  }

  return <NewGameChooser users={users} />;
}
