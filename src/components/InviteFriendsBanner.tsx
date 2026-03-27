"use client";

import { useState, useCallback, useSyncExternalStore } from "react";
import { useAuth, useOrganization } from "@clerk/nextjs";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface InviteFriendsBannerProps {
  uninvitedCount: number;
}

function useLocalStorage(key: string): [boolean, () => void] {
  const subscribe = useCallback(
    (callback: () => void) => {
      const handler = (e: StorageEvent) => {
        if (e.key === key) callback();
      };
      window.addEventListener("storage", handler);
      return () => window.removeEventListener("storage", handler);
    },
    [key]
  );

  const getSnapshot = useCallback(
    () => localStorage.getItem(key) === "true",
    [key]
  );

  const getServerSnapshot = useCallback(() => true, []);

  const isDismissed = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );

  const dismiss = useCallback(() => {
    localStorage.setItem(key, "true");
    // Force re-render by dispatching a storage event won't work same-tab,
    // so we use a state toggle below
    window.dispatchEvent(
      new StorageEvent("storage", { key, newValue: "true" })
    );
  }, [key]);

  return [isDismissed, dismiss];
}

export default function InviteFriendsBanner({
  uninvitedCount,
}: InviteFriendsBannerProps) {
  const { userId } = useAuth();
  const { organization } = useOrganization();

  const storageKey = `blitzer:invite-banner-dismissed:${userId}:${organization?.id}`;
  const [dismissed, dismiss] = useLocalStorage(storageKey);

  if (dismissed || uninvitedCount === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-[#e6d7c3] bg-[#f7f2e9] p-4 mb-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="font-semibold text-[#2a0e02]">
            Invite your previous Blitzer friends
          </div>
          <div className="text-sm text-[#5a341f] mt-1">
            You have{" "}
            <strong>
              {uninvitedCount} {uninvitedCount === 1 ? "friend" : "friends"}
            </strong>{" "}
            from before Circles who aren&apos;t in this circle yet.
          </div>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <Button size="sm" className="bg-[#5a341f] hover:bg-[#3d1a0a]" asChild>
            <Link href="/circles/invite-friends">Invite</Link>
          </Button>
          <Button size="sm" variant="ghost" onClick={dismiss}>
            Dismiss
          </Button>
        </div>
      </div>
    </div>
  );
}
