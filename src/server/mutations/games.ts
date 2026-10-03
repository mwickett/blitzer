"use server";

import { captureServerEvent } from "@/server/telemetry";

import prisma from "@/server/db/db";
import { Prisma } from "@/generated/prisma/client";
import { requireAuthContext } from "./common";
import { assertGameInCircle, assertGameScoringAccess } from "../scoring/access";
import { getOrgMemberClerkIds } from "../clerkOrgs";
import {
  resolvePlayerColor,
  assignColorsToPlayers,
} from "@/lib/scoring/colors";
import {
  circleGameSchema,
  deckSchema,
  gameNoteSchema,
} from "@/lib/validation/submissions";
import type { DeckId } from "@/lib/scoring/decks";

// Create a new game with support for guest players
export async function createGame(
  users: {
    id: string;
    username?: string;
    isGuest?: boolean;
    accentColor?: string;
    deck?: DeckId | null;
  }[],
  winThreshold?: number,
) {
  const { user, posthog, orgId, prismaUserId } =
    await requireAuthContext("orgWithPrismaId");

  const parsed = circleGameSchema.safeParse({ users, winThreshold });
  if (!parsed.success) {
    return {
      ok: false as const,
      reason: "invalid_input" as const,
      message: parsed.error.issues[0].message,
    };
  }
  users = parsed.data.users;
  winThreshold = parsed.data.winThreshold;

  const regularPlayerIds = users.filter((u) => !u.isGuest).map((u) => u.id);

  // One lookup serves both membership validation and accent-color defaults
  const regularPlayers =
    regularPlayerIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: regularPlayerIds } },
          select: { id: true, clerk_user_id: true, accentColor: true, preferredDeck: true },
        })
      : [];

  if (regularPlayers.length !== regularPlayerIds.length) {
    return {
      ok: false as const,
      reason: "invalid_input" as const,
      message: "One or more players are no longer available.",
    };
  }

  // Validate that non-guest players are members of the active circle
  if (regularPlayerIds.length > 0) {
    const memberClerkIds = await getOrgMemberClerkIds(orgId);

    for (const player of regularPlayers) {
      if (!memberClerkIds.has(player.clerk_user_id)) {
        return {
          ok: false as const,
          reason: "invalid_input" as const,
          message: "All players must be members of the active circle.",
        };
      }
    }
  }

  // Resolve colors: game override (none at creation) > user default > auto-assign
  const colorInputs = users.map((u) => {
    const userDefault = regularPlayers.find((p) => p.id === u.id);
    return {
      id: u.id,
      resolvedColor:
        u.accentColor ??
        resolvePlayerColor({
          gameColor: null,
          userDefault: userDefault?.accentColor ?? null,
        }),
    };
  });
  const playerColors = assignColorsToPlayers(colorInputs);
  // An explicit pick (including "no deck") wins over the saved preference.
  const playerDecks = new Map(
    users.map((u) => {
      const saved = regularPlayers.find((p) => p.id === u.id)?.preferredDeck;
      const fallback = deckSchema.safeParse(saved).success ? saved! : null;
      return [u.id, u.deck !== undefined ? u.deck : fallback];
    }),
  );

  try {
    // Game, guests, and players are created atomically so a failure part-way
    // through can't leave an orphaned game behind
    const newGame = await prisma.$transaction(async (tx) => {
      const game = await tx.game.create({
        data: {
          organizationId: orgId,
          winThreshold,
        },
      });

      // Guests need individual creates to map their temporary client-side
      // IDs to real rows (createMany does not return rows)
      const guestDbIds = new Map<string, string>();
      for (const player of users) {
        if (player.isGuest && player.username) {
          const guestUser = await tx.guestUser.create({
            data: {
              name: player.username.trim(),
              createdById: prismaUserId,
              organizationId: orgId,
            },
          });
          guestDbIds.set(player.id, guestUser.id);
        }
      }

      const playerRows = users.flatMap(
        (player): Prisma.GamePlayersCreateManyInput[] => {
          const accentColor = playerColors[player.id] ?? null;
          const deck = playerDecks.get(player.id) ?? null;
          if (player.isGuest) {
            const guestId = guestDbIds.get(player.id);
            return guestId ? [{ gameId: game.id, guestId, accentColor, deck }] : [];
          }
          return [{ gameId: game.id, userId: player.id, accentColor, deck }];
        },
      );

      await tx.gamePlayers.createMany({ data: playerRows });

      return game;
    });

    // Track event in PostHog
    captureServerEvent(posthog, {
      distinctId: user.userId,
      event: "create_game",
      properties: {
        gameId: newGame.id,
        playerCount: users.length,
        guestPlayerCount: users.filter((u) => u.isGuest).length,
        deck_count: [...playerDecks.values()].filter(Boolean).length,
        win_threshold: winThreshold ?? 75,
      },
    });

    // Return the game ID instead of redirecting
    // This prevents the NEXT_REDIRECT error in the logs
    return { ok: true as const, gameId: newGame.id };
  } catch (error) {
    console.error("Error creating game:", error);
    throw error;
  }
}

