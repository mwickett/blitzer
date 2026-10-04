/** @jest-environment node */
import { auth } from "@clerk/nextjs/server";
import { deleteOwnAccount } from "../users/deactivate";
import { deleteMyAccount } from "../mutations/account";

const mockCapture = jest.fn();
jest.mock("@clerk/nextjs/server", () => ({ auth: jest.fn() }));
jest.mock("../users/deactivate", () => ({ deleteOwnAccount: jest.fn() }));
jest.mock("../db/db", () => ({ __esModule: true, default: {} }));
jest.mock("@/app/posthog", () => ({
  __esModule: true,
  default: () => ({ capture: mockCapture }),
}));
jest.mock("../telemetry", () => ({
  captureServerEvent: (_client: unknown, event: unknown) => mockCapture(event),
}));

beforeEach(() => {
  jest.clearAllMocks();
  (auth as unknown as jest.Mock).mockResolvedValue({ userId: "clerk-1" });
  jest.spyOn(console, "error").mockImplementation(() => {});
});

it("deletes the caller's own account and records only the choice", async () => {
  await expect(deleteMyAccount({ anonymize: true })).resolves.toEqual({ ok: true });
  expect(deleteOwnAccount).toHaveBeenCalledWith("clerk-1", { anonymize: true });
  expect(mockCapture).toHaveBeenCalledWith({
    distinctId: "clerk-1",
    event: "delete_account",
    properties: { anonymized: true },
  });
});

it("treats anything but true as keep my name", async () => {
  await deleteMyAccount({ anonymize: "yes" as unknown as boolean });
  expect(deleteOwnAccount).toHaveBeenCalledWith("clerk-1", { anonymize: false });
});

it("reports a failure without recording the event", async () => {
  (deleteOwnAccount as jest.Mock).mockRejectedValueOnce(new Error("clerk down"));
  await expect(deleteMyAccount({ anonymize: false })).resolves.toMatchObject({ ok: false });
  expect(mockCapture).not.toHaveBeenCalled();
});

it("requires a signed-in caller", async () => {
  (auth as unknown as jest.Mock).mockResolvedValue({ userId: null });
  await expect(deleteMyAccount({ anonymize: false })).rejects.toThrow("Unauthorized");
  expect(deleteOwnAccount).not.toHaveBeenCalled();
});
