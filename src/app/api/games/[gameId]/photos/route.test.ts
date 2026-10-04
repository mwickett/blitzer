/** @jest-environment node */
import { POST } from "./route";
import { DELETE } from "./[photoId]/route";

const mockAuth = jest.fn();
const mockGame = jest.fn();
const mockPut = jest.fn();
const mockDel = jest.fn();
const mockCapture = jest.fn();
const mockEnsureUser = jest.fn();
const mockPrisma: Record<string, any> = {
  keyMoment: { count: jest.fn(), create: jest.fn(), findFirst: jest.fn(), delete: jest.fn() },
  $queryRaw: jest.fn(),
  $transaction: jest.fn((run: (tx: unknown) => unknown): unknown => run(mockPrisma)),
};
jest.mock("@clerk/nextjs/server", () => ({ auth: () => mockAuth() }));
jest.mock("@vercel/blob", () => ({
  put: (...args: unknown[]) => mockPut(...args),
  del: (...args: unknown[]) => mockDel(...args),
}));
jest.mock("@/server/queries/games", () => ({ getGameById: (id: string) => mockGame(id) }));
jest.mock("@/server/db/db", () => ({
  __esModule: true,
  get default() {
    return mockPrisma;
  },
}));
jest.mock("@/server/mutations/common", () => ({ ensureCurrentPrismaUser: () => mockEnsureUser() }));
jest.mock("@/server/telemetry", () => ({ captureServerEvent: (...args: unknown[]) => mockCapture(...args) }));
jest.mock("@/app/posthog", () => ({ __esModule: true, default: () => ({}) }));

const circleGame = () => ({
  id: "game-1", kind: "CIRCLE", organizationId: "circle", startedAt: new Date(),
  players: [{ user: { clerk_user_id: "clerk-1" } }],
  rounds: [{ id: "round-1", round: 1 }],
});
const photo = (type = "image/jpeg", bytes = 10) => new File([new Uint8Array(bytes)], "photo.jpg", { type });
const upload = (fields: Record<string, string | File>) => {
  const body = new FormData();
  for (const [key, value] of Object.entries(fields)) body.set(key, value);
  return POST(new Request("https://example.invalid/api/games/game-1/photos", { method: "POST", body }), {
    params: Promise.resolve({ gameId: "game-1" }),
  });
};
const remove = () =>
  DELETE(new Request("https://example.invalid/api/games/game-1/photos/m1", { method: "DELETE" }), {
    params: Promise.resolve({ gameId: "game-1", photoId: "m1" }),
  });

beforeEach(() => {
  jest.clearAllMocks();
  process.env.BLOB_READ_WRITE_TOKEN = "test-only";
  mockAuth.mockResolvedValue({ userId: "clerk-1", orgId: "circle" });
  mockGame.mockResolvedValue(circleGame());
  mockPrisma.keyMoment.count.mockResolvedValue(0);
  mockPrisma.keyMoment.create.mockResolvedValue({ id: "m1" });
  mockEnsureUser.mockResolvedValue({ id: "u1" });
  mockPut.mockResolvedValue({ url: "https://blob.example/key-moments/game-1/photo-abc.jpg", pathname: "key-moments/game-1/photo-abc.jpg" });
  mockDel.mockResolvedValue(undefined);
});

