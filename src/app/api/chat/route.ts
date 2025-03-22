import { auth } from "@clerk/nextjs/server";
import { openai } from "@ai-sdk/openai";
import { streamText } from "ai";
import prisma from "@/server/db/db";
import { buildEnhancedSystemPrompt } from "@/server/ai/enhancedSystemPrompt";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  const { userId } = await auth();

  // Check authentication
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    // Parse the request body
    const { messages } = await req.json();

    // Get user information
    const user = await prisma.user.findUnique({
      where: { clerk_user_id: userId },
      select: { id: true, username: true },
    });

    if (!user) {
      return new Response("User not found", { status: 404 });
    }

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
      userId,
      user.username
    );

    // Prepare the messages array with the system prompt
    const fullMessages = [
      { role: "system", content: systemContent },
      ...messages,
    ];

    // Use the streamText helper from ai
    const result = streamText({
      model: openai("gpt-3.5-turbo"),
      messages: fullMessages,
    });

    // Return streaming response
    return result.toDataStreamResponse();
  } catch (error) {
    console.error("Error calling OpenAI:", error);
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
