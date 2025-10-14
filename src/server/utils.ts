import { auth } from "@clerk/nextjs/server";
import prisma from "@/server/db/db";

export async function getOrgContext() {
  const { userId, orgId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  if (!orgId) return { org: null, orgId: null };

  let org = await prisma.organization.findUnique({ where: { clerk_org_id: orgId } });
  if (!org) {
    org = await prisma.organization.create({
      data: { clerk_org_id: orgId, name: "Organization" },
    });
  }
  return { org, orgId: org.id };
}

// Helper function to get the user's ID from the auth object
// and then look up the user from the database to retreive 

export async function getUserIdFromAuth() {
  const user = await auth();

  if (!user.userId) throw new Error("Unauthorized");

  const prismaId = await prisma.user.findUnique({
    where: {
      clerk_user_id: user.userId,
    },
    select: {
      id: true,
    },
  });

  if (!prismaId) throw new Error("User not found");

  return prismaId.id;
}
