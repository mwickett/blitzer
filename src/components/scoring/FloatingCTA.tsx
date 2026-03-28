"use client";

export type CTAState =
  | { mode: "submit"; remainingCount: number; allComplete: boolean }
  | { mode: "nextRound"; roundNumber: number }
  | { mode: "editing" }
  | { mode: "gameOver" };

export function FloatingCTA({
  state,
  onAction,
  onCancel,
}: {
  state: CTAState;
  onAction: () => void;
  onCancel?: () => void;
}) {
  if (state.mode === "gameOver") return null;

  if (state.mode === "editing") {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-40 p-4 bg-gradient-to-t from-[#fff7ea] via-[#fff7ea] to-transparent pt-8">
        <div className="max-w-[440px] mx-auto flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 py-3.5 rounded-xl text-[15px] font-bold bg-[#f0e6d2] text-[#8b5e3c] cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={onAction}
            className="flex-1 py-3.5 rounded-xl text-[15px] font-bold bg-[#2a6517] text-white cursor-pointer hover:bg-[#1d4a10] transition-colors"
          >
            Save Changes
          </button>
        </div>
      </div>
    );
  }

  const isSubmit = state.mode === "submit";
  const disabled = isSubmit && !state.allComplete;
  const label = isSubmit
    ? state.allComplete
      ? "Submit Round"
      : `Submit Round (${state.remainingCount} remaining)`
    : `Enter Round ${state.roundNumber} Scores`;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 p-4 bg-gradient-to-t from-[#fff7ea] via-[#fff7ea] to-transparent pt-8">
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
