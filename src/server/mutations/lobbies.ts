"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import prisma from "@/server/db/db";
import { assignColorsToPlayers } from "@/lib/scoring/colors";
import { MAX_PICKUP_PLAYERS, isLobbyExpired } from "@/lib/lobbies";
import {
  ensureCurrentPrismaUser,
  isUniqueConstraintError,
  requireAuthContext,
} from "./common";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function createJoinCode() {
  const bytes = randomBytes(6);
  return Array.from(
    bytes,
    (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length],
  ).join("");
}

export async function createPickupGame(input: {
  winThreshold?: number;
  guestNames?: string[];
}) {
  const { user, posthog } = await requireAuthContext("user");
  const host = await ensureCurrentPrismaUser();
  const winThreshold = input.winThreshold ?? 75;
  if (
    !Number.isInteger(winThreshold) ||
    winThreshold < 25 ||
    winThreshold > 200
  ) {
    throw new Error("Win threshold must be between 25 and 200");
  }
  const guestNames = (input.guestNames ?? [])
    .map((name) => name.trim())
    .filter(Boolean);
  if (guestNames.some((name) => name.length > 50)) {
    throw new Error("Guest names must be 50 characters or fewer");
  }
  // The host occupies a seat too, so guests can only fill what is left.
  if (guestNames.length + 1 > MAX_PICKUP_PLAYERS) {
    throw new Error(`A pickup game seats up to ${MAX_PICKUP_PLAYERS} players`);
  }

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

  posthog.capture({
    distinctId: user.userId,
    event: "create_pickup_game",
    properties: {
      game_id: game.id,
      guest_player_count: guestNames.length,
      win_threshold: winThreshold,
    },
  });
  return { gameId: game.id, joinToken: game.joinToken! };
}

export async function joinPickupGame(joinToken: string) {
  const { user, posthog } = await requireAuthContext("user");
  const joiningUser = await ensureCurrentPrismaUser();

  const gameId = await prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT "id" FROM "Game" WHERE "join_token" = ${joinToken} FOR UPDATE
    `);
    if (!rows[0]) throw new Error("This lobby link is invalid or has expired");
    const game = await tx.game.findUnique({
      where: { id: rows[0].id },
      include: {
        players: { include: { user: { select: { accentColor: true } } } },
      },
    });
    if (!game || game.kind !== "PICKUP" || game.startedAt || game.isFinished) {
      throw new Error("This lobby is no longer accepting players");
    }
    if (isLobbyExpired(game.createdAt)) {
      throw new Error("This lobby has expired — ask the host for a new one");
    }
    // Re-joining is idempotent, and it has to stay that way at a full table:
    // an existing player reloading the link must not be turned away.
    if (game.players.some((player) => player.userId === joiningUser.id)) {
      return game.id;
    }
    // Checked under the row lock so concurrent scans can't overfill the table.
    if (game.players.length >= MAX_PICKUP_PLAYERS) {
      throw new Error(
        `This lobby is full (${MAX_PICKUP_PLAYERS} players maximum)`,
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
    return game.id;
  });

  posthog.capture({
    distinctId: user.userId,
    event: "join_pickup_game",
    properties: { game_id: gameId },
  });
  revalidatePath(`/games/${gameId}/lobby`);
  return { gameId };
}

export async function joinPickupGameByCode(rawCode: string) {
  await requireAuthContext("user");
  const code = rawCode
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  const game = await prisma.game.findUnique({
    where: { joinCode: code },
    select: { joinToken: true },
  });
  if (!game?.joinToken) throw new Error("We couldn't find that lobby code");
  return joinPickupGame(game.joinToken);
}

export async function startPickupGame(gameId: string) {
  const { user, posthog } = await requireAuthContext("user");
  const host = await ensureCurrentPrismaUser();
  const didStart = await prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT "id" FROM "Game" WHERE "id" = ${gameId} FOR UPDATE
    `);
    if (!rows[0]) throw new Error("Lobby not found");
    const game = await tx.game.findUnique({
      where: { id: gameId },
      include: { _count: { select: { players: true } } },
    });
    if (!game || game.kind !== "PICKUP") throw new Error("Lobby not found");
    if (game.hostUserId !== host.id)
      throw new Error("Only the host can start this game");
    if (game.startedAt) return false;
    if (game._count.players < 2)
      throw new Error("At least two players are needed to start");
    await tx.game.update({
      where: { id: gameId },
      data: { startedAt: new Date(), joinToken: null, joinCode: null },
    });
    return true;
  });
  if (didStart) {
    posthog.capture({
      distinctId: user.userId,
      event: "start_pickup_game",
      properties: { game_id: gameId },
    });
  }
  revalidatePath(`/games/${gameId}`);
  return { gameId };
}
