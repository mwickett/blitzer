/**
 * The dashboard's StatCard is not reused here: the marketing page is flat
 * throughout and shows a single numeral in the display face.
 */
export function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-brandAccent p-4 text-brand">
      <div className="text-[11px] font-medium opacity-70">{label}</div>
      <div className="mt-1 font-display text-3xl font-bold leading-tight tracking-[-0.018em]">
        {value}
      </div>
    </div>
  );
}
