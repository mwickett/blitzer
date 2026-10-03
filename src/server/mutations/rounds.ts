"use server";

import { captureServerEvent } from "@/server/telemetry";

import { after } from "next/server";
import prisma from "@/server/db/db";
import { requireAuthContext } from "./common";
import { writeRound } from "../scoring/writeRound";
import { sendGameCompleteEmail, EMAIL_INTER_SEND_DELAY_MS } from "../email";
import { isFeatureEnabledForUser } from "@/featureFlags";
import { tellGameStory } from "../ai/gameStory";
import { getGameById } from "../queries/games";
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
      // Players who deleted their account no longer get mail.
      const recipients = transition.players.flatMap((player) =>
        player.user && !player.user.deactivatedAt ? [player.user] : [],
      );
      // The story is written once here, after the response, and only when a
      // recipient has llm-features; it is also cached for the game page.
      const wantsStory = await Promise.all(
        recipients.map((recipient) =>
          isFeatureEnabledForUser("llm-features", {
            clerkUserId: recipient.clerk_user_id,
            email: recipient.email,
            username: recipient.username,
          }),
        ),
      );
      let story: string | undefined;
      if (wantsStory.some(Boolean)) {
        const game = await getGameById(transition.gameId).catch(() => null);
        // A correction may land before this runs; skip the story unless the
        // game still has the winner this email announces.
        story =
          game?.isFinished && game.winnerId === transition.winnerId
            ? (await tellGameStory(game, userId, "game_email"))?.story
            : undefined;
      }
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
            story: wantsStory[index] ? story : undefined,
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
