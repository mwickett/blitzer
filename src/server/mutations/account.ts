"use server";

import { captureServerEvent } from "@/server/telemetry";
import { deleteOwnAccount } from "@/server/users/deactivate";
import { requireAuthContext } from "./common";

export type DeleteAccountResult = { ok: true } | { ok: false; message: string };

/**
 * Deletes the caller's login and deactivates their player. Their past scores
 * stay in everyone's games; with anonymize they show as "Former player".
 */
export async function deleteMyAccount(input: {
  anonymize: boolean;
}): Promise<DeleteAccountResult> {
  // Not "prismaId": a retry after a failed Clerk call finds the account
  // already deactivated and must still be able to finish.
  const { userId, posthog } = await requireAuthContext("user");
  const anonymize = input?.anonymize === true;

  try {
    await deleteOwnAccount(userId, { anonymize });
  } catch {
    console.error("Account deletion failed", { userId });
    return {
      ok: false,
      message: "We couldn't delete your account. Please try again.",
    };
  }

  captureServerEvent(posthog, {
    distinctId: userId,
    event: "delete_account",
    properties: { anonymized: anonymize },
  });
  return { ok: true };
}
