"use server";

import { captureServerEvent } from "@/server/telemetry";

import { randomBytes } from "node:crypto";
import { isUniqueConstraintError } from "../users/provision";
import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import prisma from "@/server/db/db";
import { pickupGameSchema } from "@/lib/validation/submissions";
import { assignColorsToPlayers } from "@/lib/scoring/colors";
import {
  MAX_PICKUP_PLAYERS,
  isLobbyExpired,
  type LobbyRejectionReason,
  type Rejected,
  type Result,
} from "@/lib/lobbies";
import {
  ensureCurrentPrismaUser,
  requireAuthContext,
  type AuthedUserContext,
} from "./common";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function createJoinCode() {
  const bytes = randomBytes(6);
  return Array.from(
    bytes,
    (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length],
  ).join("");
}

/**
 * Turn an action down, recording it as the product event it is. Reasons are
 * low-cardinality on purpose so "how often is a lobby full?" is one breakdown.
 */
function reject(
  tracking: {
    posthog: AuthedUserContext["posthog"];
    distinctId: string;
    event: string;
    gameId?: string;
  },
  reason: LobbyRejectionReason,
  message: string,
): Rejected {
  captureServerEvent(tracking.posthog, {
    distinctId: tracking.distinctId,
    event: tracking.event,
    properties: {
      reason,
      ...(tracking.gameId ? { game_id: tracking.gameId } : {}),
    },
  });
  return { ok: false, reason, message };
}

export async function createPickupGame(input: {
  winThreshold?: number;
  guestNames?: string[];
}): Promise<Result<{ gameId: string; joinToken: string }>> {
  const { user, posthog } = await requireAuthContext("user");
  const tracking = {
    posthog,
    distinctId: user.userId,
    event: "create_pickup_game_rejected",
  };

  const parsed = pickupGameSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    if (issue.path[0] === "winThreshold") {
      return reject(
        tracking,
        "invalid_threshold",
        "Points to win must be a whole number between 25 and 200.",
      );
    }
    if (issue.code === "too_big" && issue.path.length === 1) {
      return reject(
        tracking,
        "too_many_guests",
        `A pickup game seats up to ${MAX_PICKUP_PLAYERS} players.`,
      );
    }
    if (issue.code === "too_big") {
      return reject(
        tracking,
        "guest_name_too_long",
        "Guest names must be 50 characters or fewer.",
      );
    }
    return reject(
      tracking,
      "invalid_input",
      "Enter a valid game configuration and nonblank guest names.",
    );
  }
  const { winThreshold, guestNames } = parsed.data;
  const host = await ensureCurrentPrismaUser();

  let game;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      game = await prisma.$transaction(async (tx) => {
        const created = await tx.game.create({
          data: {
            kind: "PICKUP",
            startedAt: null,
            hostUserId: host.id,
            joinToken: randomBytes(24).toString("base64url"),
            joinCode: createJoinCode(),
            winThreshold,
          },
        });

        const guests = [];
        for (const name of guestNames) {
          guests.push(
            await tx.guestUser.create({
              data: { name, createdById: host.id },
            }),
          );
        }
        const colorInputs = [
          { id: host.id, resolvedColor: host.accentColor ?? null },
          ...guests.map((guest) => ({ id: guest.id, resolvedColor: null })),
        ];
        const colors = assignColorsToPlayers(colorInputs);
        await tx.gamePlayers.createMany({
          data: [
            {
              gameId: created.id,
              userId: host.id,
              accentColor: colors[host.id],
            },
            ...guests.map((guest) => ({
              gameId: created.id,
              guestId: guest.id,
              accentColor: colors[guest.id],
            })),
          ],
        });
        return created;
      });
      break;
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
      if (attempt === 2) {
        throw new Error("Unable to create a unique lobby code");
      }
    }
  }
  if (!game) throw new Error("Unable to create a unique lobby code");

  captureServerEvent(posthog, {
    distinctId: user.userId,
    event: "create_pickup_game",
    properties: {
      game_id: game.id,
      guest_player_count: guestNames.length,
      win_threshold: winThreshold,
    },
  });
  return { ok: true, gameId: game.id, joinToken: game.joinToken! };
}

