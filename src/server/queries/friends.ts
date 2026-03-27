import "server-only";

import prisma from "@/server/db/db";
import { auth } from "@clerk/nextjs/server";
import { getUserIdFromAuth } from "@/server/utils";

// Get all friends of the current user
export async function getFriends() {
  const id = await getUserIdFromAuth();

  const friends = await prisma.friend.findMany({
    where: {
      OR: [{ user1Id: id }, { user2Id: id }],
    },
    include: {
      user1: true,
      user2: true,
    },
  });

  const result = friends.map((friend) => {
    return friend.user1Id === id ? friend.user2 : friend.user1;
  });

  return result;
}

// Get all friends of the current user and include the current user
// Used when creating a new game
export async function getFriendsForNewGame() {
  const user = await auth();

  if (!user.userId) throw new Error("Unauthorized");

  const prismaId = await prisma.user.findUnique({
    where: {
      clerk_user_id: user.userId,
    },
  });

  if (!prismaId) throw new Error("User not found");

  const friends = await prisma.friend.findMany({
    where: {
      OR: [{ user1Id: prismaId.id }, { user2Id: prismaId.id }],
    },
    include: {
      user1: true,
      user2: true,
    },
  });

  const result = friends.map((friend) => {
    return friend.user1Id === prismaId.id ? friend.user2 : friend.user1;
  });

  return [prismaId, ...result];
}

// Get all pending friend requests
export async function getIncomingFriendRequests() {
  const id = await getUserIdFromAuth();

  const pendingFriendRequests = await prisma.friendRequest.findMany({
    where: {
      receiverId: id,
      status: "PENDING",
    },
    include: {
      sender: true,
    },
  });

  return pendingFriendRequests;
}

// Get all friend requests that the current user has sent that are pending
export async function getOutgoingPendingFriendRequests() {
  const id = await getUserIdFromAuth();

  const outgoingFriendRequests = await prisma.friendRequest.findMany({
    where: {
      senderId: id,
      status: "PENDING",
    },
    include: {
      receiver: true,
    },
  });

  return outgoingFriendRequests;
}
