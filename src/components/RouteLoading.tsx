"use client";

import { useEffect, useRef } from "react";

/**
 * Shared streaming fallback for route `loading.tsx` files: a title bar and a
 * few placeholder rows. It renders inside the layout's <main>, so it is not a
 * landmark itself. The label sits in a status region that is never busy and
 * is filled after mount, since text present when a live region first appears
 * is often not announced.
 */
export function RouteLoading({
  label,
  rows = 4,
}: {
  label: string;
  rows?: number;
}) {
  const status = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (status.current) status.current.textContent = label;
  }, [label]);

  return (
    <div className="container mx-auto px-4 py-8">
      <p ref={status} role="status" className="sr-only" />
      <div aria-hidden="true" className="animate-pulse space-y-4">
        <div className="h-8 w-48 rounded-md bg-[#e6d7c3]" />
        <div className="h-4 w-72 max-w-full rounded bg-[#f0e6d2]" />
        {Array.from({ length: rows }, (_, index) => (
          <div
            key={index}
            className="h-20 rounded-lg border border-[#e6d7c3] bg-[#f7f2e9]"
          />
        ))}
      </div>
    </div>
  );
}
