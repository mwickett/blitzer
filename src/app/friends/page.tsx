import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

import {
  getFriends,
  getIncomingFriendRequests,
  getOutgoingPendingFriendRequests,
} from "@/server/queries";

import { User, FriendRequest } from "@prisma/client";

import IncomingFriendRequests from "./_components/IncomingFriendRequests";

interface FriendRequestWithReceiver extends FriendRequest {
  receiver: User;
}

export default async function Friends() {
  const friends = await getFriends();
  const pendingFriends = await getIncomingFriendRequests();
  const pendingFriendRequests = await getOutgoingPendingFriendRequests();

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Friends Manager</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <h2 className="text-2xl font-semibold mb-4">Friends List</h2>
          <FriendsList friends={friends} />
        </div>
        <div>
          <h2 className="text-2xl font-semibold mb-4">Friend Requests</h2>
          <div className="grid grid-cols-1 gap-8">
            <div>
              <h3 className="text-lg font-semibold mb-2">Incoming Requests</h3>
              <IncomingFriendRequests friendRequests={pendingFriends} />
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2">Outgoing Requests</h3>
              <OutgoingFriendRequests
                pendingFriendRequests={pendingFriendRequests}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FriendsList({ friends }: { friends: User[] }) {
  if (friends.length === 0) {
    return <div>No friends</div>;
  }

  return (
    <div className="border rounded-lg overflow-hidden shadow-sm">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead />
            <TableHead>Name</TableHead>
            {/* <TableHead>Mutual Friends</TableHead> */}
          </TableRow>
        </TableHeader>
        <TableBody>
          {friends.map((friend) => (
            <TableRow key={friend.id}>
              <TableCell>
                <Avatar>
                  <AvatarImage src="/placeholder-user.jpg" />
                  <AvatarFallback>
                    {friend.username[0].toUpperCase() +
                      friend.username[friend.username.length - 1].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </TableCell>
              <TableCell className="font-medium">{friend.username}</TableCell>
              {/* <TableCell>12</TableCell> */}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function OutgoingFriendRequests({
  pendingFriendRequests,
}: {
  pendingFriendRequests: FriendRequestWithReceiver[];
}) {
  if (pendingFriendRequests.length === 0) {
    return <div>No pending friend requests</div>;
  }

  return (
    <div className="flex flex-col gap-4">
      {pendingFriendRequests.map((pendingFriendRequest) => (
        <div
          className="border rounded-lg overflow-hidden shadow-sm"
          key={pendingFriendRequest.id}
        >
          <div className="p-4 space-y-4">
            <div className="flex items-center gap-2">
              <Avatar>
                <AvatarImage src="/placeholder-user.jpg" />
                <AvatarFallback>SL</AvatarFallback>
              </Avatar>
              <span className="font-medium">
                {pendingFriendRequest.receiver.username}
              </span>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Pending
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
