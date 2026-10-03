/**
 * Shared streaming fallback for route `loading.tsx` files: a title bar and a
 * few placeholder rows. It renders inside the layout's <main>, so it is not a
 * landmark itself, and the label sits in a status region that is never busy
 * so screen readers can announce it.
 */
export function RouteLoading({
  label,
  rows = 4,
}: {
  label: string;
  rows?: number;
}) {
  return (
    <div className="container mx-auto px-4 py-8">
      <p role="status" className="sr-only">
        {label}
      </p>
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
