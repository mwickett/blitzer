import { auth } from "@clerk/nextjs/server";
import prisma from "@/server/db/db";
import { redirect } from "next/navigation";

// Helper function to get the user's ID from the auth object
// and then look up the user from the database to retreive 

export async function getUserIdFromAuth() {
  const user = auth();

  if (!user.userId) throw new Error("Unauthorized");

  const prismaId = await prisma.user.findUnique({
    where: {
      clerk_user_id: user.userId,
    },
    select: {
      id: true,
    },
  });

  if (!prismaId) {
    console.error("User not found");
    redirect("/?error=UserNotFound"); // Add query parameter for error
  }

  return prismaId.id;
}