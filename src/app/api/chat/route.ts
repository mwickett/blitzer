import { captureServerEvent } from "@/server/telemetry";
import { auth, currentUser } from "@clerk/nextjs/server";
import { openai } from "@ai-sdk/openai";
import { convertToModelMessages, streamText } from "ai";
import { withTracing } from "@posthog/ai";
import { buildEnhancedSystemPrompt } from "@/server/ai/enhancedSystemPrompt";
import { ChatInputError, readChatMessages } from "@/server/ai/chatMessages";
import { isLlmFeaturesEnabled } from "@/featureFlags";
import PostHogClient from "@/app/posthog";
import { INSIGHTS_MODEL } from "@/server/ai/model";

export const maxDuration = 30;

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  // Insights is a Circle feature, like the page that hosts this chat
  if (!(await auth()).orgId) {
    return Response.json({ error: "Join a Circle to use chat" }, { status: 403 });
  }
  if (!(await isLlmFeaturesEnabled())) {
    return Response.json({ error: "This feature is currently disabled" }, { status: 403 });
  }

  const posthog = PostHogClient();
  const recordError = (error: unknown) => {
    captureServerEvent(posthog, {
      distinctId: user.id,
      event: "llm_error",
      properties: { error_type: error instanceof Error ? error.name : "UnknownError" },
    });
  };

  try {
    const messages = await readChatMessages(req);
    if (!process.env.OPENAI_API_KEY) {
      return Response.json({ error: "Chat is temporarily unavailable" }, { status: 503 });
    }
    const system = await buildEnhancedSystemPrompt(user.id, user.username || "unknown");
    const model = withTracing(openai(INSIGHTS_MODEL), posthog, {
      posthogDistinctId: user.id,
      posthogPrivacyMode: true,
      posthogCaptureImmediate: true,
      posthogProperties: { message_count: messages.length },
    });
    const result = streamText({
      model,
      system,
      messages: await convertToModelMessages(messages),
      maxOutputTokens: 1024,
      abortSignal: req.signal,
      onError: ({ error }) => recordError(error),
    });
    return result.toUIMessageStreamResponse({
      onError: () => "Unable to finish the response. Please try again.",
    });
  } catch (error) {
    if (error instanceof ChatInputError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    recordError(error);
    return Response.json({ error: "Failed to generate response" }, { status: 500 });
  }
}
