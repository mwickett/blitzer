"use server";

import prisma from "@/server/db/db";
import { captureServerEvent } from "@/server/telemetry";
import { requireAuthContext } from "./common";
import { scoreEntryModeSchema } from "@/lib/validation/submissions";

/** Remembers whether the signed-in user enters card breakdowns or totals. */
export async function saveScoreEntryMode(
  input: unknown,
): Promise<{ ok: boolean }> {
  const parsed = scoreEntryModeSchema.safeParse(input);
  if (!parsed.success) return { ok: false };
  const { userId, prismaUserId, posthog } =
    await requireAuthContext("prismaId");

  await prisma.user.update({
    where: { id: prismaUserId },
    data: { scoreEntryMode: parsed.data },
  });
  captureServerEvent(posthog, {
    distinctId: userId,
    event: "score_entry_mode_changed",
    properties: { entry_mode: parsed.data === "TOTAL" ? "total" : "cards" },
  });
  return { ok: true };
}
