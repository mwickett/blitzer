import { Webhook } from "svix";
import { headers } from "next/headers";
import { WebhookEvent, UserJSON } from "@clerk/nextjs/server";
import prisma from "@/server/db/db";

export async function POST(req: Request) {
  // You can find this in the Clerk Dashboard -> Webhooks -> choose the endpoint
  const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    throw new Error(
      "Please add WEBHOOK_SECRET from Clerk Dashboard to .env or .env.local"
    );
  }

  // Get the headers
  const headerPayload = headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  // If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response("Error occured -- no svix headers", {
      status: 400,
    });
  }

  // Get the body
  const payload = await req.json();
  const body = JSON.stringify(payload);

  // Create a new Svix instance with your secret.
  const wh = new Webhook(WEBHOOK_SECRET);

  let evt: WebhookEvent;

  // Verify the payload with the headers
  try {
    evt = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as WebhookEvent;
  } catch (err) {
    console.error("Error verifying webhook:", err);
    return new Response("Error occured", {
      status: 400,
    });
  }

  // Do something with the payload
  // For this guide, you simply log the payload to the console
  const eventType = evt.type;
  //   console.log(`Webhook with and ID of ${id} and type of ${eventType}`);
  //   console.log("Webhook body:", body);

  if (eventType === "user.created") {
    console.log("user created event");
    try {
      await prisma.user.create({
        data: {
          clerk_user_id: evt.data.id,
          // TODO: use primary email ID to pick off address from array
          email: getPrimaryEmail(evt.data),
        },
      });
    } catch (e) {
      console.error("failed to create user", e);
      return new Response("Failed to create user", { status: 500 });
    }
  }

  if (eventType === "user.deleted") {
    console.log("user deleted event");
    try {
      const deleteUser = await prisma.user.delete({
        where: {
          clerk_user_id: evt.data.id,
        },
      });
    } catch (e) {
      console.error("failed to delete user", e);
      return new Response("Failed to delete user", { status: 500 });
    }
  }

  if (eventType === "user.updated") {
    console.log("user updated event");
    try {
      const updateUser = await prisma.user.update({
        where: {
          clerk_user_id: evt.data.id,
        },
        data: {
          email: getPrimaryEmail(evt.data),
        },
      });
      console.log("update user resulted in: ", updateUser);
    } catch (e) {
      console.error("failed to update user", e);
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
    return "no email"; // No primary email ID or email addresses available
  }

  const primaryEmailObject = user.email_addresses.find(
    (email) => email.id === primaryEmailId
  );

  if (!primaryEmailObject) {
    throw new Error("Primary email not found in email addresses");
  }

  return primaryEmailObject.email_address;
}
