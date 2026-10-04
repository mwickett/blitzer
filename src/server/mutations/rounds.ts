"use server";

import { captureServerEvent } from "@/server/telemetry";

import { after } from "next/server";
import prisma from "@/server/db/db";
import { assertAccountActive, requireAuthContext } from "./common";
import { writeRound } from "../scoring/writeRound";
import { sendGameCompleteEmail, EMAIL_INTER_SEND_DELAY_MS } from "../email";
import { isFeatureEnabledForUser } from "@/featureFlags";
import { tellGameStory, tellPersonalGameStory } from "../ai/gameStory";
import { getGameById } from "../queries/games";
import type { SubmittedScore } from "@/lib/validation/submissions";

const PERSONAL_STORY_TIMEOUT_MS = 15_000;

async function submit(input: unknown) {
  const { userId, user, posthog } = await requireAuthContext("user");
  await assertAccountActive(userId);
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
        player.user && !player.user.deactivatedAt ? [player.user] : [],
      );
      const guestNames = transition.players.flatMap((player) =>
        player.guestUser ? [player.guestUser.name] : [],
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
      let game: Awaited<ReturnType<typeof getGameById>> = null;
      if (wantsStory.some(Boolean)) {
        const loaded = await getGameById(transition.gameId).catch(() => null);
        // A correction may land before this runs; skip the story unless the
        // game still has the winner this email announces.
        if (loaded?.isFinished && loaded.winnerId === transition.winnerId) {
          game = loaded;
          story = (await tellGameStory(game, userId, "game_email"))?.story;
        }
      }
      // Players with their own style get a personal version, written in
      // parallel and time-boxed so slow generations can't hold up delivery.
      // Any failure falls back to the shared story.
      const storyGame = game;
      const timeout = AbortSignal.timeout(PERSONAL_STORY_TIMEOUT_MS);
      const personalStories = await Promise.all(
        recipients.map((recipient, index) =>
          storyGame && wantsStory[index] && recipient.storyPrompt
            ? tellPersonalGameStory(
                storyGame,
                { participantId: recipient.id, stylePrompt: recipient.storyPrompt },
                recipient.clerk_user_id,
                timeout,
              )
            : null,
        ),
      );
      // Re-read just before sending: a player who deleted their account since
      // the score was saved (flag checks and the story take a while) gets no mail.
      const stillActive = new Set(
        (
          await prisma.user.findMany({
            where: {
              id: { in: recipients.map((recipient) => recipient.id) },
              deactivatedAt: null,
            },
            select: { id: true },
          })
        ).map((recipient) => recipient.id),
      );
      let failed = 0;
      for (const [index, recipient] of recipients.entries()) {
        if (!stillActive.has(recipient.id)) continue;
        try {
          const personal = personalStories[index];
          const sent = await sendGameCompleteEmail({
            email: recipient.email,
            username: recipient.username,
            winnerUsername: winnerName,
            isWinner: recipient.id === transition.winnerId,
            gameId: transition.gameId,
            userId: recipient.clerk_user_id,
            story: wantsStory[index] ? (personal ?? story) : undefined,
            guestNames,
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
          recipient_count: stillActive.size,
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
