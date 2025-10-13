import { WebhookEvent, UserJSON } from "@clerk/nextjs/server";
import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { type NextRequest } from "next/server";
import prisma from "@/server/db/db";
import { generateRandomUsername } from "@/lib/utils";
import { sendWelcomeEmail } from "@/server/email";

export async function POST(req: NextRequest) {
  let evt: WebhookEvent;

  try {
    evt = (await verifyWebhook(req)) as WebhookEvent;
  } catch (err) {
    // Log the specific error from verifyWebhook
    console.error(
      "Error verifying webhook:",
      err instanceof Error ? err.message : err
    );
    // Return a clear error response
    return new Response("Webhook verification failed", { status: 400 });
  }

  const eventType = evt.type;

  if (eventType === "user.created") {
    console.log("Processing user.created event", {
      id: evt.data.id,
      username: evt.data.username,
    });
    try {
      // Get user info
      const email = getPrimaryEmail(evt.data);
      const username = evt.data.username || generateRandomUsername();

      // Check if user with this email already exists
      let user = await prisma.user.findUnique({
        where: { email },
      });

      if (user) {
        // Update existing user with new Clerk ID
        user = await prisma.user.update({
          where: { email },
          data: {
            clerk_user_id: evt.data.id,
            username, // Update username in case it changed
            avatarUrl: evt.data.image_url,
          },
        });
        console.log("Updated existing user with new Clerk ID:", {
          id: user.id,
          email: user.email,
        });
      } else {
        // Create new user
        user = await prisma.user.create({
          data: {
            clerk_user_id: evt.data.id,
            email,
            username,
            avatarUrl: evt.data.image_url,
          },
        });
        console.log("Created new user:", {
          id: user.id,
          email: user.email,
        });
      }

      // Send welcome email after user is created
      const emailResult = await sendWelcomeEmail({
        email,
        username,
      });

      if (!emailResult.success) {
        console.error("Welcome email failed:", emailResult.error);
        // Continue since user creation was successful
      }
    } catch (e) {
      console.error("Failed to create user:", {
        error: e instanceof Error ? e.message : "Unknown error",
        userId: evt.data.id,
      });
      return new Response("Failed to create user", { status: 500 });
    }
  }

  if (eventType === "user.deleted") {
    console.log("Processing user.deleted event", {
      id: evt.data.id,
    });
    // Doing nothing with this for now because I don't want to delete users from the database as it leaves holes in the game history
  }

  if (eventType === "user.updated") {
    console.log("Processing user.updated event", {
      id: evt.data.id,
      username: evt.data.username,
    });
    try {
      const updateUser = await prisma.user.update({
        where: {
          clerk_user_id: evt.data.id,
        },
        data: {
          email: getPrimaryEmail(evt.data),
          username: evt.data.username || generateRandomUsername(),
          avatarUrl: evt.data.image_url,
        },
      });
      console.log("User updated successfully:", {
        id: updateUser.id,
        username: updateUser.username,
      });
    } catch (e) {
      console.error("Failed to update user:", {
        error: e instanceof Error ? e.message : "Unknown error",
        userId: evt.data.id,
      });
      return new Response("Failed to update user", { status: 500 });
    }
  }

  return new Response("", { status: 200 });
}

// Return user's primary email
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
