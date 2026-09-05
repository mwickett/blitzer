import { z } from "zod";

const maxBodyBytes = 64 * 1024;
const messageSchema = z.object({
  id: z.string().min(1).max(200),
  role: z.enum(["user", "assistant"]),
  parts: z.array(z.discriminatedUnion("type", [
    z.object({ type: z.literal("text"), text: z.string().max(8000) }),
    z.object({ type: z.literal("step-start") }),
  ])).max(16),
});
const historySchema = z.object({ messages: z.array(messageSchema).min(1).max(40) })
  .refine(({ messages }) => messages.at(-1)?.role === "user", "The last message must be from the user")
  .refine(({ messages }) => messages.reduce((size, message) => size + message.parts.reduce(
    (total, part) => total + (part.type === "text" ? part.text.length : 0), 0,
  ), 0) <= 32_000, "Conversation is too long")
  .refine(({ messages }) => messages.every((message) => message.role === "assistant" || message.parts.some(
    (part) => part.type === "text" && part.text.trim().length > 0,
  )), "Every user message must contain text");

export class ChatInputError extends Error {
  constructor(message: string, public readonly status: 400 | 413 = 400) {
    super(message);
  }
}

export async function readChatMessages(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new ChatInputError("Messages are required");
  let size = 0;
  let body = "";
  const decoder = new TextDecoder();
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBodyBytes) {
        await reader.cancel();
        throw new ChatInputError("Conversation is too large. Start a new chat.", 413);
      }
      body += decoder.decode(value, { stream: true });
    }
    body += decoder.decode();
  } finally {
    reader.releaseLock();
  }
  let parsed: unknown;
  try { parsed = JSON.parse(body); } catch {
    throw new ChatInputError("Invalid JSON request");
  }
  const result = historySchema.safeParse(parsed);
  if (!result.success) throw new ChatInputError("Send up to 40 text messages within the conversation limit.");
  // Interrupted streams can leave an assistant placeholder with no text in
  // the SDK's history. It has no model context, but must not poison later turns.
  return result.data.messages.filter((message) => message.parts.some(
    (part) => part.type === "text" && part.text.trim().length > 0,
  ));
}
