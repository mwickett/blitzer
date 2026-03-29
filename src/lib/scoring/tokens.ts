// Reference for scoring design tokens — CSS custom properties are the source of truth.
// Use these Tailwind classes in components:
//
// Backgrounds:   bg-[var(--scoring-bg)]  bg-[var(--scoring-bg-muted)]  bg-[var(--scoring-bg-subtle)]
// Borders:       border-[var(--scoring-border)]  border-[var(--scoring-border-muted)]
// Text:          text-[var(--scoring-text)]  text-[var(--scoring-text-muted)]  text-[var(--scoring-text-negative)]
// Success:       bg-[var(--scoring-success)]
//
// Accent colors (player-specific) remain as inline styles since they're dynamic per-player.

export const SCORING_TOKENS = {
  bg: "var(--scoring-bg)",
  bgMuted: "var(--scoring-bg-muted)",
  bgSubtle: "var(--scoring-bg-subtle)",
  border: "var(--scoring-border)",
  borderMuted: "var(--scoring-border-muted)",
  text: "var(--scoring-text)",
  textMuted: "var(--scoring-text-muted)",
  textNegative: "var(--scoring-text-negative)",
  success: "var(--scoring-success)",
} as const;
