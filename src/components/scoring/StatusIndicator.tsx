import { type EntryStatus } from "./types";

const STATUS_CONFIG = {
  empty: { bg: "bg-[#f0e6d2]", text: "text-[#d1bfa8]", icon: "○" },
  partial: { bg: "bg-[#fef3c7]", text: "text-[#b45309]", icon: "½" },
  complete: { bg: "bg-[#dcfce7]", text: "text-[#2a6517]", icon: "✓" },
} as const;

export function StatusIndicator({ status }: { status: EntryStatus }) {
  const config = STATUS_CONFIG[status];
  return (
    <div
      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${config.bg} ${config.text}`}
    >
      {config.icon}
    </div>
  );
}
