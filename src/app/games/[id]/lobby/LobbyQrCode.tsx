"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

/**
 * The lobby polls itself every few seconds to pick up new players. Encoding
 * the QR on the server would put a fresh ~10KB data URL in every one of those
 * refreshes even though the join URL never changes, so it is built once here
 * instead. The encoder is imported lazily so it only ships to people who are
 * actually sitting in a lobby.
 */
export function LobbyQrCode({ joinUrl }: { joinUrl: string }) {
  const [dataUrl, setDataUrl] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    import("qrcode")
      .then(({ toDataURL }) =>
        toDataURL(joinUrl, {
          width: 560,
          margin: 2,
          color: { dark: "#2a0e02", light: "#ffffff" },
        }),
      )
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [joinUrl]);

  return (
    <div className="ph-no-capture mx-auto w-full max-w-[280px] overflow-hidden rounded-xl border bg-white p-3">
      <div className="relative aspect-square w-full">
        {dataUrl ? (
          <Image
            src={dataUrl}
            alt="QR code to join this pickup game"
            width={560}
            height={560}
            unoptimized
            className="h-auto w-full"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center rounded-lg bg-[#faf5ed] text-center text-sm text-muted-foreground">
            {failed
              ? "Couldn't draw the QR code — share the lobby code instead."
              : "Preparing QR code…"}
          </div>
        )}
      </div>
    </div>
  );
}
