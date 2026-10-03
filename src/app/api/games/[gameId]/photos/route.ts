import { auth } from "@clerk/nextjs/server";
import { del, put } from "@vercel/blob";
import PostHogClient from "@/app/posthog";
import prisma from "@/server/db/db";
import { getGameById } from "@/server/queries/games";
import { isKeyMomentStorageConfigured } from "@/server/keyMoments";
import { assertGameScoringAccess } from "@/server/scoring/access";
import { captureServerEvent } from "@/server/telemetry";
import {
  KEY_MOMENT_MAX_BYTES,
  KEY_MOMENT_MAX_CAPTION,
  KEY_MOMENT_MAX_PER_GAME,
  KEY_MOMENT_TYPES,
} from "@/lib/keyMoments";

const EXTENSIONS: Record<(typeof KEY_MOMENT_TYPES)[number], string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function isAllowedType(type: string): type is (typeof KEY_MOMENT_TYPES)[number] {
  return (KEY_MOMENT_TYPES as readonly string[]).includes(type);
}

/** Upload a key-moment photo for a game the caller can score. */
export async function POST(req: Request, context: { params: Promise<{ gameId: string }> }) {
  const { userId, orgId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });
  if (!isKeyMomentStorageConfigured()) {
    return Response.json({ error: "Photo uploads aren't set up yet" }, { status: 503 });
  }

  const { gameId } = await context.params;
  const game = await getGameById(gameId);
  try {
    assertGameScoringAccess(game, { userId, orgId: orgId ?? undefined });
  } catch {
    return Response.json({ error: "Game not found" }, { status: 404 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: "Choose a photo to upload" }, { status: 400 });
  }
  const file = form.get("photo");
  if (!(file instanceof File) || file.size === 0) {
    return Response.json({ error: "Choose a photo to upload" }, { status: 400 });
  }
  if (!isAllowedType(file.type)) {
    return Response.json({ error: "Photos must be JPEG, PNG or WebP" }, { status: 415 });
  }
  if (file.size > KEY_MOMENT_MAX_BYTES) {
    return Response.json({ error: "That photo is too large" }, { status: 413 });
  }
  const captionValue = form.get("caption");
  const caption = typeof captionValue === "string" ? captionValue.trim() : "";
  if (caption.length > KEY_MOMENT_MAX_CAPTION) {
    return Response.json({ error: `Captions are ${KEY_MOMENT_MAX_CAPTION} characters at most` }, { status: 400 });
  }
  const roundValue = form.get("roundId");
  const roundId = typeof roundValue === "string" && roundValue ? roundValue : null;
  const round = roundId ? game.rounds.find((r) => r.id === roundId) : null;
  if (roundId && !round) {
    return Response.json({ error: "That round isn't part of this game" }, { status: 400 });
  }

  const existing = await prisma.keyMoment.count({ where: { gameId: game.id } });
  if (existing >= KEY_MOMENT_MAX_PER_GAME) {
    return Response.json({ error: `A game can hold ${KEY_MOMENT_MAX_PER_GAME} photos` }, { status: 409 });
  }
  const uploader = await prisma.user.findUnique({
    where: { clerk_user_id: userId },
    select: { id: true },
  });

  let blob: Awaited<ReturnType<typeof put>>;
  try {
    blob = await put(`key-moments/${game.id}/photo.${EXTENSIONS[file.type]}`, file, {
      access: "public",
      addRandomSuffix: true,
      contentType: file.type,
    });
  } catch (error) {
    console.warn("Key moment blob upload failed", { error: error instanceof Error ? error.name : "UnknownError" });
    return Response.json({ error: "Couldn't save that photo. Please try again." }, { status: 502 });
  }
  let momentId: string;
  try {
    const moment = await prisma.keyMoment.create({
      data: {
        gameId: game.id,
        roundId: round?.id ?? null,
        uploaderId: uploader?.id ?? null,
        url: blob.url,
        pathname: blob.pathname,
        caption: caption || null,
      },
      select: { id: true },
    });
    momentId = moment.id;
  } catch (error) {
    // Don't leave an unreachable file behind when the row can't be saved.
    await del(blob.url).catch(() => undefined);
    throw error;
  }

  captureServerEvent(PostHogClient(), {
    distinctId: userId,
    event: "key_moment_uploaded",
    properties: {
      game_id: game.id,
      has_caption: Boolean(caption),
      has_round: Boolean(round),
      size_kb: Math.round(file.size / 1024),
    },
  });
  return Response.json({ id: momentId }, { status: 201 });
}
