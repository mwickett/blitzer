"use server";

import { captureServerEvent } from "@/server/telemetry";

import { after } from "next/server";
import prisma from "@/server/db/db";
import { requireAuthContext } from "./common";
import { writeRound } from "../scoring/writeRound";
import { sendGameCompleteEmail, EMAIL_INTER_SEND_DELAY_MS } from "../email";
import type { SubmittedScore } from "@/lib/validation/submissions";

async function submit(input: unknown) {
  const { userId, user, posthog } = await requireAuthContext("user");
  const result = await writeRound(
    prisma,
    { userId, orgId: user.orgId ?? undefined },
    input,
  );
  if (!result.ok) return result;

  const { transition, round } = result;
  if (transition) {
    captureServerEvent(posthog, {
      distinctId: userId,
      event:
        transition.kind === "finished"
          ? "update_game_as_finished"
          : "game_reopened_after_edit",
      properties: { game_id: transition.gameId },
    });
  }
  if (transition?.kind === "finished") {
    const winner = transition.players.find(
      (player) => (player.userId ?? player.guestId) === transition.winnerId,
    );
    const winnerName =
      winner?.user?.username ?? winner?.guestUser?.name ?? "Winner";
    // Corrections to a finished game never reschedule. Recompletion can retry
    // delivery; the provider's game+recipient key deduplicates within its
    // retention window. This does not promise permanent once-only delivery.
    after(async () => {
      const recipients = transition.players.flatMap((player) =>
        player.user ? [player.user] : [],
      );
      let failed = 0;
      for (const [index, recipient] of recipients.entries()) {
        try {
          const sent = await sendGameCompleteEmail({
            email: recipient.email,
            username: recipient.username,
            winnerUsername: winnerName,
            isWinner: recipient.id === transition.winnerId,
            gameId: transition.gameId,
            userId: recipient.clerk_user_id,
          });
          if (!sent.success) failed++;
        } catch {
          failed++;
        }
        if (index < recipients.length - 1)
          await new Promise((resolve) =>
            setTimeout(resolve, EMAIL_INTER_SEND_DELAY_MS),
          );
      }
      captureServerEvent(posthog, {
        distinctId: userId,
        event: "email_batch_completed",
        properties: {
          game_id: transition.gameId,
          recipient_count: recipients.length,
          failed_count: failed,
        },
      });
    });
  }
  return { ok: true as const, round };
}

export async function createRoundForGame(
  gameId: string,
  roundNumber: number,
  scores: SubmittedScore[],
) {
  return submit({ kind: "create", gameId, roundNumber, scores });
}

export async function updateRoundScores(
  gameId: string,
  roundId: string,
  scores: SubmittedScore[],
  expectedRevision: number,
) {
  return submit({ kind: "edit", gameId, roundId, scores, expectedRevision });
}
