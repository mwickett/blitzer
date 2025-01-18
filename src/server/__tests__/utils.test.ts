import { getUserIdFromAuth } from "../utils";
import { auth } from "@clerk/nextjs/server";
import prisma from "../db/db";

// Mock dependencies
jest.mock("../db/db", () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: jest.fn(),
    },
  },
}));

// Mock types
type AuthResult = { userId: string | null };
type AuthFn = () => Promise<AuthResult>;

jest.mock("@clerk/nextjs/server", () => ({
  auth: jest.fn() as jest.MockedFunction<AuthFn>,
}));

describe("Server Utils", () => {
  const mockClerkUserId = "clerk-test-user-id";
  const mockPrismaUserId = "prisma-test-user-id";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getUserIdFromAuth", () => {
    it("should return prisma user id when user is authenticated", async () => {
      (auth as unknown as jest.Mock).mockResolvedValue({
        userId: mockClerkUserId,
      });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: mockPrismaUserId,
      });

      const result = await getUserIdFromAuth();

      expect(auth).toHaveBeenCalled();
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: {
          clerk_user_id: mockClerkUserId,
        },
        select: {
          id: true,
        },
      });
      expect(result).toBe(mockPrismaUserId);
    });

    it("should throw error when user is not authenticated", async () => {
      (auth as unknown as jest.Mock).mockResolvedValue({
        userId: null,
      });

      await expect(getUserIdFromAuth()).rejects.toThrow("Unauthorized");
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it("should throw error when prisma user is not found", async () => {
      (auth as unknown as jest.Mock).mockResolvedValue({
        userId: mockClerkUserId,
      });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(getUserIdFromAuth()).rejects.toThrow("User not found");
    });
  });
});
