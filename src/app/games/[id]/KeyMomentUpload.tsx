"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  KEY_MOMENT_MAX_CAPTION,
  KEY_MOMENT_MAX_EDGE_PX,
  KEY_MOMENT_MAX_PER_GAME,
} from "@/lib/keyMoments";

/** Shrink a phone photo to a JPEG the upload route accepts. */
export async function resizePhoto(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, KEY_MOMENT_MAX_EDGE_PX / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas unavailable");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Encode failed"))), "image/jpeg", 0.85),
    );
  } finally {
    bitmap.close();
  }
}

export function KeyMomentUpload({
  gameId,
  rounds,
  photoCount,
}: {
  gameId: string;
  rounds: { id: string; round: number }[];
  photoCount: number;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [roundId, setRoundId] = useState(rounds.at(-1)?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Release the preview's object URL when it is replaced or unmounted.
  useEffect(() => (preview ? () => URL.revokeObjectURL(preview) : undefined), [preview]);

  const choose = (next: File | null) => {
    setFile(next);
    setPreview(next ? URL.createObjectURL(next) : null);
    setError(null);
  };

  if (photoCount >= KEY_MOMENT_MAX_PER_GAME) {
    return <span className="text-xs text-muted-foreground">Photo limit reached</span>;
  }

  const reset = () => {
    choose(null);
    setCaption("");
    if (inputRef.current) inputRef.current.value = "";
  };

  const upload = async () => {
    if (!file) return;
    setSaving(true);
    setError(null);
    try {
      const photo = await resizePhoto(file).catch(() => null);
      if (!photo) {
        setError("That photo couldn't be read. Try a JPEG or PNG.");
        return;
      }
      const body = new FormData();
      body.set("photo", photo, "photo.jpg");
      body.set("caption", caption);
      body.set("roundId", roundId);
      const response = await fetch(`/api/games/${gameId}/photos`, { method: "POST", body });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setError(data?.error ?? "Couldn't upload that photo. Please try again.");
        return;
      }
      reset();
      router.refresh();
    } catch {
      setError("Couldn't upload that photo. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        aria-label="Choose a photo"
        onChange={(event) => choose(event.target.files?.[0] ?? null)}
      />
      <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
        Add a photo
      </Button>
      {file ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="key-moment-upload-heading"
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
        >
          <div className="w-full max-w-md space-y-3 rounded-lg bg-background p-4 shadow-lg">
            <h3 id="key-moment-upload-heading" className="font-semibold">Add a key moment</h3>
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
              <img src={preview} alt="Selected photo" className="max-h-64 w-full rounded-md object-contain" />
            ) : null}
            <label className="block text-sm">
              <span className="font-medium">Caption (optional)</span>
              <Input
                value={caption}
                maxLength={KEY_MOMENT_MAX_CAPTION}
                placeholder="Grandpa's first Blitz in years"
                onChange={(event) => setCaption(event.target.value)}
                className="mt-1"
              />
            </label>
            {rounds.length ? (
              <label className="block text-sm">
                <span className="font-medium">Round</span>
                <select
                  value={roundId}
                  onChange={(event) => setRoundId(event.target.value)}
                  className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">The whole game</option>
                  {rounds.map((round) => (
                    <option key={round.id} value={round.id}>
                      Round {round.round}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={reset} disabled={saving}>
                Cancel
              </Button>
              <Button type="button" onClick={upload} disabled={saving}>
                {saving ? "Uploading…" : "Upload"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function KeyMomentDeleteButton({ gameId, photoId }: { gameId: string; photoId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const remove = async () => {
    if (!window.confirm("Remove this photo?")) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/games/${gameId}/photos/${photoId}`, { method: "DELETE" });
      if (response.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  };
  return (
    <button type="button" onClick={remove} disabled={busy} className="underline-offset-2 hover:underline disabled:opacity-50">
      Remove
    </button>
  );
}
