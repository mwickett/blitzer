import { WebhookEvent, UserJSON } from "@clerk/nextjs/server";
import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { type NextRequest } from "next/server";
import prisma from "@/server/db/db";
import { generateRandomUsername } from "@/lib/utils";
import { sendWelcomeEmail } from "@/server/email";
import * as Sentry from "@sentry/nextjs";

/**
 * Helper function to find a user by Clerk ID with retry logic.
 * This handles race conditions where membership webhooks arrive before user.created completes.
 */
async function findUserWithRetry(
  clerkUserId: string,
  maxRetries: number = 5,
  delayMs: number = 500
): Promise<{ id: string } | null> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const user = await prisma.user.findUnique({
      where: { clerk_user_id: clerkUserId },
      select: { id: true },
    });

    if (user) {
      if (attempt > 0) {
        console.log(
          `User found on retry attempt ${attempt} for Clerk ID: ${clerkUserId}`
        );
      }
      return user;
    }

    // If not the last attempt, wait before retrying
    if (attempt < maxRetries) {
      console.log(
        `User not found for Clerk ID: ${clerkUserId}, retrying in ${delayMs}ms (attempt ${attempt + 1}/${maxRetries})`
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      // Exponential backoff: double the delay for next retry
      delayMs *= 2;
    }
  }

  return null;
}

export async function POST(req: NextRequest) {
  let evt: WebhookEvent;

  try {
    evt = (await verifyWebhook(req)) as WebhookEvent;
  } catch (err) {
    console.error(
      "Error verifying webhook:",
      err instanceof Error ? err.message : err
    );
    return new Response("Webhook verification failed", { status: 400 });
  }

  const eventType = evt.type;

  if (eventType === "user.created") {
    console.log("Processing user.created event", {
      id: (evt.data as any).id,
      username: (evt.data as any).username,
    });
    try {
      const email = getPrimaryEmail(evt.data as any);
      const username = (evt.data as any).username || generateRandomUsername();

      let user = await prisma.user.findUnique({
        where: { email },
      });

      if (user) {
        user = await prisma.user.update({
          where: { email },
          data: {
            clerk_user_id: (evt.data as any).id,
            username,
            avatarUrl: (evt.data as any).image_url,
          },
        });
        console.log("Updated existing user with new Clerk ID:", {
          id: user.id,
          email: user.email,
        });
      } else {
        user = await prisma.user.create({
          data: {
            clerk_user_id: (evt.data as any).id,
            email,
            username,
            avatarUrl: (evt.data as any).image_url,
          },
        });
        console.log("Created new user:", {
          id: user.id,
          email: user.email,
        });
      }

      const emailResult = await sendWelcomeEmail({
        email,
        username,
      });

      if (!emailResult.success) {
        console.error("Welcome email failed:", emailResult.error);
      }
    } catch (e) {
      console.error("Failed to create user:", {
        error: e instanceof Error ? e.message : "Unknown error",
        userId: (evt.data as any).id,
      });
      return new Response("Failed to create user", { status: 500 });
    }
  }

  if (eventType === "user.deleted") {
    console.log("Processing user.deleted event", {
      id: (evt.data as any).id,
    });
  }

  if (eventType === "user.updated") {
    console.log("Processing user.updated event", {
      id: (evt.data as any).id,
      username: (evt.data as any).username,
    });
    try {
      const updateUser = await prisma.user.update({
        where: {
          clerk_user_id: (evt.data as any).id,
        },
        data: {
          email: getPrimaryEmail(evt.data as any),
          username: (evt.data as any).username || generateRandomUsername(),
          avatarUrl: (evt.data as any).image_url,
        },
      });
      console.log("User updated successfully:", {
        id: updateUser.id,
        username: updateUser.username,
      });
    } catch (e) {
      console.error("Failed to update user:", {
        error: e instanceof Error ? e.message : "Unknown error",
        userId: (evt.data as any).id,
      });
      return new Response("Failed to update user", { status: 500 });
    }
  }

  // Organization membership events: created/updated/deleted
  if (
    eventType === "organizationMembership.created" ||
    eventType === "organizationMembership.updated"
  ) {
    try {
      const data: any = evt.data;
      const organizationId = data.organization.id;
      const clerkUserId = data.public_user_data.user_id || data.user?.id;

      if (!organizationId || !clerkUserId) {
        console.warn("Missing orgId or userId in membership event", data);
        return new Response("", { status: 200 });
      }

      // Use retry logic to handle race condition with user.created webhook
      const prismaUser = await findUserWithRetry(clerkUserId);

      if (!prismaUser) {
        const error = new Error(
          "Organization membership webhook received for unknown user after retries"
        );
        Sentry.captureException(error, {
          tags: {
            webhook_event: eventType,
          },
          extra: {
            organizationId,
            clerkUserId,
            eventData: data,
          },
        });
        console.error("Membership for unknown user after retries", {
          organizationId,
          clerkUserId,
        });
        return new Response("", { status: 200 });
      }

      await prisma.organizationMembership.upsert({
        where: {
          organizationId_userId: {
            organizationId,
            userId: prismaUser.id,
          } as any,
        },
        update: {
          role: data.role || null,
        },
        create: {
          organizationId,
          userId: prismaUser.id,
          role: data.role || null,
        },
      });

      console.log("Organization membership synced", {
        organizationId,
        userId: prismaUser.id,
      });
    } catch (e) {
      console.error("Failed to sync organization membership:", e);
      return new Response("Failed to sync organization membership", {
        status: 500,
      });
    }
  }

  if (eventType === "organizationMembership.deleted") {
    try {
      const data: any = evt.data;
      const organizationId = data.organization.id;
      const clerkUserId = data.public_user_data.user_id || data.user?.id;

      if (!organizationId || !clerkUserId) {
        console.warn(
          "Missing orgId or userId in membership deletion event",
          data
        );
        return new Response("", { status: 200 });
      }

      // Use retry logic to handle race condition with user.created webhook
      const prismaUser = await findUserWithRetry(clerkUserId);

      if (!prismaUser) {
        const error = new Error(
          "Organization membership deletion webhook received for unknown user after retries"
        );
        Sentry.captureException(error, {
          tags: {
            webhook_event: eventType,
          },
          extra: {
            organizationId,
            clerkUserId,
            eventData: data,
          },
        });
        console.error("Membership delete for unknown user after retries", {
          organizationId,
          clerkUserId,
        });
        return new Response("", { status: 200 });
      }

      await prisma.organizationMembership.deleteMany({
        where: {
          organizationId,
          userId: prismaUser.id,
        },
      });

      console.log("Organization membership removed", {
        organizationId,
        userId: prismaUser.id,
      });
    } catch (e) {
      console.error("Failed to remove organization membership:", e);
      return new Response("Failed to remove organization membership", {
        status: 500,
      });
    }
  }

  return new Response("", { status: 200 });
}

function getPrimaryEmail(user: UserJSON) {
  const primaryEmailId = user.primary_email_address_id;

  if (
    !primaryEmailId ||
    !user.email_addresses ||
    user.email_addresses.length === 0
  ) {
    throw new Error("No primary email found for user");
  }

  const primaryEmailObject = user.email_addresses.find(
    (email) => email.id === primaryEmailId
  );

  if (!primaryEmailObject) {
    throw new Error("Primary email not found in email addresses");
  }

  return primaryEmailObject.email_address;
}