export async function joinPickupGame(
  joinToken: string,
): Promise<Result<{ gameId: string }>> {
  const { user, posthog } = await requireAuthContext("user");
  const joiningUser = await ensureCurrentPrismaUser();
  const tracking = {
    posthog,
    distinctId: user.userId,
    event: "join_pickup_game_rejected",
  };

  // Rejections return out of the transaction rather than throwing: nothing has
  // been written at that point, so committing an empty transaction is fine.
  const outcome = await prisma.$transaction(
    async (tx): Promise<Result<{ gameId: string; didJoin: boolean }>> => {
      const rows = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT "id" FROM "Game" WHERE "join_token" = ${joinToken} FOR UPDATE
    `);
      if (!rows[0]) {
        return reject(
          tracking,
          "invalid_link",
          "This lobby link is invalid or has expired.",
        );
      }
      const game = await tx.game.findUnique({
        where: { id: rows[0].id },
        include: {
          players: { include: { user: { select: { accentColor: true } } } },
        },
      });
      if (
        !game ||
        game.kind !== "PICKUP" ||
        game.startedAt ||
        game.isFinished
      ) {
        return reject(
          { ...tracking, gameId: rows[0].id },
          "not_open",
          "This lobby is no longer accepting players.",
        );
      }
      if (isLobbyExpired(game.createdAt)) {
        return reject(
          { ...tracking, gameId: game.id },
          "expired",
          "This lobby has expired — ask the host for a new one.",
        );
      }
      // Re-joining is idempotent, and it has to stay that way at a full table:
      // an existing player reloading the link must not be turned away.
      if (game.players.some((player) => player.userId === joiningUser.id)) {
        return { ok: true, gameId: game.id, didJoin: false };
      }
      // Checked under the row lock so concurrent scans can't overfill the table.
      if (game.players.length >= MAX_PICKUP_PLAYERS) {
        return reject(
          { ...tracking, gameId: game.id },
          "full",
          `This lobby is full (${MAX_PICKUP_PLAYERS} players maximum).`,
        );
      }

      const key = `joining:${joiningUser.id}`;
      const colors = assignColorsToPlayers([
        ...game.players.map((player) => ({
          id: player.id,
          resolvedColor: player.accentColor ?? player.user?.accentColor ?? null,
        })),
        { id: key, resolvedColor: joiningUser.accentColor ?? null },
      ]);
      await tx.gamePlayers.create({
        data: {
          gameId: game.id,
          userId: joiningUser.id,
          accentColor: colors[key],
        },
      });
      return { ok: true, gameId: game.id, didJoin: true };
    },
  );

  if (!outcome.ok) return outcome;

  // Only a seat that was actually added is a join. Reloading the link is an
  // ordinary thing to do in a lobby, and counting those would inflate the
  // funnel with events that represent nobody new sitting down.
  if (outcome.didJoin) {
    captureServerEvent(posthog, {
      distinctId: user.userId,
      event: "join_pickup_game",
      properties: { game_id: outcome.gameId },
    });
  }
  revalidatePath(`/games/${outcome.gameId}/lobby`);
  // `didJoin` is only here to gate the event above — callers just need to know
  // the join succeeded, so it does not travel out of this function.
  return { ok: true as const, gameId: outcome.gameId };
}

export async function joinPickupGameByCode(
  rawCode: string,
): Promise<Result<{ gameId: string }>> {
  const { user, posthog } = await requireAuthContext("user");
  const code = rawCode
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  const game = await prisma.game.findUnique({
    where: { joinCode: code },
    select: { joinToken: true },
  });
  if (!game?.joinToken) {
    return reject(
      {
        posthog,
        distinctId: user.userId,
        event: "join_pickup_game_rejected",
      },
      "code_not_found",
      "We couldn't find that lobby code.",
    );
  }
  return joinPickupGame(game.joinToken);
}

export async function startPickupGame(
  gameId: string,
): Promise<Result<{ gameId: string }>> {
  const { user, posthog } = await requireAuthContext("user");
  const host = await ensureCurrentPrismaUser();
  const tracking = {
    posthog,
    distinctId: user.userId,
    event: "start_pickup_game_rejected",
    gameId,
  };

  const outcome = await prisma.$transaction(
    async (tx): Promise<Result<{ started: boolean }>> => {
      const rows = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT "id" FROM "Game" WHERE "id" = ${gameId} FOR UPDATE
    `);
      const game = rows[0]
        ? await tx.game.findUnique({
            where: { id: gameId },
            include: { _count: { select: { players: true } } },
          })
        : null;
      if (!game || game.kind !== "PICKUP") {
        return reject(tracking, "invalid_link", "This lobby no longer exists.");
      }
      if (game.hostUserId !== host.id) {
        return reject(
          tracking,
          "not_host",
          "Only the host can start this game.",
        );
      }
      if (game.startedAt) return { ok: true, started: false };
      if (game._count.players < 2) {
        return reject(
          tracking,
          "too_few_players",
          "At least two players are needed to start.",
        );
      }
      await tx.game.update({
        where: { id: gameId },
        data: { startedAt: new Date(), joinToken: null, joinCode: null },
      });
      return { ok: true, started: true };
    },
  );

  if (!outcome.ok) return outcome;
  if (outcome.started) {
    captureServerEvent(posthog, {
      distinctId: user.userId,
      event: "start_pickup_game",
      properties: { game_id: gameId },
    });
  }
  revalidatePath(`/games/${gameId}`);
  return { ok: true, gameId };
}
