"use client";
import UserAvatar from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { User, FriendRequest } from "@prisma/client";

import { acceptFriendRequest, rejectFriendRequest } from "@/server/mutations";

interface FriendRequestWithSender extends FriendRequest {
  sender: User;
}

export default function IncomingFriendRequests({
  friendRequests,
}: {
  friendRequests: FriendRequestWithSender[];
}) {
  const router = useRouter();

  const handleAcceptFriendRequest = async (friendRequestId: string) => {
    await acceptFriendRequest(friendRequestId);
    router.refresh();
  };

  const handleRejectFriendRequest = async (friendRequestId: string) => {
    await rejectFriendRequest(friendRequestId);
    router.refresh();
  };

  if (friendRequests.length === 0) {
    return (
      <div className="flex flex-col justify-center gap-4">
        <p>No friend requests</p>
        <Link href="/friends/add">
          <Button>Add friends</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {friendRequests.map((friendRequest) => (
        <div
          className="border rounded-lg overflow-hidden shadow-sm"
          key={friendRequest.id}
        >
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserAvatar
                  src={friendRequest.sender.avatarUrl ?? ""}
                  username={friendRequest.sender.username}
                />
                <span className="font-medium">
                  {friendRequest.sender.username}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleAcceptFriendRequest(friendRequest.id)}
                >
                  Approve
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleRejectFriendRequest(friendRequest.id)}
                >
                  Reject
                </Button>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
