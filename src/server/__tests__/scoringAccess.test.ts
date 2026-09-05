import {
  assertGameInCircle,
  assertGameScoringAccess,
  type ScoringAccessGame,
} from "../scoring/access";

const caller = { userId: "clerk-current", orgId: "circle" };
const pickup = (started = true): ScoringAccessGame => ({
  kind: "PICKUP",
  organizationId: null,
  startedAt: started ? new Date() : null,
  players: [{ user: { clerk_user_id: caller.userId } }, { user: null }],
});

describe("live scoring access assertions", () => {
  it("accepts the active circle and rejects missing or other-circle games", () => {
    expect(() => assertGameInCircle({ organizationId: "circle" }, "circle")).not.toThrow();
    expect(() => assertGameInCircle(null, "circle")).toThrow("Game not found");
    expect(() => assertGameInCircle({ organizationId: "other" }, "circle")).toThrow("Game does not belong to your active circle");
  });

  it("requires an active matching circle for Circle scoring", () => {
    const game: ScoringAccessGame = { ...pickup(), kind: "CIRCLE", organizationId: "circle", players: [] };
    expect(() => assertGameScoringAccess(game, caller)).not.toThrow();
    expect(() => assertGameScoringAccess(game, { userId: caller.userId })).toThrow("No active circle");
    expect(() => assertGameScoringAccess(game, { ...caller, orgId: "other" })).toThrow("Game does not belong to your active circle");
  });

  it("allows only registered participants of started pickup games", () => {
    expect(() => assertGameScoringAccess(pickup(), caller)).not.toThrow();
    expect(() => assertGameScoringAccess(pickup(), { userId: "stranger" })).toThrow("You are not a player in this game");
    expect(() => assertGameScoringAccess(pickup(false), caller)).toThrow("You are not a player in this game");
  });

  it("keeps missing and legacy games outside the scoring write path", () => {
    expect(() => assertGameScoringAccess(null, caller)).toThrow("Game not found");
    expect(() => assertGameScoringAccess({ ...pickup(), kind: "LEGACY" }, caller)).toThrow("You are not a player in this game");
  });
});
