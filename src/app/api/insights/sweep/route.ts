import { NextRequest, NextResponse } from "next/server";
import { regeneratePendingSummaries } from "@/server/ai/summary";

// Cron-only durability sweep: retries game summaries that never reached `ready`.
// Vercel Cron sends `Authorization: Bearer ${CRON_SECRET}`. Not Clerk-gated
// (it's not in proxy.ts's protected matcher), so the CRON_SECRET check is the
// only guard — keep it set in production.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const processed = await regeneratePendingSummaries();
  return NextResponse.json({ processed });
}
