import { getFriends, getPendingFriendRequests } from "@/server/queries";
import FriendRequests from "./FriendRequests";

export default async function Friends() {
  const friends = await getFriends();
  const pendingFriends = await getPendingFriendRequests();
  return (
    <div>
      <h2>This is the friends page</h2>
      <h3>Friends</h3>
      <pre>{JSON.stringify(friends, null, 2)}</pre>
      <h3>Pending Friends</h3>
      <FriendRequests friendRequests={pendingFriends} />
    </div>
  );
}