describe("POST photos", () => {
  it("stores a captioned photo for a round and records the upload", async () => {
    const response = await upload({ photo: photo(), caption: "  Big Blitz  ", roundId: "round-1" });
    expect(response.status).toBe(201);
    expect(mockPut).toHaveBeenCalledWith(
      "key-moments/game-1/photo.jpg",
      expect.any(File),
      expect.objectContaining({ access: "public", addRandomSuffix: true, contentType: "image/jpeg" }),
    );
    expect(mockPrisma.keyMoment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ gameId: "game-1", roundId: "round-1", uploaderId: "u1", caption: "Big Blitz" }),
      }),
    );
    expect(mockCapture).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      event: "key_moment_uploaded",
      properties: expect.objectContaining({ has_caption: true, has_round: true }),
    }));
  });

  it("is refused while Blob storage is not configured", async () => {
    delete process.env.BLOB_READ_WRITE_TOKEN;
    expect((await upload({ photo: photo() })).status).toBe(503);
    expect(mockGame).not.toHaveBeenCalled();
  });

  it("requires sign-in and scoring access", async () => {
    mockAuth.mockResolvedValueOnce({ userId: null });
    expect((await upload({ photo: photo() })).status).toBe(401);
    mockAuth.mockResolvedValueOnce({ userId: "clerk-9", orgId: "other" });
    expect((await upload({ photo: photo() })).status).toBe(404);
    expect(mockPut).not.toHaveBeenCalled();
  });

  it("validates the file, caption, round and per-game limit", async () => {
    expect((await upload({ caption: "no file" })).status).toBe(400);
    expect((await upload({ photo: photo("image/gif") })).status).toBe(415);
    expect((await upload({ photo: photo("image/jpeg", 4 * 1024 * 1024 + 1) })).status).toBe(413);
    expect((await upload({ photo: photo(), caption: "x".repeat(141) })).status).toBe(400);
    expect((await upload({ photo: photo(), roundId: "someone-elses-round" })).status).toBe(400);
    mockPrisma.keyMoment.count.mockResolvedValueOnce(30);
    expect((await upload({ photo: photo() })).status).toBe(409);
    expect(mockPut).not.toHaveBeenCalled();
  });

  it("rechecks the cap under the game lock and drops the file when the last slot went", async () => {
    mockPrisma.keyMoment.count.mockResolvedValueOnce(29).mockResolvedValueOnce(30);
    expect((await upload({ photo: photo() })).status).toBe(409);
    expect(mockPrisma.$queryRaw).toHaveBeenCalled();
    expect(mockPrisma.keyMoment.create).not.toHaveBeenCalled();
    expect(mockDel).toHaveBeenCalledWith("https://blob.example/key-moments/game-1/photo-abc.jpg");
  });

  it("provisions the uploader before storing anything", async () => {
    mockEnsureUser.mockRejectedValueOnce(new Error("Unable to load your account"));
    expect((await upload({ photo: photo() })).status).toBe(503);
    expect(mockPut).not.toHaveBeenCalled();
  });

  it("removes the uploaded file when the row can't be saved", async () => {
    mockPrisma.keyMoment.create.mockRejectedValueOnce(new Error("db down"));
    await expect(upload({ photo: photo() })).rejects.toThrow("db down");
    expect(mockDel).toHaveBeenCalledWith("https://blob.example/key-moments/game-1/photo-abc.jpg");
  });

  it("reports a storage failure without saving a row", async () => {
    mockPut.mockRejectedValueOnce(new Error("blob down"));
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
    expect((await upload({ photo: photo() })).status).toBe(502);
    expect(mockPrisma.keyMoment.create).not.toHaveBeenCalled();
  });
});

describe("DELETE photo", () => {
  it("lets the uploader remove their photo and its file", async () => {
    mockPrisma.keyMoment.findFirst.mockResolvedValue({ id: "m1", url: "https://blob.example/x.jpg" });
    expect((await remove()).status).toBe(204);
    expect(mockPrisma.keyMoment.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "m1", gameId: "game-1", uploader: { clerk_user_id: "clerk-1" } },
    }));
    expect(mockPrisma.keyMoment.delete).toHaveBeenCalledWith({ where: { id: "m1" } });
    expect(mockDel).toHaveBeenCalledWith("https://blob.example/x.jpg");
  });

  it("hides photos the caller didn't upload", async () => {
    mockPrisma.keyMoment.findFirst.mockResolvedValue(null);
    expect((await remove()).status).toBe(404);
    expect(mockPrisma.keyMoment.delete).not.toHaveBeenCalled();
    mockAuth.mockResolvedValueOnce({ userId: null });
    expect((await remove()).status).toBe(401);
  });

  it("keeps the row for a retry when the file delete fails", async () => {
    mockPrisma.keyMoment.findFirst.mockResolvedValue({ id: "m1", url: "https://blob.example/x.jpg" });
    mockDel.mockRejectedValueOnce(new Error("blob down"));
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
    expect((await remove()).status).toBe(502);
    expect(mockPrisma.keyMoment.delete).not.toHaveBeenCalled();
  });
});
