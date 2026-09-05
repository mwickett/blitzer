/** @jest-environment node */
import type { NextRequest } from "next/server";
import type { User } from "@/generated/prisma/client";
import { auth, currentUser } from "@clerk/nextjs/server";
import { verifyWebhook } from "@clerk/nextjs/webhooks";
import prisma from "@/server/db/db";
import { generateRandomUsername } from "@/lib/utils";
import { sendWelcomeEmail } from "@/server/email";
import { ensureCurrentPrismaUser } from "@/server/mutations/common";
import { POST } from "./route";

jest.mock("@clerk/nextjs/server", () => ({ auth: jest.fn(), currentUser: jest.fn() }));
jest.mock("@clerk/nextjs/webhooks", () => ({ verifyWebhook: jest.fn() }));
jest.mock("@/server/db/db", () => ({
  __esModule: true,
  default: { user: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() } },
}));
jest.mock("@/server/email", () => ({ sendWelcomeEmail: jest.fn() }));
jest.mock("@/app/posthog", () => ({
  __esModule: true,
  default: () => ({ capture: jest.fn() }),
}));
jest.mock("@/lib/utils", () => ({ generateRandomUsername: jest.fn() }));

type IdentityField = "clerk_user_id" | "email" | "username";
type Profile = Pick<User, IdentityField | "avatarUrl">;
const request = {} as NextRequest;
let rows: User[];

function user(overrides: Partial<User> = {}): User {
  return {
    id: "local-current",
    clerk_user_id: "clerk-current",
    email: "player@example.test",
    username: "generated-1",
    avatarUrl: "https://example.test/avatar.png",
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    accentColor: null,
    ...overrides,
  };
}

function event(type = "user.created", overrides: Record<string, unknown> = {}) {
  return {
    type,
    data: {
      id: "clerk-current",
      username: null,
      image_url: "https://example.test/avatar.png",
      primary_email_address_id: "email-current",
      email_addresses: [{ id: "email-current", email_address: "player@example.test" }],
      ...overrides,
    },
  };
}

function enforceUnique(data: Partial<Profile>, ignoreId?: string) {
  for (const field of ["clerk_user_id", "email", "username"] as const) {
    if (data[field] && rows.some((row) => row.id !== ignoreId && row[field] === data[field])) {
      throw { code: "P2002", meta: { target: [field] } };
    }
  }
}

beforeEach(() => {
  jest.resetAllMocks();
  rows = [];
  let generated = 0;
  jest.mocked(generateRandomUsername).mockImplementation(() => `generated-${++generated}`);
  (auth as unknown as jest.Mock).mockResolvedValue({ userId: "clerk-current", orgId: null });
  (currentUser as unknown as jest.Mock).mockResolvedValue({
    id: "clerk-current",
    username: null,
    imageUrl: "https://example.test/avatar.png",
    primaryEmailAddress: { emailAddress: "player@example.test" },
  });
  jest.mocked(sendWelcomeEmail).mockResolvedValue({ success: true });
  (verifyWebhook as jest.Mock).mockResolvedValue(event());
  (prisma.user.findUnique as jest.Mock).mockImplementation(async ({ where }: {
    where: Partial<Pick<User, IdentityField | "id">>;
  }) => rows.find((row) => Object.entries(where).every(([key, value]) => row[key as keyof User] === value)) ?? null);
  (prisma.user.create as jest.Mock).mockImplementation(async ({ data }: { data: Profile }) => {
    enforceUnique(data);
    const created = user({ ...data, id: `local-${rows.length + 1}` });
    rows.push(created);
    return created;
  });
  (prisma.user.update as jest.Mock).mockImplementation(async ({ where, data }: {
    where: Partial<Pick<User, IdentityField | "id">>;
    data: Partial<Profile>;
  }) => {
    const existing = rows.find((row) => Object.entries(where).every(([key, value]) => row[key as keyof User] === value));
    if (!existing) throw { code: "P2025" };
    enforceUnique(data, existing.id);
    Object.assign(existing, data);
    return existing;
  });
  jest.spyOn(console, "error").mockImplementation(() => {});
  jest.spyOn(console, "info").mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

it("rejects an unverified webhook before reading or changing accounts", async () => {
  (verifyWebhook as jest.Mock).mockRejectedValue(new Error("Invalid signature"));
  expect((await POST(request)).status).toBe(400);
  expect(prisma.user.findUnique).not.toHaveBeenCalled();
  expect(prisma.user.create).not.toHaveBeenCalled();
  expect(sendWelcomeEmail).not.toHaveBeenCalled();
});

it("does not transfer a retained deleted account to a recreated Clerk identity", async () => {
  rows.push(user({ clerk_user_id: "clerk-deleted" }));
  (verifyWebhook as jest.Mock).mockResolvedValueOnce(event("user.deleted", { id: "clerk-deleted" }));
  expect((await POST(request)).status).toBe(200);
  expect((await POST(request)).status).toBe(409);
  expect(rows[0].clerk_user_id).toBe("clerk-deleted");
  expect(prisma.user.update).not.toHaveBeenCalled();
  expect(prisma.user.create).not.toHaveBeenCalled();
  expect(sendWelcomeEmail).not.toHaveBeenCalled();
});

it("preserves the same generated username across duplicate created and updated events", async () => {
  expect((await POST(request)).status).toBe(200);
  const original = rows[0].username;
  expect((await POST(request)).status).toBe(200);
  (verifyWebhook as jest.Mock).mockResolvedValue(event("user.updated"));
  expect((await POST(request)).status).toBe(200);
  expect((await POST(request)).status).toBe(200);
  expect(rows).toHaveLength(1);
  expect(rows[0].username).toBe(original);
  expect(generateRandomUsername).toHaveBeenCalledTimes(1);
  expect(sendWelcomeEmail).toHaveBeenLastCalledWith({
    email: rows[0].email,
    username: original,
    userId: rows[0].id,
  });
});

it("provisions an update delivered first and does not overwrite it with a late created event", async () => {
  (verifyWebhook as jest.Mock).mockResolvedValueOnce(event("user.updated", {
    username: "latest-name",
    image_url: "https://example.test/latest.png",
  }));
  expect((await POST(request)).status).toBe(200);
  expect((await POST(request)).status).toBe(200);
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ username: "latest-name", avatarUrl: "https://example.test/latest.png" });
});

