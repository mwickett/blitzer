import { auth } from "@clerk/nextjs/server";
import { del } from "@vercel/blob";
import PostHogClient from "@/app/posthog";
import prisma from "@/server/db/db";
import { captureServerEvent } from "@/server/telemetry";

/** Remove a key-moment photo; only the person who uploaded it may. */
export async function DELETE(
  _req: Request,
  context: { params: Promise<{ gameId: string; photoId: string }> },
) {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const { gameId, photoId } = await context.params;
  const moment = await prisma.keyMoment.findFirst({
    where: { id: photoId, gameId, uploader: { clerk_user_id: userId } },
    select: { id: true, url: true },
  });
  if (!moment) return Response.json({ error: "Photo not found" }, { status: 404 });

  // The file goes first: public URLs outlive the row, so a failed delete
  // keeps the row and the uploader can retry.
  try {
    await del(moment.url);
  } catch {
    console.warn("Key moment blob delete failed", { photoId: moment.id });
    return Response.json({ error: "Couldn't remove that photo. Please try again." }, { status: 502 });
  }
  await prisma.keyMoment.delete({ where: { id: moment.id } });

  captureServerEvent(PostHogClient(), {
    distinctId: userId,
    event: "key_moment_deleted",
    properties: { game_id: gameId },
  });
  return new Response(null, { status: 204 });
}
