/** @jest-environment node */
import { sendGameCompleteEmail } from "../email";

const mockSend = jest.fn();
const mockCapture = jest.fn();
jest.mock("resend", () => ({ Resend: jest.fn(() => ({ emails: { send: (...args: unknown[]) => mockSend(...args) } })) }));
jest.mock("@/app/posthog", () => ({ __esModule: true, default: () => ({ capture: (...args: unknown[]) => mockCapture(...args) }) }));
jest.mock("@/components/email/game-complete-template", () => ({ GameCompleteEmail: () => ({ component: null, text: Promise.resolve("fixture") }) }));

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
