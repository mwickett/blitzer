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

type SummaryStatus = "pending" | "ready" | "failed" | "insufficient_data";

function whereKey(gameId: string) {
  return { gameId_promptVersion: { gameId, promptVersion: PROMPT_VERSION } };
}

type UpsertExtra = {
  status: SummaryStatus;
  content?: string;
  model?: string;
  tokensUsed?: number;
};

async function upsertSummary(
  gameId: string,
  organizationId: string | null,
  hash: string,
  sourceUpdatedAt: Date,
  extra: UpsertExtra
): Promise<void> {
  await prisma.gameSummary.upsert({
    where: whereKey(gameId),
    create: {
      gameId,
      organizationId,
      promptVersion: PROMPT_VERSION,
      sourceStatsHash: hash,
      sourceUpdatedAt,
      ...extra,
    },
    update: { sourceStatsHash: hash, sourceUpdatedAt, error: null, ...extra },
  });
}

// Synchronous, in-request, primary DB. Guarantees a durable row exists before
// the response returns, so the sweep can always find work. Returns
// { enqueued: true } only when an LLM run is actually needed.
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

  if (
    facts.roundsPlayed < MIN_ROUNDS_FOR_SUMMARY ||
    facts.playerCount < MIN_PLAYERS_FOR_SUMMARY
  ) {
    await upsertSummary(gameId, facts.organizationId, hash, sourceUpdatedAt, {
      status: "insufficient_data",
    });
    return { enqueued: false };
  }

  await upsertSummary(gameId, facts.organizationId, hash, sourceUpdatedAt, {
    status: "pending",
  });
  return { enqueued: true };
}

// The LLM call. Idempotent (re-checks ready + hash before spending tokens) so
// it is safe to call from both the after() hook and the retry sweep.
export async function runGameSummary(gameId: string): Promise<void> {
  const game = (await getGameById(gameId)) as GameWithPlayersAndScores | null;
  if (!game) return;

  const { facts, playerNames } = buildGameRecap(game);
  const hash = hashRecapFacts(facts);
  const sourceUpdatedAt = latestSourceUpdatedAt(game);

  const existing = await prisma.gameSummary.findUnique({ where: whereKey(gameId) });
  if (existing?.status === "ready" && existing.sourceStatsHash === hash) return;

  if (
    facts.roundsPlayed < MIN_ROUNDS_FOR_SUMMARY ||
    facts.playerCount < MIN_PLAYERS_FOR_SUMMARY
  ) {
    await upsertSummary(gameId, facts.organizationId, hash, sourceUpdatedAt, {
      status: "insufficient_data",
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

    await upsertSummary(gameId, facts.organizationId, hash, sourceUpdatedAt, {
      status: "ready",
      content: rehydrateNames(text, nameMap),
      model: CLAUDE_SUMMARY_MODEL,
      tokensUsed,
    });
  } catch (err) {
    await prisma.gameSummary.update({
      where: whereKey(gameId),
      data: {
        status: "failed",
        error: err instanceof Error ? err.message : String(err),
        retryCount: { increment: 1 },
      },
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
