"use client";

export type CTAState =
  | { mode: "submit"; remainingCount: number; allComplete: boolean }
  | { mode: "nextRound"; roundNumber: number }
  | { mode: "gameOver" };

export function FloatingCTA({
  state,
  onAction,
}: {
  state: CTAState;
  onAction: () => void;
}) {
  if (state.mode === "gameOver") return null;

  const isSubmit = state.mode === "submit";
  const disabled = isSubmit && !state.allComplete;
  const label = isSubmit
    ? state.allComplete
      ? "Submit Round"
      : `Submit Round (${state.remainingCount} remaining)`
    : `Enter Round ${state.roundNumber} Scores`;

  return (
    <div className="sticky bottom-0 z-40 p-4 bg-gradient-to-t from-[#fff7ea] via-[#fff7ea] to-transparent pt-8">
      <div className="max-w-[440px] mx-auto">
        <button
          onClick={onAction}
          disabled={disabled}
          className={`w-full py-3.5 rounded-xl text-[15px] font-bold transition-all ${
            disabled
              ? "bg-[#f0e6d2] text-[#d1bfa8] cursor-not-allowed"
              : isSubmit
                ? "bg-[#2a6517] text-white hover:bg-[#1d4a10] cursor-pointer"
                : "bg-[#290806] text-white hover:bg-[#3d1a0a] cursor-pointer"
          }`}
        >
          {label}
        </button>
      </div>
    </div>
  );
}
