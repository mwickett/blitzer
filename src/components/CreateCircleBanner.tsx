"use client";

import { useCallback, useSyncExternalStore } from "react";
import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { Button } from "@/components/ui/button";

function useLocalStorage(key: string): [boolean, () => void] {
  const subscribe = useCallback(
    (callback: () => void) => {
      const handler = (e: StorageEvent) => {
        if (e.key === key) callback();
      };
      window.addEventListener("storage", handler);
      return () => window.removeEventListener("storage", handler);
    },
    [key],
  );

  const getSnapshot = useCallback(
    () => localStorage.getItem(key) === "true",
    [key],
  );

  const getServerSnapshot = useCallback(() => true, []);

  const isDismissed = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const dismiss = useCallback(() => {
    localStorage.setItem(key, "true");
    window.dispatchEvent(
      new StorageEvent("storage", { key, newValue: "true" }),
    );
  }, [key]);

  return [isDismissed, dismiss];
}

/**
 * Shown to players who have only ever played pickup games. Dismissible — the
 * nav's organization switcher is still a permanent way in, so this does not
 * need to nag.
 */
export default function CreateCircleBanner() {
  const { userId } = useAuth();
  const [dismissed, dismiss] = useLocalStorage(
    `blitzer:create-circle-banner-dismissed:${userId}`,
  );

  if (dismissed) return null;

  return (
    <div className="mb-4 rounded-lg border border-[#e6d7c3] bg-[#f7f2e9] p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="font-semibold text-[#2a0e02]">
            Play with the same crew often?
          </div>
          <div className="mt-1 text-sm text-[#5a341f]">
            A Circle keeps your regular players together, so you can start a
            game without scanning a code every time.
          </div>
        </div>
        <div className="flex flex-shrink-0 gap-2">
          <Button size="sm" className="bg-[#5a341f] hover:bg-[#3d1a0a]" asChild>
            <Link href="/circles/setup">Create a Circle</Link>
          </Button>
          <Button size="sm" variant="ghost" onClick={dismiss}>
            Dismiss
          </Button>
        </div>
      </div>
    </div>
  );
}
