"use client";
import { FriendRequest } from "@prisma/client";
import { acceptFriendRequest } from "@/server/mutations";

export default function FriendRequests({
  friendRequests,
}: {
  friendRequests: FriendRequest[];
}) {
  return (
    <div>
      <h2>Pending friend requests</h2>
      {friendRequests.map((friend) => (
        <div key={friend.id}>
          <p>{friend.sender.username}</p>
          <button onClick={() => acceptFriendRequest(friend.id)}>Accept</button>
        </div>
      ))}
    </div>
  );
}
