/** @jest-environment node */
import {
  sendGameCompleteEmail,
  sendWelcomeEmail,
  EMAIL_MAX_RETRY_ATTEMPTS,
  EMAIL_RETRY_BASE_DELAY_MS,
} from "../email";

const mockSend = jest.fn();
const mockCapture = jest.fn();
jest.mock("resend", () => ({ Resend: jest.fn(() => ({ emails: { send: (...args: unknown[]) => mockSend(...args) } })) }));
jest.mock("@/app/posthog", () => ({ __esModule: true, default: () => ({ capture: (...args: unknown[]) => mockCapture(...args) }) }));
jest.mock("@/components/email/game-complete-template", () => ({ GameCompleteEmail: () => ({ component: null, text: Promise.resolve("fixture") }) }));
jest.mock("@/components/email/welcome-template", () => ({ WelcomeEmail: () => ({ component: null, text: Promise.resolve("fixture") }) }));

const recipient = {
  email: "player@example.invalid", username: "Private player name", winnerUsername: "Private winner name",
  isWinner: false, gameId: "fixture-game", userId: "fixture-clerk-user",
};

test("email delivery keeps destination/content private while recording outcome", async () => {
  mockSend.mockResolvedValueOnce({ data: { id: "message-id" }, error: null });
  expect(await sendGameCompleteEmail(recipient)).toEqual({ success: true });
  expect(mockSend.mock.calls[0][0].to).toEqual([recipient.email]);
  const events = JSON.stringify(mockCapture.mock.calls);
  expect(events).toContain("email_send_success");
  expect(events).not.toMatch(/player@example|Private player|Private winner/);
});

test("provider failures report a category without copying an address from its error message", async () => {
  const log = jest.spyOn(console, "error").mockImplementation(() => {});
  mockCapture.mockClear();
  mockSend.mockResolvedValueOnce({ error: { name: "validation_error", message: `Rejected ${recipient.email}` } });
  expect((await sendGameCompleteEmail(recipient)).success).toBe(false);
  const events = JSON.stringify(mockCapture.mock.calls);
  expect(events).toContain("validation_error");
  expect(events).not.toContain(recipient.email);
  log.mockRestore();
});

