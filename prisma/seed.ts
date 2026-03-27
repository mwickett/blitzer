/**
 * Seed script for preview/dev environments.
 *
 * Syncs all users from the Clerk dev instance into the Prisma database,
 * matching on clerk_user_id. Existing users are updated (username, email,
 * avatar); new users are created. This eliminates the need for webhook
 * connectivity in preview deploys.
 *
 * Usage: npx tsx prisma/seed.ts
 */

import "dotenv/config";
import { createClerkClient } from "@clerk/backend";
import { Pool } from "pg";

async function main() {
  // Only run on preview deploys and local dev — never production
  if (process.env.VERCEL_ENV === "production") {
    console.log("Skipping seed in production");
    return;
  }

  const clerkSecretKey = process.env.CLERK_SECRET_KEY;
  const databaseUrl = process.env.DATABASE_URL;

  if (!clerkSecretKey) {
    throw new Error("CLERK_SECRET_KEY is required");
  }
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  const clerk = createClerkClient({ secretKey: clerkSecretKey });
  const pool = new Pool({ connectionString: databaseUrl });

  try {
    // Fetch all users from Clerk
    const clerkUsers = await clerk.users.getUserList({ limit: 100 });
    console.log(`Found ${clerkUsers.data.length} users in Clerk`);

    for (const user of clerkUsers.data) {
      const email =
        user.emailAddresses[0]?.emailAddress || `${user.id}@placeholder.dev`;
      const username = user.username || user.id.slice(-8);
      const avatarUrl = user.imageUrl || null;

      // Upsert: insert or update on clerk_user_id conflict
      await pool.query(
        `INSERT INTO "User" (id, clerk_user_id, email, username, "avatarUrl", created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, now(), now())
         ON CONFLICT (clerk_user_id)
         DO UPDATE SET email = $2, username = $3, "avatarUrl" = $4, updated_at = now()`,
        [user.id, email, username, avatarUrl]
      );

      console.log(`  ✓ ${username} (${email})`);
    }

    console.log(`\nSeeded ${clerkUsers.data.length} users successfully`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  // Don't fail the build if seeding fails — it's non-critical for previews
  console.error("Seed failed (non-fatal):", err.message || err);
});
