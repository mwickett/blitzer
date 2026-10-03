/**
 * Shared streaming fallback for route `loading.tsx` files: a title bar and a
 * few placeholder rows, announced to assistive tech as one busy region.
 */
export function RouteLoading({
  label,
  rows = 4,
}: {
  label: string;
  rows?: number;
}) {
  return (
    <main
      className="container mx-auto px-4 py-8"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">{label}</span>
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
    </main>
  );
}
