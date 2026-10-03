import { auth } from "@clerk/nextjs/server";
import { openai } from "@ai-sdk/openai";
import { withTracing } from "@posthog/ai";
import PostHogClient from "@/app/posthog";
import { isLlmFeaturesEnabled } from "@/featureFlags";
import { writeRoundRecap } from "@/server/ai/roundRecap";
import { INSIGHTS_MODEL } from "@/server/ai/model";
import { getGameById } from "@/server/queries/games";
import { getRosterHistory } from "@/server/queries/rosterHistory";
import { assertGameScoringAccess } from "@/server/scoring/access";
import { captureServerEvent } from "@/server/telemetry";

export const maxDuration = 30;

/** Between-rounds recap for the people at the table; read aloud by the client. */
export async function POST(req: Request, context: { params: Promise<{ gameId: string }> }) {
  const { userId, orgId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });
  if (!(await isLlmFeaturesEnabled())) {
    return Response.json({ error: "This feature is currently disabled" }, { status: 403 });
  }

  const { gameId } = await context.params;
  const game = await getGameById(gameId);
  try {
    assertGameScoringAccess(game, { userId, orgId: orgId ?? undefined });
  } catch {
    return Response.json({ error: "Game not found" }, { status: 404 });
  }
  if (game.isFinished || !game.rounds.length) {
    return Response.json({ error: "Recaps are available between rounds" }, { status: 409 });
  }
  if (!process.env.OPENAI_API_KEY) {
    return Response.json({ error: "Recaps are temporarily unavailable" }, { status: 503 });
  }

  const posthog = PostHogClient();
  try {
    const participantIds = game.players
      .map((player) => player.userId ?? player.guestId)
      .filter((id): id is string => Boolean(id));
    const history = await getRosterHistory(game.id, participantIds);
    const text = await writeRoundRecap(game, history, {
      abortSignal: req.signal,
      model: withTracing(openai(INSIGHTS_MODEL), posthog, {
        posthogDistinctId: userId,
        posthogPrivacyMode: true,
        posthogCaptureImmediate: true,
        posthogProperties: { feature: "round_recap", round_count: game.rounds.length },
      }),
    });
    if (!text) return Response.json({ error: "Nothing to recap yet" }, { status: 409 });
    return Response.json({ text });
  } catch (error) {
    captureServerEvent(posthog, {
      distinctId: userId,
      event: "llm_error",
      properties: { feature: "round_recap", error_type: error instanceof Error ? error.name : "UnknownError" },
    });
    return Response.json({ error: "Couldn't write a recap. Please try again." }, { status: 500 });
  }
}
