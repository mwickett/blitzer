/**
 * The dashboard's BasicStatBlock is not reused here: it wraps ui/card, which
 * hardcodes shadow-sm, and the marketing page is flat throughout. This also
 * lets the numeral use the display face.
 */
export function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-brandAccent p-4 text-brand">
      <div className="text-[11px] font-medium opacity-70">{label}</div>
      <div className="mt-1 font-display text-3xl font-bold leading-tight">
        {value}
      </div>
    </div>
  );
}
