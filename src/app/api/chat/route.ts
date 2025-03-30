import { currentUser } from "@clerk/nextjs/server";
import { openai } from "@ai-sdk/openai";
import { streamText } from "ai";
import { withTracing } from "@posthog/ai";
import { buildEnhancedSystemPrompt } from "@/server/ai/enhancedSystemPrompt";
import { isLlmFeaturesEnabled } from "@/featureFlags";
import PostHogClient from "@/app/posthog";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  const user = await currentUser();

  // Check authentication
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Check feature flag
  const llmFeaturesEnabled = await isLlmFeaturesEnabled();

  if (!llmFeaturesEnabled) {
    return new Response(
      JSON.stringify({ error: "This feature is currently disabled" }),
      {
        status: 403,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  try {
    // Parse the request body
    const { messages } = await req.json();

    // Check if API key is configured
    const hasApiKey =
      process.env.OPENAI_API_KEY &&
      process.env.OPENAI_API_KEY !== "sk-your-openai-api-key";

    if (!hasApiKey) {
      return new Response(
        JSON.stringify({
          error:
            "OpenAI API key not configured. Please add your API key to the .env file.",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Build enhanced system prompt with user data and include as system message
    const systemContent = await buildEnhancedSystemPrompt(
      user.id,
      user?.username || "unknown"
    );

    // Prepare the messages array with the system prompt
    const fullMessages = [
      { role: "system", content: systemContent },
      ...messages,
    ];

    // Get conversation context for tracking
    const conversationId = `chat_${user.id}_${Date.now()}`;
    const messageCount = messages.length;

    // Define message part interface
    interface MessagePart {
      type: string;
      text?: string;
    }

    // Extract first user message for topic
    const firstUserMessage =
      messages.length > 0 && messages[0].parts
        ? messages[0].parts
            .filter((p: MessagePart) => p.type === "text")
            .map((p: MessagePart) => p.text || "")
            .join(" ")
            .substring(0, 100)
        : "No user message";

    // Get PostHog client
    const posthogClient = PostHogClient();

    // Create a traced OpenAI model
    const tracedModel = withTracing(openai("gpt-3.5-turbo"), posthogClient, {
      posthogDistinctId: user.id,
      posthogProperties: {
        username: user.username,
        user_id: user.id,
        conversation_id: conversationId,
        message_count: messageCount,
        topic: firstUserMessage,
      },
    });

    // Use the streamText helper from ai with traced model
    const result = streamText({
      model: tracedModel,
      messages: fullMessages,
    });

    // We'll let the posthog client manage its own lifecycle
    // The tracing happens asynchronously and doesn't require
    // immediate shutdown of the client

    // Return streaming response
    return result.toDataStreamResponse();
  } catch (error) {
    console.error("Error calling OpenAI:", error);

    // For errors, we still capture the error event
    const posthogClient = PostHogClient();
    posthogClient.capture({
      distinctId: user.id,
      event: "llm_error",
      properties: {
        error_message: error instanceof Error ? error.message : String(error),
        error_type:
          error instanceof Error ? error.constructor.name : typeof error,
      },
    });

    return new Response(
      JSON.stringify({ error: "Failed to generate response" }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }
}
