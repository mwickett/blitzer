import type { DeckId } from "@/lib/scoring/decks";

/**
 * Original line drawings of the four deck symbols. They are drawn in-house
 * on purpose: the printed card art belongs to the publisher.
 */
const PATHS: Record<DeckId, React.ReactNode> = {
  // Walking plow: two handles, beam, and a curved share.
  plow: (
    <>
      <path d="M3 5l7 8" />
      <path d="M6 4l6 9" />
      <path d="M10 13h8" />
      <path d="M14 13c0 3 2 5 5 5h2" />
      <path d="M14 13l-1 5h8" />
    </>
  ),
  // Hand water pump: body, cap, spout, lever handle, and base.
  pump: (
    <>
      <path d="M9 6h6v13H9z" />
      <path d="M8 6h8" />
      <path d="M15 10h4v3" />
      <path d="M12 6V3l-7 3" />
      <path d="M7 21h10" />
    </>
  ),
  // Pail with a bail handle and a rim band.
  bucket: (
    <>
      <path d="M5 9h14l-2 11H7z" />
      <path d="M6 12h12" />
      <path d="M5 9c0-5 14-5 14 0" />
    </>
  ),
  // Open buggy: seat body, dash, canopy, and two wheels.
  carriage: (
    <>
      <path d="M6 9h8v5H5z" />
      <path d="M6 9c0-4 7-5 8-1" />
      <path d="M14 14h5l2-3" />
      <circle cx="7" cy="18" r="2.5" />
      <circle cx="17" cy="18" r="2.5" />
    </>
  ),
};

export function DeckIcon({
  deck,
  className = "h-5 w-5",
  title,
}: {
  deck: DeckId;
  className?: string;
  /** Accessible name; omit when a visible label sits next to the icon. */
  title?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
    >
      {title ? <title>{title}</title> : null}
      {PATHS[deck]}
    </svg>
  );
}
