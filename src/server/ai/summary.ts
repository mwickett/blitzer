import prisma from "@/server/db/db";
import { after } from "next/server";
import { getGameById } from "@/server/queries/games";
import type { GameWithPlayersAndScores } from "@/lib/gameLogic";
import { isLlmFeaturesEnabled } from "@/featureFlags";
import {
  buildGameRecap,
  latestSourceUpdatedAt,
  MIN_ROUNDS_FOR_SUMMARY,
  MIN_PLAYERS_FOR_SUMMARY,
} from "@/lib/insights/gameRecap";
import { hashRecapFacts } from "@/lib/insights/recapHash";
import { pseudonymizeRecap, rehydrateNames } from "@/lib/insights/pseudonymize";
import {
  buildSummaryPrompt,
  PROMPT_VERSION,
  DEFAULT_SUMMARY_OPTIONS,
} from "@/lib/insights/summaryPrompt";
import { findUngroundedNumbers } from "@/lib/insights/grounding";
import { generateSummaryText, CLAUDE_SUMMARY_MODEL } from "./claude";

const MAX_RETRIES = 5;

function whereKey(gameId: string) {
  return { gameId_promptVersion: { gameId, promptVersion: PROMPT_VERSION } };
}

// Enqueue (in-request) owns the pending row via upsert. It resets the retry
// budget whenever the source hash changes, so new work after a score edit is
// always sweepable even if the previous hash exhausted its retries.
async function upsertPending(
  gameId: string,
  organizationId: string | null,
  hash: string,
  sourceUpdatedAt: Date,
  status: "pending" | "insufficient_data",
  isNewHash: boolean
): Promise<void> {
  await prisma.gameSummary.upsert({
    where: whereKey(gameId),
    create: {
      gameId,
      organizationId,
      promptVersion: PROMPT_VERSION,
      sourceStatsHash: hash,
      sourceUpdatedAt,
      status,
    },
    update: {
      sourceStatsHash: hash,
      sourceUpdatedAt,
      status,
      error: null,
      ...(isNewHash ? { retryCount: 0 } : {}),
    },
  });
}

type RunData =
  | { status: "ready"; content: string; model: string; tokensUsed: number; error: null }
  | { status: "failed"; error: string; retryCount: { increment: number } }
  | { status: "insufficient_data"; error: null };

// A run only persists its result if the row STILL carries the hash this run
// generated for. If a newer enqueue (e.g. a mid-generation score edit) changed
// the hash, this stale result is discarded and the newer pending row survives
// for its own run / the sweep.
async function writeRunResult(
  gameId: string,
  hash: string,
  data: RunData
): Promise<void> {
  await prisma.gameSummary.updateMany({
    where: { gameId, promptVersion: PROMPT_VERSION, sourceStatsHash: hash },
    data,
  });
}

// Synchronous, in-request, primary DB. Guarantees a durable row exists before
// the response returns. Returns { enqueued: true } only when an LLM run is
// actually needed.
export async function enqueueGameSummary(
  gameId: string
): Promise<{ enqueued: boolean }> {
  const game = (await getGameById(gameId)) as GameWithPlayersAndScores | null;
  if (!game) return { enqueued: false };

  const { facts } = buildGameRecap(game);
  const hash = hashRecapFacts(facts);
  const sourceUpdatedAt = latestSourceUpdatedAt(game);

  const existing = await prisma.gameSummary.findUnique({ where: whereKey(gameId) });
  if (existing?.status === "ready" && existing.sourceStatsHash === hash) {
    return { enqueued: false };
  }
  const isNewHash = !existing || existing.sourceStatsHash !== hash;

  if (
    facts.roundsPlayed < MIN_ROUNDS_FOR_SUMMARY ||
    facts.playerCount < MIN_PLAYERS_FOR_SUMMARY
  ) {
    await upsertPending(
      gameId,
      facts.organizationId,
      hash,
      sourceUpdatedAt,
      "insufficient_data",
      isNewHash
    );
    return { enqueued: false };
  }

  await upsertPending(
    gameId,
    facts.organizationId,
    hash,
    sourceUpdatedAt,
    "pending",
    isNewHash
  );
  return { enqueued: true };
}

// The LLM call. Idempotent (skips when a ready summary already matches the
// hash) and race-safe (terminal writes are conditional on the hash). Safe to
// call from both the after() hook and the retry sweep.
export async function runGameSummary(gameId: string): Promise<void> {
  const game = (await getGameById(gameId)) as GameWithPlayersAndScores | null;
  if (!game) return;

  const { facts, playerNames } = buildGameRecap(game);
  const hash = hashRecapFacts(facts);

  const existing = await prisma.gameSummary.findUnique({ where: whereKey(gameId) });
  if (existing?.status === "ready" && existing.sourceStatsHash === hash) return;

  if (
    facts.roundsPlayed < MIN_ROUNDS_FOR_SUMMARY ||
    facts.playerCount < MIN_PLAYERS_FOR_SUMMARY
  ) {
    await writeRunResult(gameId, hash, {
      status: "insufficient_data",
      error: null,
    });
    return;
  }

  try {
    const { promptFacts, nameMap } = pseudonymizeRecap(facts, playerNames);
    const { system, user } = buildSummaryPrompt(
      promptFacts,
      DEFAULT_SUMMARY_OPTIONS
    );
    const { text, tokensUsed } = await generateSummaryText(system, user);

    const ungrounded = findUngroundedNumbers(text, promptFacts);
    if (ungrounded.length) {
      console.warn(
        `[insights] ungrounded numbers in summary ${gameId}:`,
        ungrounded
      );
    }

    await writeRunResult(gameId, hash, {
      status: "ready",
      content: rehydrateNames(text, nameMap),
      model: CLAUDE_SUMMARY_MODEL,
      tokensUsed,
      error: null,
    });
  } catch (err) {
    await writeRunResult(gameId, hash, {
      status: "failed",
      error: err instanceof Error ? err.message : String(err),
      retryCount: { increment: 1 },
    });
  }
}

// Flag-gated entry point used by the game-finish paths. Writes the durable
// pending row synchronously, then runs the LLM after the response is sent.
export async function scheduleGameSummary(gameId: string): Promise<void> {
  if (!(await isLlmFeaturesEnabled())) return;
  const { enqueued } = await enqueueGameSummary(gameId);
  if (enqueued) after(() => runGameSummary(gameId));
}

// Durability sweep — wire to a cron route. Retries rows that never reached
// `ready`. Idempotent per game.
export async function regeneratePendingSummaries(limit = 20): Promise<number> {
  const stuck = await prisma.gameSummary.findMany({
    where: {
      status: { in: ["pending", "failed"] },
      retryCount: { lt: MAX_RETRIES },
    },
    take: limit,
  });
  for (const s of stuck) await runGameSummary(s.gameId);
  return stuck.length;
}