describe("retries", () => {
  const events = () => mockCapture.mock.calls.map(([event]) => event);
  let log: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    mockSend.mockReset();
    mockCapture.mockClear();
    log = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.useRealTimers();
    log.mockRestore();
  });

  /** Resolve the send while advancing through each retry back-off. */
  async function settle<T>(promise: Promise<T>) {
    for (let i = 0; i < EMAIL_MAX_RETRY_ATTEMPTS; i++) {
      await jest.advanceTimersByTimeAsync(
        EMAIL_RETRY_BASE_DELAY_MS * EMAIL_MAX_RETRY_ATTEMPTS,
      );
    }
    return promise;
  }

  test("a provider rate limit backs off and succeeds on a later attempt", async () => {
    mockSend
      .mockResolvedValueOnce({ error: { name: "rate_limit_exceeded", message: "slow down" } })
      .mockResolvedValueOnce({ data: { id: "message-id" }, error: null });

    expect(await settle(sendGameCompleteEmail(recipient))).toEqual({ success: true });

    expect(mockSend).toHaveBeenCalledTimes(2);
    expect(events().map((e) => e.event)).toEqual([
      "email_rate_limit_hit",
      "email_retry_attempt",
      "email_send_success",
    ]);
    expect(events()[1].properties).toMatchObject({
      attemptNumber: 2,
      delay: EMAIL_RETRY_BASE_DELAY_MS * 2,
    });
    expect(events()[2].properties).toMatchObject({ attemptNumber: 2, emailId: "message-id" });
  });

  test("a provider rate limit gives up after the maximum attempts", async () => {
    mockSend.mockResolvedValue({ error: { name: "rate_limit_exceeded", message: "slow down" } });

    expect(await settle(sendGameCompleteEmail(recipient))).toEqual({
      success: false,
      error: "slow down",
    });

    expect(mockSend).toHaveBeenCalledTimes(EMAIL_MAX_RETRY_ATTEMPTS);
    const final = events().at(-1);
    expect(final).toMatchObject({
      event: "email_send_failed",
      properties: {
        errorName: "rate_limit_exceeded",
        attemptNumber: EMAIL_MAX_RETRY_ATTEMPTS,
        reason: "rate_limit_exceeded_max_retries",
      },
    });
  });

  test("a thrown rate-limit error retries and reports it as an exception", async () => {
    mockSend
      .mockRejectedValueOnce(new Error("too many requests"))
      .mockResolvedValueOnce({ data: { id: "message-id" }, error: null });

    expect(await settle(sendGameCompleteEmail(recipient))).toEqual({ success: true });
    expect(events()[0]).toMatchObject({
      event: "email_rate_limit_hit",
      properties: { attemptNumber: 1, errorType: "exception" },
    });
  });

  test("thrown rate-limit errors give up after the maximum attempts", async () => {
    mockSend.mockRejectedValue(new Error("rate_limit"));

    expect(await settle(sendGameCompleteEmail(recipient))).toEqual({
      success: false,
      error: "rate_limit",
    });
    expect(mockSend).toHaveBeenCalledTimes(EMAIL_MAX_RETRY_ATTEMPTS);
    expect(events().at(-1)).toMatchObject({
      event: "email_send_failed",
      properties: { reason: "rate_limit_exception_max_retries", errorType: "exception" },
    });
  });

  test("other thrown errors fail at once without retrying", async () => {
    mockSend.mockRejectedValue(new Error("socket hang up"));

    expect(await settle(sendGameCompleteEmail(recipient))).toEqual({
      success: false,
      error: "socket hang up",
    });
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(events()).toEqual([
      expect.objectContaining({
        event: "email_send_failed",
        properties: expect.objectContaining({ reason: "unexpected_exception" }),
      }),
    ]);
  });

  test("other provider errors fail at once without retrying", async () => {
    mockSend.mockResolvedValue({ error: { name: "validation_error", message: "bad" } });

    await settle(sendGameCompleteEmail(recipient));
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(events()).toEqual([
      expect.objectContaining({
        event: "email_send_failed",
        properties: expect.objectContaining({ reason: "resend_api_error" }),
      }),
    ]);
  });
});

describe("idempotency keys", () => {
  beforeEach(() => {
    mockSend.mockReset();
    mockSend.mockResolvedValue({ data: { id: "message-id" }, error: null });
  });
  const keyOf = (call: number) => mockSend.mock.calls[call][1].idempotencyKey as string;

  test("game-complete keys are stable per game and recipient, and opaque", async () => {
    await sendGameCompleteEmail(recipient);
    await sendGameCompleteEmail({ ...recipient, isWinner: true });
    await sendGameCompleteEmail({ ...recipient, email: "other@example.invalid" });
    await sendGameCompleteEmail({ ...recipient, gameId: "other-game" });

    expect(keyOf(0)).toMatch(/^game-complete\/[0-9a-f]{32}$/);
    expect(keyOf(1)).toBe(keyOf(0));
    expect(keyOf(2)).not.toBe(keyOf(0));
    expect(keyOf(3)).not.toBe(keyOf(0));
    expect(keyOf(0)).not.toContain("player@");
  });

  test("winners get a congratulations subject and others hear who won", async () => {
    await sendGameCompleteEmail({ ...recipient, isWinner: true });
    await sendGameCompleteEmail(recipient);
    expect(mockSend.mock.calls[0][0].subject).toBe("Congratulations on your win! 🎉");
    expect(mockSend.mock.calls[1][0].subject).toBe(
      "Game Complete - Private winner name won!",
    );
  });

  test("welcome emails key on the Clerk user, falling back to the address", async () => {
    await sendWelcomeEmail({ email: "new@example.invalid", username: "new", userId: "user_1" });
    await sendWelcomeEmail({ email: "changed@example.invalid", username: "new", userId: "user_1" });
    await sendWelcomeEmail({ email: "new@example.invalid", username: "new" });

    expect(keyOf(0)).toMatch(/^welcome-email\/[0-9a-f]{32}$/);
    expect(keyOf(1)).toBe(keyOf(0));
    expect(keyOf(2)).not.toBe(keyOf(0));
    expect(mockSend.mock.calls[0][0]).toMatchObject({
      to: ["new@example.invalid"],
      subject: "Welcome to Blitzer!",
    });
  });
});
