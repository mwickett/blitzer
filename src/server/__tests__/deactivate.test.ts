/** @jest-environment node */
import { clerkClient } from "@clerk/nextjs/server";
import prisma from "../db/db";
import { deactivateUser, deleteOwnAccount } from "../users/deactivate";

jest.mock("@clerk/nextjs/server", () => ({ clerkClient: jest.fn() }));
jest.mock("../db/db", () => ({
  __esModule: true,
  default: {
    $transaction: jest.fn(),
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    gameStory: { deleteMany: jest.fn() },
  },
}));

const deleteUser = jest.fn();
const findUnique = prisma.user.findUnique as jest.Mock;
const update = prisma.user.update as jest.Mock;

beforeEach(() => {
  jest.resetAllMocks();
  (clerkClient as unknown as jest.Mock).mockResolvedValue({ users: { deleteUser } });
  (prisma.$transaction as jest.Mock).mockImplementation((ops) => Promise.all(ops));
  update.mockImplementation(async ({ data }) => data);
  (prisma.gameStory.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });
  (prisma.user.count as jest.Mock).mockResolvedValue(2);
});

const active = { id: "u1", deactivatedAt: null, anonymizedAt: null };

it("deactivates and releases the email, keeping the name", async () => {
  findUnique.mockResolvedValue(active);

  await expect(deactivateUser("clerk-1", { anonymize: false })).resolves.toBe(true);
  expect(update).toHaveBeenCalledTimes(1);
  expect(update.mock.calls[0][0]).toEqual({
    where: { id: "u1" },
    data: {
      deactivatedAt: expect.any(Date),
      email: "former-player-u1@deactivated.invalid",
    },
  });
  expect(prisma.gameStory.deleteMany).not.toHaveBeenCalled();
});

it("anonymizes to a numbered Former player and drops cached stories", async () => {
  findUnique.mockResolvedValue(active);

  await deactivateUser("clerk-1", { anonymize: true });
  expect(update.mock.calls[1][0].data).toMatchObject({
    username: "Former player 3",
    avatarUrl: null,
    anonymizedAt: expect.any(Date),
  });
  expect(prisma.gameStory.deleteMany).toHaveBeenCalledWith({
    where: { game: { players: { some: { userId: "u1" } } } },
  });
});

it("retries the next number when another anonymization took it", async () => {
  findUnique.mockResolvedValue({ ...active, deactivatedAt: new Date() });
  (prisma.$transaction as jest.Mock)
    .mockRejectedValueOnce({ code: "P2002" })
    .mockImplementation((ops) => Promise.all(ops));

  await deactivateUser("clerk-1", { anonymize: true });
  const names = update.mock.calls.map(([call]) => call.data.username);
  expect(names).toEqual(["Former player 3", "Former player 4"]);
});

it("leaves an already anonymized account alone", async () => {
  findUnique.mockResolvedValue({
    id: "u1",
    deactivatedAt: new Date(),
    anonymizedAt: new Date(),
  });

  await deactivateUser("clerk-1", { anonymize: true });
  expect(update).not.toHaveBeenCalled();
});

it("returns false for an unknown Clerk user", async () => {
  findUnique.mockResolvedValue(null);
  await expect(deactivateUser("clerk-x", { anonymize: true })).resolves.toBe(false);
  expect(update).not.toHaveBeenCalled();
});

it("deactivates locally before removing the Clerk login", async () => {
  findUnique.mockResolvedValue(active);
  const order: string[] = [];
  update.mockImplementation(async () => order.push("db"));
  deleteUser.mockImplementation(async () => order.push("clerk"));

  await deleteOwnAccount("clerk-1", { anonymize: false });
  expect(deleteUser).toHaveBeenCalledWith("clerk-1");
  expect(order).toEqual(["db", "clerk"]);
});

it("does not remove the Clerk login when the local write fails", async () => {
  findUnique.mockResolvedValue(active);
  update.mockRejectedValue(new Error("db down"));

  await expect(deleteOwnAccount("clerk-1", { anonymize: false })).rejects.toThrow();
  expect(deleteUser).not.toHaveBeenCalled();
});
