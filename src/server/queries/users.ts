import "server-only";

import prisma from "@/server/db/db";
import { getUserIdFromAuth } from "@/server/utils";

// Fetches users who are friends of the current user but excludes the current
// user
export async function getFilteredUsers() {
  const id = await getUserIdFromAuth();

  const users = await prisma.user.findMany({
    where: {
      NOT: {
        OR: [
          {
            id: id,
          },
          {
            friends1: {
              some: {
                user2Id: id,
              },
            },
          },
          {
            friends2: {
              some: {
                user1Id: id,
              },
            },
          },
          {
            friendRequestsSent: {
              some: {
                receiverId: id,
              },
            },
          },
          {
            friendRequestsReceived: {
              some: {
                senderId: id,
                status: "PENDING",
              },
            },
          },
        ],
      },
    },
  });

  return users;
}
