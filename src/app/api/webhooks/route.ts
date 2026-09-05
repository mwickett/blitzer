import type { WebhookEvent, UserJSON } from "@clerk/nextjs/server";
import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { type NextRequest } from "next/server";
import { sendWelcomeEmail } from "@/server/email";
import {
  AccountEmailConflictError,
  resolveClerkUser,
} from "@/server/users/provision";

export async function POST(req: NextRequest) {
  let evt: WebhookEvent;
  try {
    evt = (await verifyWebhook(req)) as WebhookEvent;
  } catch {
    console.error("Clerk webhook verification failed");
    return new Response("Webhook verification failed", { status: 400 });
  }

  if (evt.type === "user.created" || evt.type === "user.updated") {
    try {
      const profile = evt.data;
      const user = await resolveClerkUser(
        profile.id,
        () => ({
          email: getPrimaryEmail(profile),
          username: profile.username,
          avatarUrl: profile.image_url,
        }),
        evt.type === "user.updated" ? "sync" : "provision",
      );

      if (evt.type === "user.created") {
        // The pickup join may already have provisioned the row. Welcome that
        // player too, with a stable identity key for provider retry deduplication.
        const result = await sendWelcomeEmail({
          email: user.email,
          username: user.username,
          userId: user.id,
        });
        if (!result.success) {
          console.error("Welcome email failed", { userId: user.id });
        }
      }
    } catch (error) {
      if (error instanceof AccountEmailConflictError) {
        console.error("Clerk account email conflict", { userId: evt.data.id });
        return new Response("Account email conflict", { status: 409 });
      }
      console.error("Failed to synchronize Clerk user", {
        userId: evt.data.id,
        eventType: evt.type,
      });
      return new Response("Failed to synchronize user", { status: 500 });
    }
  }

  // Retain deleted users to preserve game history. A recreated Clerk account
  // is a distinct identity; account retention policy remains tracked in #70.
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
