import prisma from "../db/db";
import { saveDashboardLayout } from "../mutations/dashboard";
import { requireAuthContext } from "../mutations/common";
import { captureServerEvent } from "../telemetry";
import { defaultDashboardLayout } from "@/lib/dashboardLayout";

jest.mock("../mutations/common", () => ({ requireAuthContext: jest.fn() }));
jest.mock("../telemetry", () => ({ captureServerEvent: jest.fn() }));
jest.mock("@/generated/prisma/client", () => ({
  Prisma: { DbNull: "DbNull" },
}));
jest.mock("../db/db", () => ({
  __esModule: true,
  default: { user: { update: jest.fn() } },
}));

describe("saveDashboardLayout", () => {
  const posthog = { captureImmediate: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    (requireAuthContext as jest.Mock).mockResolvedValue({
      userId: "clerk-user",
      prismaUserId: "user-id",
      posthog,
    });
  });

  it("stores a normalized layout for the signed-in user only", async () => {
    const result = await saveDashboardLayout({
      order: ["rivals", "unknown", "record"],
      hidden: ["record"],
    });

    expect(requireAuthContext).toHaveBeenCalledWith("prismaId");
    expect(result.ok).toBe(true);
    const layout = result.ok ? result.layout : null;
    expect(layout?.order.slice(0, 2)).toEqual(["rivals", "record"]);
    expect(layout?.order).not.toContain("unknown");
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-id" },
      data: { dashboardLayout: layout },
    });
    expect(captureServerEvent).toHaveBeenCalledWith(posthog, {
      distinctId: "clerk-user",
      event: "dashboard_customized",
      properties: { visible_cards: 13, hidden_cards: 2 },
    });
  });

  it("clears the stored layout on reset", async () => {
    const result = await saveDashboardLayout(null);

    expect(result).toEqual({ ok: true, layout: defaultDashboardLayout() });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-id" },
      data: { dashboardLayout: "DbNull" },
    });
    expect(captureServerEvent).toHaveBeenCalledWith(
      posthog,
      expect.objectContaining({ event: "dashboard_reset" }),
    );
  });

  it.each([
    undefined,
    { order: "record", hidden: [] },
    { order: Array.from({ length: 51 }, () => "record"), hidden: [] },
  ])("rejects malformed input %#", async (input) => {
    await expect(saveDashboardLayout(input)).resolves.toEqual({
      ok: false,
      message: "That layout could not be saved.",
    });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("requires a signed-in user", async () => {
    (requireAuthContext as jest.Mock).mockRejectedValue(new Error("Unauthorized"));
    await expect(saveDashboardLayout(null)).rejects.toThrow("Unauthorized");
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
