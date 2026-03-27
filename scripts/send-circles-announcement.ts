/**
 * Send Circles announcement email to all users (or a test recipient).
 *
 * Usage:
 *   npx tsx scripts/send-circles-announcement.ts --test mike@wickett.ca
 *   npx tsx scripts/send-circles-announcement.ts --send
 */

import "dotenv/config";
import { Resend } from "resend";
import { Pool } from "pg";
import { CirclesAnnouncementEmail } from "../src/components/email/circles-announcement-template";
import { render } from "@react-email/render";
import React from "react";

const resend = new Resend(process.env.RESEND_API_KEY);
const SENDER = "Blitzer <hello@blitzer.fun>";
const DELAY_MS = 600; // Resend rate limit: ~2/sec

async function sendOne(email: string, username: string): Promise<boolean> {
  const emailContent = CirclesAnnouncementEmail({ username });

  try {
    const { error } = await resend.emails.send({
      from: SENDER,
      to: [email],
      subject: "Blitzer update: Introducing Circles",
      react: emailContent.component,
      text: await emailContent.text,
    });

    if (error) {
      console.error(`  ✗ ${username} (${email}): ${error.message}`);
      return false;
    }

    console.log(`  ✓ ${username} (${email})`);
    return true;
  } catch (err) {
    console.error(
      `  ✗ ${username} (${email}):`,
      err instanceof Error ? err.message : err
    );
    return false;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const testIndex = args.indexOf("--test");
  const sendAll = args.includes("--send");

  if (testIndex !== -1 && args[testIndex + 1]) {
    // Test mode: send to a single email
    const testEmail = args[testIndex + 1];
    console.log(`Sending test email to ${testEmail}...`);
    const ok = await sendOne(testEmail, "Test User");
    process.exit(ok ? 0 : 1);
  }

  if (!sendAll) {
    console.log("Usage:");
    console.log(
      "  npx tsx scripts/send-circles-announcement.ts --test <email>"
    );
    console.log("  npx tsx scripts/send-circles-announcement.ts --send");
    process.exit(0);
  }

  // Send to all users
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    const { rows } = await pool.query<{ email: string; username: string }>(
      'SELECT email, username FROM "User" ORDER BY created_at'
    );

    console.log(`Sending to ${rows.length} users...\n`);

    let sent = 0;
    let failed = 0;

    for (let i = 0; i < rows.length; i++) {
      const { email, username } = rows[i];
      const ok = await sendOne(email, username);
      if (ok) sent++;
      else failed++;

      // Rate limit delay between sends
      if (i < rows.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
      }
    }

    console.log(`\nDone: ${sent} sent, ${failed} failed out of ${rows.length}`);
  } finally {
    await pool.end();
  }
}

main();
