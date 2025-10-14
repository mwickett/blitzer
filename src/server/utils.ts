import { auth } from "@clerk/nextjs/server";
import prisma from "@/server/db/db";

export async function getOrgContext() {
  const { userId, orgId, orgRole, orgSlug } = await auth();
  if (!userId) throw new Error("Unauthorized");
  if (!orgId) return { org: null, orgId: null };

  let org = await prisma.organization.findUnique({ where: { clerk_org_id: orgId } });
  if (!org) {
    org = await prisma.organization.create({
      data: {
        clerk_org_id: orgId,
        name: orgSlug || "Organization",
        slug: orgSlug || null,
      } as any,
    });
  }

  const dbUser = await prisma.user.findUnique({
    where: { clerk_user_id: userId },
    select: { id: true },
  });
  if (dbUser) {
    await prisma.organizationMembership.upsert({
      where: {
        userId_organizationId: { userId: dbUser.id, organizationId: org.id },
      },
      update: {
        role: (orgRole as any) || "member",
      },
      create: {
        userId: dbUser.id,
        organizationId: org.id,
        role: (orgRole as any) || "member",
      },
    });
  }

  return { org, orgId: org.id };
}

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
