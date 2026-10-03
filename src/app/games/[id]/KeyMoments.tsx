import { getKeyMomentsForGame } from "@/server/queries/keyMoments";
import { KeyMomentDeleteButton, KeyMomentUpload } from "./KeyMomentUpload";

/** Captioned photos from the table, under the scoreboard. */
export default async function KeyMoments({
  gameId,
  viewerId,
  canUpload,
  rounds,
}: {
  gameId: string;
  viewerId: string | null;
  canUpload: boolean;
  rounds: { id: string; round: number }[];
}) {
  const photos = await getKeyMomentsForGame(gameId, viewerId);
  if (!photos.length && !canUpload) return null;

  return (
    <section aria-labelledby="key-moments-heading" className="mx-auto mt-6 max-w-2xl rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 id="key-moments-heading" className="text-lg font-semibold">
          <span aria-hidden="true" className="mr-1">📸</span>
          Key moments
        </h2>
        {canUpload ? <KeyMomentUpload gameId={gameId} rounds={rounds} photoCount={photos.length} /> : null}
      </div>
      {photos.length ? (
        <ul className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {photos.map((photo) => (
            <li key={photo.id} className="overflow-hidden rounded-md border bg-background">
              {/* eslint-disable-next-line @next/next/no-img-element -- resized before upload; served from Blob */}
              <img
                src={photo.url}
                alt={photo.caption ?? "A key moment from this game"}
                loading="lazy"
                className="aspect-4/3 w-full object-cover"
              />
              <div className="space-y-1 p-2 text-sm">
                {photo.caption ? <p className="font-medium">{photo.caption}</p> : null}
                <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>
                    {photo.roundNumber ? `Round ${photo.roundNumber}` : "This game"}
                    {photo.uploaderName ? ` · ${photo.uploaderName}` : ""}
                  </span>
                  {photo.canDelete ? <KeyMomentDeleteButton gameId={gameId} photoId={photo.id} /> : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">
          Snap the big Blitz, the table, or the sore loser. Photos show here for everyone who opens this game.
        </p>
      )}
    </section>
  );
}