it("syncs a real username change while retaining the immutable account identity", async () => {
  rows.push(user());
  (verifyWebhook as jest.Mock).mockResolvedValue(event("user.updated", { username: "chosen-name" }));
  expect((await POST(request)).status).toBe(200);
  expect(rows[0]).toMatchObject({ id: "local-current", clerk_user_id: "clerk-current", username: "chosen-name" });
  expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({
    where: { clerk_user_id: "clerk-current" },
    data: expect.not.objectContaining({ clerk_user_id: expect.anything() }),
  }));
});

it("rejects a profile update that collides with another identity's email", async () => {
  rows.push(user(), user({ id: "local-other", clerk_user_id: "clerk-other", email: "other@example.test", username: "other" }));
  (verifyWebhook as jest.Mock).mockResolvedValue(event("user.updated", {
    email_addresses: [{ id: "email-current", email_address: "other@example.test" }],
  }));
  expect((await POST(request)).status).toBe(409);
  expect(rows[0].email).toBe("player@example.test");
});

it("handles simultaneous webhook and immediate pickup provisioning with one stable account", async () => {
  const create = prisma.user.create as jest.Mock;
  const persist = create.getMockImplementation()!;
  let arrivals = 0;
  let release!: () => void;
  const bothArrived = new Promise<void>((resolve) => { release = resolve; });
  create.mockImplementation(async (args) => {
    if (++arrivals === 2) release();
    await bothArrived;
    return persist(args);
  });
  const [response, pickupUser] = await Promise.all([POST(request), ensureCurrentPrismaUser()]);
  expect(response.status).toBe(200);
  expect(rows).toHaveLength(1);
  expect(pickupUser).toEqual(rows[0]);
  expect(prisma.user.create).toHaveBeenCalledTimes(2);
  expect((await POST(request)).status).toBe(200);
  expect(rows[0].username).toBe(pickupUser.username);
});

it("retains immediate-signup provisioning when the welcome webhook arrives later", async () => {
  const pickupUser = { ...await ensureCurrentPrismaUser() };
  expect((await POST(request)).status).toBe(200);
  expect(rows).toHaveLength(1);
  expect(rows[0]).toEqual(pickupUser);
  expect(sendWelcomeEmail).toHaveBeenCalledWith({ email: pickupUser.email, username: pickupUser.username, userId: pickupUser.id });
});

it("rejects a different identity winning the unique email race", async () => {
  (prisma.user.create as jest.Mock).mockImplementationOnce(async () => {
    rows.push(user({ clerk_user_id: "clerk-other" }));
    throw { code: "P2002", meta: { target: ["email"] } };
  });
  expect((await POST(request)).status).toBe(409);
  expect(rows[0].clerk_user_id).toBe("clerk-other");
  expect(prisma.user.update).not.toHaveBeenCalled();
});

it("does not rerandomize a name when the requested username belongs to another local account", async () => {
  rows.push(user(), user({ id: "local-other", clerk_user_id: "clerk-other", email: "other@example.test", username: "taken" }));
  (verifyWebhook as jest.Mock).mockResolvedValue(event("user.updated", { username: "taken" }));
  expect((await POST(request)).status).toBe(200);
  expect((await POST(request)).status).toBe(200);
  expect(rows[0].username).toBe("generated-1");
  expect(generateRandomUsername).not.toHaveBeenCalled();
});