// Save user's default accent color preference
export async function saveUserAccentColor(color: string) {
  const { user, posthog, prismaUserId } =
    await requireAuthContext("orgWithPrismaId");

  await prisma.user.update({
    where: { id: prismaUserId },
    data: { accentColor: color },
  });

  captureServerEvent(posthog, {
    distinctId: user.userId,
    event: "set_accent_color",
    properties: { color },
  });
}

// Save the user's default deck; null clears it
export async function saveUserPreferredDeck(deck: unknown) {
  const { user, posthog, prismaUserId } = await requireAuthContext("prismaId");

  const parsed = deckSchema.nullable().safeParse(deck);
  if (!parsed.success) throw new Error("Unknown deck.");

  await prisma.user.update({
    where: { id: prismaUserId },
    data: { preferredDeck: parsed.data },
  });

  captureServerEvent(posthog, {
    distinctId: user.userId,
    event: "set_preferred_deck",
    properties: { deck: parsed.data },
  });
}

/**
 * Saves the game's note. Anyone who may score the game may write it, during
 * or after play; an empty note clears it.
 */
export async function saveGameNote(gameId: string, note: unknown) {
  const { userId, user, posthog } = await requireAuthContext("user");
  const parsed = gameNoteSchema.safeParse(note);
  if (!parsed.success) {
    return { ok: false as const, message: parsed.error.issues[0].message };
  }

  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: {
      kind: true,
      organizationId: true,
      startedAt: true,
      players: { select: { user: { select: { clerk_user_id: true } } } },
    },
  });
  assertGameScoringAccess(game, { userId, orgId: user.orgId ?? undefined });
  await prisma.game.update({
    where: { id: gameId },
    data: { note: parsed.data },
  });

  // Note text is user content, so only whether one exists is recorded.
  captureServerEvent(posthog, {
    distinctId: userId,
    event: "game_note_saved",
    properties: { game_id: gameId, has_note: parsed.data !== null },
  });
  return { ok: true as const, note: parsed.data };
}

// Clone an existing game
export async function cloneGame(originalGameId: string) {
  const { user, posthog, orgId } = await requireAuthContext("org");

  // Fetch the original game with its players
  const originalGame = await prisma.game.findUnique({
    where: { id: originalGameId },
    include: {
      players: {
        include: {
          user: true,
          guestUser: true,
        },
      },
    },
  });

  if (!originalGame) throw new Error("Original game not found");
  assertGameInCircle(originalGame, orgId);

  // Start a transaction to ensure consistency
  const newGameId = await prisma.$transaction(async (tx) => {
    // Create a new game with the same players
    const playerCreateInputs = originalGame.players.map((player) => {
      if (player.userId) {
        return {
          userId: player.userId,
          ...(player.accentColor ? { accentColor: player.accentColor } : {}),
          ...(player.deck ? { deck: player.deck } : {}),
        };
      } else if (player.guestId) {
        return {
          guestId: player.guestId,
          ...(player.accentColor ? { accentColor: player.accentColor } : {}),
          ...(player.deck ? { deck: player.deck } : {}),
        };
      }
      throw new Error("Player has neither userId nor guestId");
    });

    const newGame = await tx.game.create({
      data: {
        organizationId: orgId,
        ...(originalGame.winThreshold !== 75
          ? { winThreshold: originalGame.winThreshold }
          : {}),
        players: {
          create: playerCreateInputs,
        },
      },
    });

    return newGame.id;
  });

  captureServerEvent(posthog, {
    distinctId: user.userId,
    event: "clone_game",
    properties: { originalGameId, newGameId },
  });

  return newGameId;
}
