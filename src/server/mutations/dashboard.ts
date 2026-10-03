"use server";

import prisma from "@/server/db/db";
import { Prisma } from "@/generated/prisma/client";
import { captureServerEvent } from "@/server/telemetry";
import { requireAuthContext } from "./common";
import { dashboardLayoutSchema } from "@/lib/validation/submissions";
import {
  defaultDashboardLayout,
  normalizeDashboardLayout,
  type DashboardLayout,
} from "@/lib/dashboardLayout";

export type SaveDashboardLayoutResult =
  | { ok: true; layout: DashboardLayout }
  | { ok: false; message: string };

/** Saves the signed-in user's card layout. null resets to the defaults. */
export async function saveDashboardLayout(
  input: unknown,
): Promise<SaveDashboardLayoutResult> {
  const { userId, prismaUserId, posthog } = await requireAuthContext("prismaId");

  const parsed = dashboardLayoutSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "That layout could not be saved." };
  }

  // Resetting clears the stored layout so future default changes apply.
  const layout = parsed.data
    ? normalizeDashboardLayout(parsed.data)
    : defaultDashboardLayout();
  await prisma.user.update({
    where: { id: prismaUserId },
    data: { dashboardLayout: parsed.data ? layout : Prisma.DbNull },
  });

  captureServerEvent(posthog, {
    distinctId: userId,
    event: parsed.data ? "dashboard_customized" : "dashboard_reset",
    properties: {
      visible_cards: layout.order.length - layout.hidden.length,
      hidden_cards: layout.hidden.length,
    },
  });

  return { ok: true, layout };
}
