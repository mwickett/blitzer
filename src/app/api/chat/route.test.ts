/** @jest-environment node */
import { MockLanguageModelV3 } from "ai/test";
import { DefaultChatTransport } from "ai";
import { Chat } from "@ai-sdk/react";
import { POST } from "./route";

let mockModel: MockLanguageModelV3;
const mockCapture = jest.fn();
const mockCurrentUser = jest.fn();
const mockEnabled = jest.fn();
const mockPrompt = jest.fn();
jest.mock("@clerk/nextjs/server", () => ({ currentUser: () => mockCurrentUser() }));
jest.mock("@/featureFlags", () => ({ isLlmFeaturesEnabled: () => mockEnabled() }));
jest.mock("@/server/ai/enhancedSystemPrompt", () => ({ buildEnhancedSystemPrompt: (...args: unknown[]) => mockPrompt(...args) }));
jest.mock("@ai-sdk/openai", () => ({ openai: () => mockModel }));
jest.mock("@posthog/ai", () => ({ withTracing: (model: unknown) => model }));
jest.mock("@/app/posthog", () => ({ __esModule: true, default: () => ({ capture: mockCapture }) }));

const userMessage = { id: "user-1", role: "user", parts: [{ type: "text", text: "How many games?" }] };
const request = (body: unknown) => new Request("https://example.invalid/api/chat", { method: "POST", body: JSON.stringify(body) });

beforeEach(() => {
  jest.clearAllMocks();
  process.env.OPENAI_API_KEY = "test-only";
  mockCurrentUser.mockResolvedValue({ id: "test-user", username: "tester" });
  mockEnabled.mockResolvedValue(true);
  mockPrompt.mockResolvedValue("Use this user's game statistics.");
  mockModel = new MockLanguageModelV3({ doStream: {
    stream: new ReadableStream({ start(controller) {
      controller.enqueue({ type: "text-start", id: "text-1" });
      controller.enqueue({ type: "text-delta", id: "text-1", delta: "Three games." });
      controller.enqueue({ type: "text-end", id: "text-1" });
      controller.enqueue({ type: "finish", finishReason: { unified: "stop", raw: "stop" }, usage: {
        inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
        outputTokens: { total: 1, text: 1, reasoning: 0 },
      } });
      controller.close();
    } }),
  } });
});

test("actual SDK converts UI transport messages and streams a provider response", async () => {
  const response = await POST(request({ messages: [userMessage] }));
  expect(response.status).toBe(200);
  expect(await response.text()).toContain("Three games.");
  expect(mockModel.doStreamCalls).toHaveLength(1);
  expect(mockModel.doStreamCalls[0].prompt).toEqual([
    { role: "system", content: "Use this user's game statistics." },
    { role: "user", content: [{ type: "text", text: "How many games?" }] },
  ]);
  expect(mockModel.doStreamCalls[0].maxOutputTokens).toBe(1024);
});

test("accepts assistant text and step boundaries from previous streamed turns", async () => {
  const response = await POST(request({ messages: [userMessage,
    { id: "answer", role: "assistant", parts: [{ type: "step-start" }, { type: "text", text: "Three." }] },
    { ...userMessage, id: "user-2" },
  ] }));
  expect(await response.text()).toContain("Three games.");
  expect(mockModel.doStreamCalls).toHaveLength(1);
});

test.each([
  { messages: [] },
  { messages: [{ ...userMessage, role: "system" }] },
  { messages: [{ ...userMessage, parts: [{ type: "file", url: "https://example.invalid" }] }] },
  { messages: [{ ...userMessage, parts: [{ type: "text", text: 10 }] }] },
  { messages: [{ ...userMessage, parts: [] }] },
  { messages: [{ ...userMessage, parts: [{ type: "text", text: "   " }] }] },
  { messages: Array.from({ length: 41 }, () => userMessage) },
])("rejects malformed or unsupported history before fetching private context: %p", async (body) => {
  expect((await POST(request(body))).status).toBe(400);
  expect(mockPrompt).not.toHaveBeenCalled();
  expect(mockModel.doStreamCalls).toHaveLength(0);
});

test("rejects malformed JSON and oversized chunked requests", async () => {
  expect((await POST(new Request("https://example.invalid", { method: "POST", body: "{" }))).status).toBe(400);
  expect((await POST(request({ messages: [{ ...userMessage, parts: [{ type: "text", text: "x".repeat(70_000) }] }] }))).status).toBe(413);
  expect(mockPrompt).not.toHaveBeenCalled();
});

test("auth and feature checks prevent provider calls", async () => {
  mockCurrentUser.mockResolvedValueOnce(null);
  expect((await POST(request({ messages: [userMessage] }))).status).toBe(401);
  mockEnabled.mockResolvedValueOnce(false);
  expect((await POST(request({ messages: [userMessage] }))).status).toBe(403);
  expect(mockModel.doStreamCalls).toHaveLength(0);
});

test("asynchronous stream errors are recorded and expose a safe retry message", async () => {
  mockModel = new MockLanguageModelV3({ doStream: {
    stream: new ReadableStream({ pull(controller) {
      controller.enqueue({ type: "error", error: new Error("private provider detail") });
      controller.close();
    } }),
  } });
  const response = await POST(request({ messages: [userMessage] }));
  const text = await response.text();
  expect(text).toContain("Unable to finish the response. Please try again.");
  expect(text).not.toContain("private provider detail");
  expect(mockCapture).toHaveBeenCalledWith(expect.objectContaining({ event: "llm_error" }));
});

test("actual chat transport can send another turn after the provider fails before producing text", async () => {
  const successfulModel = mockModel;
  mockModel = new MockLanguageModelV3({ doStream: {
    stream: new ReadableStream({ start(controller) {
      controller.enqueue({ type: "text-start", id: "empty-text" });
      controller.enqueue({ type: "error", error: new Error("provider interrupted") });
      controller.close();
    } }),
  } });
  const statuses: number[] = [];
  const chat = new Chat({ transport: new DefaultChatTransport({
    api: "https://example.invalid/api/chat",
    fetch: async (input, init) => {
      const response = await POST(new Request(input, init));
      statuses.push(response.status);
      return response;
    },
  }) });
  await chat.sendMessage({ text: "How many games?" });
  expect(chat.status).toBe("error");
  mockModel = successfulModel;
  await chat.sendMessage({ text: "Please try again." });
  expect(statuses).toEqual([200, 200]);
  expect(chat.status).toBe("ready");
  expect(successfulModel.doStreamCalls[0].prompt).toEqual([
    { role: "system", content: "Use this user's game statistics." },
    { role: "user", content: [{ type: "text", text: "How many games?" }] },
    { role: "user", content: [{ type: "text", text: "Please try again." }] },
  ]);
  expect(chat.messages.at(-1)?.parts).toEqual(expect.arrayContaining([
    expect.objectContaining({ type: "text", text: "Three games." }),
  ]));
});
