"use client";

import { useState, useEffect, useRef } from "react";

interface UndoToastProps {
  roundNumber: number;
  onUndo: () => void;
  onDismiss: () => void;
  durationMs?: number;
}

export function UndoToast({
  roundNumber,
  onUndo,
  onDismiss,
  durationMs = 5000,
}: UndoToastProps) {
  const [progress, setProgress] = useState(100);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const intervalMs = 100;

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setProgress((prev) => {
        const next = prev - (intervalMs / durationMs) * 100;
        if (next <= 0) {
          if (timerRef.current) clearInterval(timerRef.current);
          onDismiss();
          return 0;
        }
        return next;
      });
    }, intervalMs);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [durationMs, onDismiss]);

  const handleUndo = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    onUndo();
  };

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 w-[calc(100%-32px)] max-w-[408px] z-50">
      <div className="bg-[#290806] text-white rounded-xl px-4 pt-3 pb-4 shadow-xl">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-medium">
            Round {roundNumber} submitted
          </span>
          <button
            onClick={handleUndo}
            className="text-[13px] font-bold text-[#fbbf24] px-3 py-1 rounded-lg bg-[rgba(251,191,36,0.15)] hover:bg-[rgba(251,191,36,0.25)] transition-colors cursor-pointer"
          >
            Undo
          </button>
        </div>
        <div className="mt-2 h-[3px] bg-[rgba(255,255,255,0.15)] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#fbbf24] rounded-full transition-all"
            style={{
              width: `${progress}%`,
              transitionDuration: `${intervalMs}ms`,
              transitionTimingFunction: "linear",
            }}
          />
        </div>
      </div>
    </div>
  );
}
