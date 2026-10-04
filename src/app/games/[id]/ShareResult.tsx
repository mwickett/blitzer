"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Share2 } from "lucide-react";
import { usePostHog } from "posthog-js/react";

type Method = "image" | "link" | "copy";

async function loadImage(gameId: string): Promise<File | null> {
  try {
    const response = await fetch(`/games/${gameId}/opengraph-image`);
    if (!response.ok) return null;
    const blob = await response.blob();
    return new File([blob], "blitzer-game.png", { type: "image/png" });
  } catch {
    return null;
  }
}

/**
 * Shares a finished game: the recap picture where the device can share
 * files, otherwise the link (whose preview is the same picture), otherwise
 * a copied link.
 */
export default function ShareResult({
  gameId,
  winnerName,
}: {
  gameId: string;
  winnerName: string;
}) {
  const posthog = usePostHog();
  const [state, setState] = useState<"idle" | "shared" | "copied" | "failed">(
    "idle",
  );
  // The share sheet only opens within a moment of the tap, too soon to wait
  // for the picture to be drawn, so it loads with the page. Until it is
  // ready the button shares the link, whose preview is the same picture.
  const image = useRef<File | null>(null);
  useEffect(() => {
    let active = true;
    loadImage(gameId).then((file) => {
      if (active) image.current = file;
    });
    return () => {
      active = false;
    };
  }, [gameId]);

  const share = async () => {
    const url = window.location.href;
    const title = `${winnerName} won at Dutch Blitz`;
    let method: Method;
    try {
      if (typeof navigator.share === "function") {
        const file = image.current;
        if (file && navigator.canShare?.({ files: [file] })) {
          method = "image";
          await navigator.share({ title, url, files: [file] });
        } else {
          method = "link";
          await navigator.share({ title, url });
        }
      } else {
        method = "copy";
        await navigator.clipboard.writeText(url);
      }
    } catch (error) {
      // Closing the share sheet is not a failure worth reporting.
      if (error instanceof DOMException && error.name === "AbortError") return;
      setState("failed");
      return;
    }
    setState(method === "copy" ? "copied" : "shared");
    try {
      posthog.capture("game_result_shared", { game_id: gameId, method });
    } catch {
      // Optional analytics must not undo a completed share.
    }
  };

  return (
    <div className="mx-auto mt-6 flex max-w-2xl flex-col items-center gap-1">
      <button
        type="button"
        onClick={share}
        className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-[#290806] px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-[#3d1a0a]"
      >
        {state === "shared" || state === "copied" ? (
          <Check className="h-4 w-4" aria-hidden />
        ) : (
          <Share2 className="h-4 w-4" aria-hidden />
        )}
        {state === "copied"
          ? "Link copied"
          : state === "shared"
            ? "Shared"
            : "Share result"}
      </button>
      {state === "failed" ? (
        <p role="status" className="text-xs text-destructive">
          Couldn&apos;t share. Copy the address from your browser instead.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Sends a picture of the final scores to your group chat.
        </p>
      )}
    </div>
  );
}
