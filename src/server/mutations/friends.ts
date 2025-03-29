"use server";

import { redirect } from "next/navigation";
import prisma from "@/server/db/db";
import { getAuthenticatedUserPrismaId } from "./common";
import { sendFriendRequestEmail } from "../email";

// Create friend request
export async function createFriendRequest(userId: string) {
  const {
    userId: clerkUserId,
    id,
    posthog,
  } = await getAuthenticatedUserPrismaId();

  // Get target user with email
  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      username: true,
    },
  });

  if (!targetUser) {
    throw new Error("Target user not found");
  }

  // Get sender's username
  const sender = await prisma.user.findUnique({
    where: { id },
    select: {
      username: true,
    },
  });

  if (!sender) {
    throw new Error("Sender not found");
  }

  // Check if trying to send request to self
  if (id === userId) {
    throw new Error("Cannot send friend request to yourself");
  }

  // Check if already friends
  const existingFriendship = await prisma.friend.findFirst({
    where: {
      OR: [
        { user1Id: id, user2Id: userId },
        { user1Id: userId, user2Id: id },
      ],
    },
  });

  if (existingFriendship) {
    throw new Error("Already friends with this user");
  }

  // Check if request already exists
  const existingRequest = await prisma.friendRequest.findFirst({
    where: {
      OR: [
        { senderId: id, receiverId: userId },
        { senderId: userId, receiverId: id },
      ],
      status: "PENDING",
    },
  });

  if (existingRequest) {
    throw new Error("Friend request already exists");
  }

  const friendRequest = await prisma.friendRequest.create({
    data: {
      senderId: id,
      receiverId: userId,
    },
  });

  // Send friend request email
  const emailResult = await sendFriendRequestEmail({
    email: targetUser.email,
    username: targetUser.username,
    fromUsername: sender.username,
    userId: clerkUserId,
  });

  if (!emailResult.success) {
    console.error("Friend request email failed:", emailResult.error);
    // Track email failure in PostHog
    posthog.capture({
      distinctId: clerkUserId,
      event: "friend_request_email_failed",
      properties: {
        receiverEmail: targetUser.email,
        receiverUsername: targetUser.username,
        receiverId: targetUser.id,
        errorMessage: emailResult.error,
      },
    });
    // Continue since friend request was created successfully
  }

  posthog.capture({
    distinctId: clerkUserId,
    event: "create_friend_request",
    properties: { userId: userId },
  });

  redirect(`/friends`);
}

// Accept friend request
export async function acceptFriendRequest(friendRequestId: string) {
  const {
    userId: clerkUserId,
    id,
    posthog,
  } = await getAuthenticatedUserPrismaId();

  const friendRequest = await prisma.friendRequest.findUnique({
    where: {
      id: friendRequestId,
    },
    select: {
      senderId: true,
      receiverId: true,
    },
  });

  if (!friendRequest) throw new Error("Friend request not found");
  if (friendRequest.receiverId !== id) {
    throw new Error("Unauthorized - not the receiver");
  }

  await prisma.friend.create({
    data: {
      user1Id: id,
      user2Id: friendRequest.senderId,
    },
  });

  await prisma.friendRequest.update({
    where: {
      id: friendRequestId,
    },
    data: {
      status: "ACCEPTED",
    },
  });

  posthog.capture({
    distinctId: clerkUserId,
    event: "accept_friend_request",
    properties: { friendRequestId: friendRequestId },
  });
}

// Reject friend request
export async function rejectFriendRequest(friendRequestId: string) {
  const {
    userId: clerkUserId,
    id,
    posthog,
  } = await getAuthenticatedUserPrismaId();

  const friendRequest = await prisma.friendRequest.findUnique({
    where: {
      id: friendRequestId,
    },
    select: {
      receiverId: true,
    },
  });

  if (!friendRequest) throw new Error("Friend request not found");
  if (friendRequest.receiverId !== id)
    throw new Error("Unauthorized - not the receiver");

  await prisma.friendRequest.update({
    where: {
      id: friendRequestId,
    },
    data: {
      status: "REJECTED",
    },
  });

  posthog.capture({
    distinctId: clerkUserId,
    event: "reject_friend_request",
    properties: { friendRequestId: friendRequestId },
  });
}
