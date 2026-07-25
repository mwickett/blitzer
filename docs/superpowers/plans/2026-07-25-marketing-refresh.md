# Marketing Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the unauthenticated marketing site — a chronological landing page that shows the real product via live components, plus a six-page `/guide` section — on a tightened version of the existing cream-and-espresso brand.

**Architecture:** The landing page is composed of small server components in `src/components/marketing/`, each rendering one section. They embed the *actual* scoring components (`RaceTrack`, `Standings`, `WinProbabilityCard`, `ScoreProgressionCard`, `BasicStatBlock`) fed by a single shared fixture module, so the marketing page can never drift from the product's real UI. Guide pages are TSX (not MDX) so they can embed those same live components. Client boundaries are introduced only where a component needs hooks or callbacks.

**Tech Stack:** Next.js App Router, React server components, Tailwind, Clerk (`Show`, `SignUpButton`), PostHog (`posthog-js/react`), Jest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-07-25-marketing-refresh-design.md`

## Global Constraints

Every task's requirements implicitly include this section.

- **Palette:** cream `#fff7ea` (`bg-brand`), espresso `#290806` (`text-brandAccent`), warm border `#e6d7c3`, muted text `#8b5e3c`, subtle surface `#faf5ed`, raised surface `#ffffff`.
- **Banned styling:** no `shadow-*`, no `hover:-translate-y-*`, no gradient blur blobs, no `animate-pulse`, no icon-in-a-circle feature cards. Section separation comes from alternating ground colour only.
- **Panel idiom:** flat, `border-[1.5px]` warm border, `rounded-xl`. Matches `Standings.tsx` and `WinProbabilityCard.tsx`.
- **Colour discipline:** deck colours (`#3b82f6`, `#ef4444`, `#eab308`, `#22c55e`) appear **only inside product panels** — never on headings, buttons, or backgrounds.
- **Circles claims:** marketing copy may claim **only** shared history and shareable results. Any wording implying group standings, group stats, leaderboards, or head-to-head records is forbidden — none of it exists (`src/server/queries/stats.ts` is entirely `…ForUser`).
- **Barred claims** (from the retired Notion vision doc, none of which ship): friend approval / friend requests; comparison against "the best Dutch Blitz players in the world"; leaderboards; outlier-game showcases; AI chat / Insights.
- **Insights is not promoted anywhere** in marketing or guide copy — it is gated behind the `llm-features` PostHog flag.
- **PostHog events:** snake_case, no PII (no names, emails, IPs). Events used here: `marketing_cta_clicked` `{section, destination}` and `guide_page_viewed` `{slug}`.
- **Typography:** Fraunces for headings, Inter for body.
- **Prisma types** import from `@/generated/prisma/client`, never `@prisma/client`. (Not expected to come up in this plan, but it is a repo-wide rule.)
- **Run `npm test` before every commit.** Coverage collection is on by default in `jest.config.js`.

---

## File Structure

**Create:**

| File | Responsibility |
| --- | --- |
| `src/components/marketing/fixtures.ts` | The one demo game — players, colours, per-round deltas, cumulative scores. Single source for every section. |
| `src/components/marketing/MarketingCta.tsx` | `"use client"` — tracked, styled CTA link + auth-aware start-game CTA. |
| `src/components/marketing/WinProbabilityDemo.tsx` | `"use client"` wrapper so `WinProbabilityCard` (which calls `useMemo` with no directive) can render on a server page. |
| `src/components/marketing/ScoreEntryPreview.tsx` | `"use client"` wrapper supplying the no-op `onUpdate` that `ScoreEntryCard` requires. |
| `src/components/marketing/Section.tsx` | Shared section shell — ground colour, padding, eyebrow rule. |
| `src/components/marketing/Hero.tsx` | Hero + live `RaceTrack`. |
| `src/components/marketing/GatherSection.tsx` | Section 1 — lobby panel, static QR, guest players. |
| `src/components/marketing/PlaySection.tsx` | Section 2 — score entry + live `Standings`. |
| `src/components/marketing/SettleSection.tsx` | Section 3 — espresso ground, live win probability. |
| `src/components/marketing/RememberSection.tsx` | Section 4 — stats + progression chart. Constrained Circles claims. |
| `src/components/marketing/QuoteSection.tsx` | Section 5 — signed pull-quote. |
| `src/components/marketing/GuideTeaser.tsx` | Section 6 — three cards into `/guide`. |
| `src/components/marketing/FinalCta.tsx` | Section 7. |
| `src/components/marketing/Prose.tsx` | Shared guide typography. |
| `src/components/marketing/navLinks.ts` | Pure nav link sets, testable without Clerk. |
| `src/app/guide/layout.tsx` | Guide shell + `guide_page_viewed` tracking. |
| `src/app/guide/page.tsx` | Hub + FAQ. |
| `src/app/guide/{getting-started,how-scoring-works,circles-and-pickup-games,reading-your-stats,why-blitzer}/page.tsx` | Topic pages. |
| `public/img/demo-qr.png` | Decorative QR for the Gather section. |

**Modify:** `tailwind.config.ts`, `src/app/globals.css`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/NavBar.tsx`, `src/components/Footer.tsx`, `jest.setup.js`.

**Phasing:** Tasks 1–13 are phase 1 (landing + chrome) and ship independently. Tasks 14–20 are phase 2 (guide). If phase 1 ships alone, omit `GuideTeaser` from the page composition in Task 11 and remove the `Guide` nav link in Task 12 — both are called out in those tasks.

---

## Task 1: Foundation — tokens, display font, test mocks

**Files:**
- Modify: `src/app/globals.css:6-8` (`:root` block), end of file
- Modify: `tailwind.config.ts:18-50` (`colors`), `theme.extend`
- Modify: `src/app/layout.tsx:7,13,59`
- Modify: `jest.setup.js:19-32`

**Interfaces:**
- Consumes: nothing
- Produces: Tailwind classes `bg-surfaceRaised`, `bg-surfaceSubtle`, `border-borderWarm`, `text-textMuted`, `font-display`. Jest mocks for `@clerk/nextjs` (`Show`, `SignUpButton`, `SignInButton`, `UserButton`, `OrganizationSwitcher`) and `posthog-js/react` (`usePostHog`, `PostHogProvider`).

- [ ] **Step 1: Add CSS variables**

In `src/app/globals.css`, inside the `:root` block immediately after `--brand-accent: #290806;`:

```css
    /* Marketing surface tokens — same values the scoring UI already uses */
    --surface-raised: #ffffff;
    --surface-subtle: #faf5ed;
    --border-warm: #e6d7c3;
    --text-muted: #8b5e3c;
```

- [ ] **Step 2: Add the display-font variation settings**

Append to the end of `src/app/globals.css`:

```css
/*
 * Tailwind generates `.font-display` with the family from tailwind.config.ts.
 * This augments that same class with Fraunces' optical axes: SOFT rounds the
 * terminals and WONK enables the alternate italic-ish forms, which is what
 * makes it rhyme with the logo wordmark rather than read as a stock serif.
 */
@layer utilities {
  .font-display {
    font-variation-settings: "SOFT" 40, "WONK" 1;
    letter-spacing: -0.018em;
  }
}
```

- [ ] **Step 3: Register the tokens and font family in Tailwind**

In `tailwind.config.ts`, add to `theme.extend.colors` (after the `brandAccent` line):

```ts
        surfaceRaised: "var(--surface-raised)",
        surfaceSubtle: "var(--surface-subtle)",
        borderWarm: "var(--border-warm)",
        textMuted: "var(--text-muted)",
```

And add a sibling of `colors` inside `theme.extend`:

```ts
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
      },
```

- [ ] **Step 4: Load Fraunces**

In `src/app/layout.tsx`, change the font import on line 7 and add the loader:

```tsx
import { Inter, Fraunces } from "next/font/google";

const inter = Inter({ subsets: ["latin"] });
const fraunces = Fraunces({
  subsets: ["latin"],
  axes: ["SOFT", "WONK", "opsz"],
  display: "swap",
  variable: "--font-display",
});
```

Then update the `<body>` className (line 59):

```tsx
          <body className={`${inter.className} ${fraunces.variable} bg-brand`}>
```

- [ ] **Step 5: Extend the test mocks**

In `jest.setup.js`, replace the existing `jest.mock('@clerk/nextjs', …)` block with:

```js
// Mock clerk/nextjs
// `Show` renders its children unconditionally here. Tests that need to assert
// on a specific auth state should test the pure link sets in
// src/components/marketing/navLinks.ts instead of rendering Clerk components.
jest.mock('@clerk/nextjs', () => ({
  auth: () => ({
    userId: 'test-user-id',
  }),
  currentUser: () => ({
    id: 'test-user-id',
    email: 'test@example.com',
  }),
  Show: ({ children }) => children,
  SignInButton: ({ children }) => children,
  SignUpButton: ({ children }) => children,
  UserButton: () => null,
  OrganizationSwitcher: () => null,
}))

// Mock posthog-js/react (client-side analytics)
jest.mock('posthog-js/react', () => ({
  usePostHog: () => ({ capture: jest.fn() }),
  PostHogProvider: ({ children }) => children,
}))
```

- [ ] **Step 6: Verify the build and existing tests still pass**

Run: `npm test`
Expected: PASS — no existing test should change behaviour.

Run: `npm run build`
Expected: build succeeds. If `next/font` rejects the `axes` array, confirm the installed Next.js version supports variable-axis subsetting for Fraunces; the fallback is to drop `"opsz"` from `axes` and keep `SOFT` and `WONK`.

- [ ] **Step 7: Commit**

```bash
git add src/app/globals.css tailwind.config.ts src/app/layout.tsx jest.setup.js
git commit -m "feat: add marketing surface tokens, Fraunces display font, and test mocks"
```

---

## Task 2: Demo game fixtures

**Files:**
- Create: `src/components/marketing/fixtures.ts`
- Test: `src/components/__tests__/marketing/fixtures.test.ts`

**Interfaces:**
- Consumes: `PlayerWithScore` from `@/components/scoring/types`
- Produces: `DEMO_PLAYERS: PlayerWithScore[]`, `DEMO_WIN_THRESHOLD: 75`, `DEMO_ROUNDS_PLAYED: 4`, `DEMO_DELTAS_BY_PLAYER: Record<string, number[]>`, `DEMO_SCORES_BY_ROUND: Record<string, number[]>`

**Why this is tested:** every section renders a slice of this data. If the standings say 58 and the progression chart ends at 61, the page contradicts itself in a way no type checker catches. The test locks the internal arithmetic together.

- [ ] **Step 1: Write the failing test**

Create `src/components/__tests__/marketing/fixtures.test.ts`:

```ts
import {
  DEMO_PLAYERS,
  DEMO_WIN_THRESHOLD,
  DEMO_ROUNDS_PLAYED,
  DEMO_DELTAS_BY_PLAYER,
  DEMO_SCORES_BY_ROUND,
} from "@/components/marketing/fixtures";
import { ACCENT_COLORS } from "@/lib/scoring/colors";

describe("marketing fixtures", () => {
  it("gives every player a colour from the real accent palette", () => {
    const palette = ACCENT_COLORS.map((c) => c.value);
    for (const player of DEMO_PLAYERS) {
      expect(palette).toContain(player.color);
    }
  });

  it("has enough rounds for the win-probability forecast to render", () => {
    // WinProbabilityCard falls back to "Available after 3 rounds" below this.
    expect(DEMO_ROUNDS_PLAYED).toBeGreaterThanOrEqual(3);
  });

  it("keeps deltas, cumulative scores, and standings in agreement", () => {
    for (const player of DEMO_PLAYERS) {
      const deltas = DEMO_DELTAS_BY_PLAYER[player.id];
      const cumulative = DEMO_SCORES_BY_ROUND[player.id];

      expect(deltas).toHaveLength(DEMO_ROUNDS_PLAYED);
      expect(cumulative).toHaveLength(DEMO_ROUNDS_PLAYED);

      const runningTotals = deltas.reduce<number[]>((acc, delta) => {
        acc.push((acc[acc.length - 1] ?? 0) + delta);
        return acc;
      }, []);

      expect(runningTotals).toEqual(cumulative);
      expect(player.score).toBe(cumulative[cumulative.length - 1]);
    }
  });

  it("keeps every player short of the win threshold so the game reads as live", () => {
    for (const player of DEMO_PLAYERS) {
      expect(player.score).toBeLessThan(DEMO_WIN_THRESHOLD);
    }
  });

  it("includes a guest player, since the Gather section claims guests are supported", () => {
    const guests = DEMO_PLAYERS.filter((p) => p.isGuest);
    expect(guests).toHaveLength(1);
    expect(guests[0].guestId).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/components/__tests__/marketing/fixtures.test.ts`
Expected: FAIL — `Cannot find module '@/components/marketing/fixtures'`

- [ ] **Step 3: Write the fixtures**

Create `src/components/marketing/fixtures.ts`:

```ts
import { type PlayerWithScore } from "@/components/scoring/types";

/**
 * One demo game, shared by every marketing section so the page reads as a
 * single continuous evening rather than four unrelated screenshots.
 *
 * The numbers are load-bearing: `fixtures.test.ts` asserts that the deltas
 * sum to the cumulative scores and that those match the standings. Change one
 * array and you must change the others.
 */

export const DEMO_WIN_THRESHOLD = 75;
export const DEMO_ROUNDS_PLAYED = 4;

export const DEMO_PLAYERS: PlayerWithScore[] = [
  {
    id: "dana",
    name: "Dana",
    color: "#eab308",
    isGuest: false,
    userId: "dana",
    score: 58,
  },
  {
    id: "mike",
    name: "Mike",
    color: "#ef4444",
    isGuest: false,
    userId: "mike",
    score: 44,
  },
  {
    id: "priya",
    name: "Priya",
    color: "#22c55e",
    isGuest: false,
    userId: "priya",
    score: 36,
  },
  {
    id: "tom",
    name: "Tom",
    color: "#3b82f6",
    isGuest: true,
    guestId: "tom",
    score: 21,
  },
];

/** Per-round score change, oldest round first. */
export const DEMO_DELTAS_BY_PLAYER: Record<string, number[]> = {
  dana: [12, 15, 16, 15],
  mike: [9, 12, 12, 11],
  priya: [7, 11, 10, 8],
  tom: [4, 7, 5, 5],
};

/** Running totals after each round — what ScoreProgressionCard plots. */
export const DEMO_SCORES_BY_ROUND: Record<string, number[]> = {
  dana: [12, 27, 43, 58],
  mike: [9, 21, 33, 44],
  priya: [7, 18, 28, 36],
  tom: [4, 11, 16, 21],
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/components/__tests__/marketing/fixtures.test.ts`
Expected: PASS — 5 tests

- [ ] **Step 5: Commit**

```bash
git add src/components/marketing/fixtures.ts src/components/__tests__/marketing/fixtures.test.ts
git commit -m "feat: add shared marketing demo-game fixtures"
```

---

## Task 3: Tracked CTA components

**Files:**
- Create: `src/components/marketing/MarketingCta.tsx`
- Test: `src/components/__tests__/marketing/MarketingCta.test.tsx`

**Interfaces:**
- Consumes: Task 1's `posthog-js/react` and `@clerk/nextjs` mocks
- Produces:
  - `MarketingCta({ section: string, href: string, variant?: CtaVariant, children: React.ReactNode })`
  - `StartGameCta({ section: string, variant?: CtaVariant, children?: React.ReactNode })`
  - `type CtaVariant = "primary" | "ghost" | "inverse" | "inverseGhost"`

- [ ] **Step 1: Write the failing test**

Create `src/components/__tests__/marketing/MarketingCta.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Must be named `mock*` — jest.mock factories are hoisted above imports and
// may only reference out-of-scope variables whose names begin with "mock".
const mockCapture = jest.fn();
jest.mock("posthog-js/react", () => ({
  usePostHog: () => ({ capture: mockCapture }),
}));

import { MarketingCta } from "@/components/marketing/MarketingCta";

describe("MarketingCta", () => {
  beforeEach(() => mockCapture.mockClear());

  it("renders a link to the destination", () => {
    render(
      <MarketingCta section="hero" href="/guide">
        See how it works
      </MarketingCta>
    );

    expect(
      screen.getByRole("link", { name: "See how it works" })
    ).toHaveAttribute("href", "/guide");
  });

  it("captures a snake_case event with the section and destination, and no PII", async () => {
    const user = userEvent.setup();
    render(
      <MarketingCta section="hero" href="/guide">
        See how it works
      </MarketingCta>
    );

    await user.click(screen.getByRole("link", { name: "See how it works" }));

    expect(mockCapture).toHaveBeenCalledWith("marketing_cta_clicked", {
      section: "hero",
      destination: "/guide",
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/components/__tests__/marketing/MarketingCta.test.tsx`
Expected: FAIL — `Cannot find module '@/components/marketing/MarketingCta'`

- [ ] **Step 3: Write the implementation**

Create `src/components/marketing/MarketingCta.tsx`:

```tsx
"use client";

import Link from "next/link";
import { Show, SignUpButton } from "@clerk/nextjs";
import { usePostHog } from "posthog-js/react";
import { cn } from "@/lib/utils";

export type CtaVariant = "primary" | "ghost" | "inverse" | "inverseGhost";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-lg border-[1.5px] px-6 py-3.5 text-[15px] font-semibold transition-colors";

const VARIANTS: Record<CtaVariant, string> = {
  primary: "bg-brandAccent border-brandAccent text-brand hover:bg-brandAccent/90",
  ghost: "bg-transparent border-brandAccent text-brandAccent hover:bg-brandAccent/10",
  inverse: "bg-brand border-brand text-brandAccent hover:bg-brand/90",
  inverseGhost: "bg-transparent border-[#7a4038] text-brand hover:bg-white/10",
};

export function MarketingCta({
  section,
  href,
  variant = "primary",
  children,
}: {
  section: string;
  href: string;
  variant?: CtaVariant;
  children: React.ReactNode;
}) {
  const posthog = usePostHog();

  return (
    <Link
      href={href}
      className={cn(BASE, VARIANTS[variant])}
      onClick={() =>
        posthog?.capture("marketing_cta_clicked", {
          section,
          destination: href,
        })
      }
    >
      {children}
    </Link>
  );
}

/**
 * The start-game CTA differs by auth state: a signed-out visitor needs the
 * Clerk sign-up modal, a signed-in one should go straight to /games/new.
 * Clerk's <Show> renders exactly one branch at runtime.
 */
export function StartGameCta({
  section,
  variant = "primary",
  children = "Start a game",
}: {
  section: string;
  variant?: CtaVariant;
  children?: React.ReactNode;
}) {
  const posthog = usePostHog();

  return (
    <>
      <Show when="signed-out">
        <SignUpButton>
          <button
            type="button"
            className={cn(BASE, VARIANTS[variant])}
            onClick={() =>
              posthog?.capture("marketing_cta_clicked", {
                section,
                destination: "sign-up",
              })
            }
          >
            {children}
          </button>
        </SignUpButton>
      </Show>
      <Show when="signed-in">
        <MarketingCta section={section} href="/games/new" variant={variant}>
          {children}
        </MarketingCta>
      </Show>
    </>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/components/__tests__/marketing/MarketingCta.test.tsx`
Expected: PASS — 2 tests

- [ ] **Step 5: Commit**

```bash
git add src/components/marketing/MarketingCta.tsx src/components/__tests__/marketing/MarketingCta.test.tsx
git commit -m "feat: add tracked marketing CTA components"
```

---

## Task 4: Client wrappers for hook-bearing scoring components

**Files:**
- Create: `src/components/marketing/WinProbabilityDemo.tsx`
- Create: `src/components/marketing/ScoreEntryPreview.tsx`
- Test: `src/components/__tests__/marketing/WinProbabilityDemo.test.tsx`

**Interfaces:**
- Consumes: `DEMO_PLAYERS`, `DEMO_ROUNDS_PLAYED`, `DEMO_WIN_THRESHOLD`, `DEMO_DELTAS_BY_PLAYER` (Task 2)
- Produces: `WinProbabilityDemo()` and `ScoreEntryPreview()`, both zero-prop

**Why both wrappers exist:**
- `WinProbabilityCard` calls `useMemo` but has **no** `"use client"` directive of its own — it only ever renders inside client parents today. Importing it directly into a server page throws at build.
- `ScoreEntryCard` requires an `onUpdate` **function** prop. Functions cannot cross the server→client boundary in the App Router, so the no-op must be created inside a client component.

- [ ] **Step 1: Write the failing test**

Create `src/components/__tests__/marketing/WinProbabilityDemo.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { WinProbabilityDemo } from "@/components/marketing/WinProbabilityDemo";

describe("WinProbabilityDemo", () => {
  it("renders real odds rather than the not-enough-rounds fallback", () => {
    render(<WinProbabilityDemo />);

    expect(screen.getByText("Win Probability")).toBeInTheDocument();
    expect(
      screen.queryByText("Available after 3 rounds")
    ).not.toBeInTheDocument();
  });

  it("shows every demo player", () => {
    render(<WinProbabilityDemo />);

    for (const name of ["Dana", "Mike", "Priya", "Tom"]) {
      expect(screen.getByText(name)).toBeInTheDocument();
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/components/__tests__/marketing/WinProbabilityDemo.test.tsx`
Expected: FAIL — `Cannot find module '@/components/marketing/WinProbabilityDemo'`

- [ ] **Step 3: Write both wrappers**

Create `src/components/marketing/WinProbabilityDemo.tsx`:

```tsx
"use client";

import { WinProbabilityCard } from "@/components/scoring/graphs/WinProbabilityCard";
import {
  DEMO_PLAYERS,
  DEMO_ROUNDS_PLAYED,
  DEMO_WIN_THRESHOLD,
  DEMO_DELTAS_BY_PLAYER,
} from "./fixtures";

/**
 * WinProbabilityCard calls useMemo but carries no "use client" directive — in
 * the app it is only ever mounted inside client parents. The marketing page is
 * a server component, so this wrapper supplies the boundary.
 *
 * The Monte Carlo is seeded from its inputs (see makeRng in
 * lib/scoring/probability.ts), so fixed props give identical percentages on
 * server and client. No hydration mismatch.
 */
export function WinProbabilityDemo() {
  return (
    <WinProbabilityCard
      players={DEMO_PLAYERS}
      roundsPlayed={DEMO_ROUNDS_PLAYED}
      winThreshold={DEMO_WIN_THRESHOLD}
      deltasByPlayer={DEMO_DELTAS_BY_PLAYER}
    />
  );
}
```

Create `src/components/marketing/ScoreEntryPreview.tsx`:

```tsx
"use client";

import { ScoreEntryCard } from "@/components/scoring/ScoreEntryCard";
import { DEMO_PLAYERS, DEMO_DELTAS_BY_PLAYER } from "./fixtures";

/**
 * ScoreEntryCard needs an onUpdate callback, and functions cannot be passed
 * from a server component to a client one. The no-op is created here instead.
 *
 * This renders a static, non-interactive preview. Wiring it to local state to
 * make it playable is a deliberate follow-up, not an oversight.
 */
const noop = () => {};

export function ScoreEntryPreview() {
  // The three highest-placed players — four cards overflow the phone frame.
  const shown = DEMO_PLAYERS.slice(0, 3);

  return (
    <div className="space-y-2">
      {shown.map((player) => {
        const deltas = DEMO_DELTAS_BY_PLAYER[player.id];
        const lastDelta = deltas[deltas.length - 1];
        return (
          <ScoreEntryCard
            key={player.id}
            name={player.name}
            color={player.color}
            score={player.score}
            entry={{ blitzRemaining: 0, cardsPlayed: lastDelta }}
            status="complete"
            onUpdate={noop}
          />
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/components/__tests__/marketing/WinProbabilityDemo.test.tsx`
Expected: PASS — 2 tests

If the fallback text appears instead, the forecast returned null: confirm `DEMO_ROUNDS_PLAYED >= 3` and that `DEMO_DELTAS_BY_PLAYER` has an entry for every player id.

- [ ] **Step 5: Commit**

```bash
git add src/components/marketing/WinProbabilityDemo.tsx src/components/marketing/ScoreEntryPreview.tsx src/components/__tests__/marketing/WinProbabilityDemo.test.tsx
git commit -m "feat: add client wrappers for scoring components used in marketing"
```

---

## Task 5: Section shell and Hero

**Files:**
- Create: `src/components/marketing/Section.tsx`
- Create: `src/components/marketing/Hero.tsx`

**Interfaces:**
- Consumes: `StartGameCta`, `MarketingCta` (Task 3); `DEMO_PLAYERS`, `DEMO_WIN_THRESHOLD` (Task 2); `RaceTrack` from `@/components/scoring/RaceTrack`
- Produces:
  - `Section({ ground?: "cream" | "white" | "espresso", children, className? })`
  - `SectionEyebrow({ children })`
  - `Hero()`

- [ ] **Step 1: Write the section shell**

Create `src/components/marketing/Section.tsx`:

```tsx
import { cn } from "@/lib/utils";

const GROUNDS = {
  cream: "bg-brand text-brandAccent border-borderWarm",
  white: "bg-surfaceRaised text-brandAccent border-borderWarm",
  espresso: "bg-brandAccent text-brand border-brandAccent",
} as const;

/**
 * Sections are separated by ground colour and a hairline rule — never by
 * shadow. Alternating cream / white / espresso is what gives the page its
 * rhythm now that the old floating-card treatment is gone.
 */
export function Section({
  ground = "cream",
  className,
  children,
}: {
  ground?: keyof typeof GROUNDS;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn("border-b-[1.5px] px-6 py-16 md:py-20", GROUNDS[ground], className)}
    >
      <div className="mx-auto max-w-5xl">{children}</div>
    </section>
  );
}

export function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.13em] text-textMuted">
      {children}
      <span className="h-px flex-1 bg-current opacity-30" aria-hidden="true" />
    </div>
  );
}
```

- [ ] **Step 2: Write the Hero**

Create `src/components/marketing/Hero.tsx`:

```tsx
import Image from "next/image";
import { RaceTrack } from "@/components/scoring/RaceTrack";
import { StartGameCta, MarketingCta } from "./MarketingCta";
import { DEMO_PLAYERS, DEMO_WIN_THRESHOLD } from "./fixtures";

export function Hero() {
  return (
    <section className="border-b-[1.5px] border-borderWarm bg-brand px-6 py-16 md:py-20">
      <div className="mx-auto max-w-4xl text-center">
        <Image
          src="/img/blitzer-logo.png"
          width={300}
          height={300}
          alt="Blitzer"
          priority
          className="mx-auto mb-8 h-auto w-[140px] md:w-[170px]"
        />

        <h1 className="font-display text-5xl font-bold leading-[1.02] text-brandAccent md:text-6xl">
          Keep score.
          <br />
          Settle scores.
        </h1>

        <p className="mx-auto mt-5 max-w-xl text-[17px] leading-relaxed text-[#5b4038]">
          Blitzer runs the scoring for your Dutch Blitz table — live standings,
          real win odds, and a permanent record of who&apos;s actually best.
        </p>

        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <StartGameCta section="hero" />
          <MarketingCta section="hero" href="/guide" variant="ghost">
            See how it works →
          </MarketingCta>
        </div>

        <div className="mt-12 rounded-xl border-[1.5px] border-borderWarm bg-surfaceRaised p-4 text-left">
          <div className="mb-2 flex justify-between text-xs font-medium text-textMuted">
            <span>Round 4 · Thursday night</span>
            <span>{DEMO_WIN_THRESHOLD} to win</span>
          </div>
          <RaceTrack
            players={DEMO_PLAYERS}
            winThreshold={DEMO_WIN_THRESHOLD}
          />
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Verify it compiles and existing tests pass**

Run: `npm test`
Expected: PASS — no new tests, nothing broken.

- [ ] **Step 4: Commit**

```bash
git add src/components/marketing/Section.tsx src/components/marketing/Hero.tsx
git commit -m "feat: add marketing section shell and hero"
```

---

## Task 6: Gather section

**Files:**
- Create: `public/img/demo-qr.png`
- Create: `src/components/marketing/GatherSection.tsx`

**Interfaces:**
- Consumes: `Section`, `SectionEyebrow` (Task 5); `DEMO_PLAYERS` (Task 2); `MAX_PICKUP_PLAYERS` from `@/lib/lobbies`
- Produces: `GatherSection()`

- [ ] **Step 1: Generate the decorative QR asset**

The `qrcode` package is already a dependency (used by `LobbyQrCode`). Generate the image once at development time so the encoder never ships to visitors:

```bash
node -e "require('qrcode').toFile('public/img/demo-qr.png','https://www.blitzer.fun',{width:560,margin:2,color:{dark:'#290806',light:'#ffffff'}})" && ls -la public/img/demo-qr.png
```

Expected: `public/img/demo-qr.png` exists, a few KB.

- [ ] **Step 2: Write the section**

Create `src/components/marketing/GatherSection.tsx`:

```tsx
import Image from "next/image";
import { Section, SectionEyebrow } from "./Section";
import { DEMO_PLAYERS } from "./fixtures";
import { MAX_PICKUP_PLAYERS } from "@/lib/lobbies";

const OPEN_SEATS = MAX_PICKUP_PLAYERS - DEMO_PLAYERS.length;

export function GatherSection() {
  return (
    <Section ground="white">
      <div className="grid items-center gap-10 md:grid-cols-2 md:gap-14">
        <div>
          <SectionEyebrow>1 · Gather</SectionEyebrow>
          <h2 className="font-display text-4xl font-bold leading-[1.08] text-brandAccent">
            Everyone&apos;s in before the deck is shuffled
          </h2>
          <p className="mt-4 text-base leading-relaxed text-[#5b4038]">
            Start a pickup game and show the code. They scan, they&apos;re in —
            up to {MAX_PICKUP_PLAYERS} players, and nobody needs an account
            first.
          </p>
          <p className="mt-3 text-base leading-relaxed text-[#5b4038]">
            Playing with someone who&apos;ll never sign up? Add them as a guest
            and they&apos;re scored like anyone else.
          </p>
        </div>

        <div className="rounded-xl border-[1.5px] border-borderWarm bg-surfaceSubtle p-4">
          <div className="flex items-center gap-5">
            <Image
              src="/img/demo-qr.png"
              width={112}
              height={112}
              alt=""
              aria-hidden="true"
              className="rounded-lg border-[1.5px] border-brandAccent bg-white p-1.5"
            />
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.09em] text-textMuted">
                or enter code
              </div>
              <div className="font-display text-3xl font-bold tracking-[0.16em] text-brandAccent">
                4KTQ
              </div>
            </div>
          </div>

          <ul className="mt-4 space-y-2">
            {DEMO_PLAYERS.map((player) => (
              <li
                key={player.id}
                className="flex items-center gap-2.5 rounded-lg border-[1.5px] border-borderWarm bg-surfaceRaised px-3 py-2 text-sm font-semibold text-brandAccent"
              >
                <span
                  className="h-5 w-5 flex-none rounded-full"
                  style={{ backgroundColor: player.color }}
                />
                {player.name}
                {player.isGuest && (
                  <span className="ml-auto rounded-full border border-borderWarm bg-surfaceSubtle px-2 py-0.5 text-[10px] font-semibold text-textMuted">
                    guest
                  </span>
                )}
              </li>
            ))}
            <li className="flex items-center gap-2.5 rounded-lg border-[1.5px] border-dashed border-borderWarm px-3 py-2 text-sm font-medium text-textMuted">
              <span className="h-5 w-5 flex-none rounded-full border-[1.5px] border-dashed border-borderWarm" />
              {OPEN_SEATS} seats open
            </li>
          </ul>
        </div>
      </div>
    </Section>
  );
}
```

- [ ] **Step 3: Verify**

Run: `npm test`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add public/img/demo-qr.png src/components/marketing/GatherSection.tsx
git commit -m "feat: add gather section with lobby panel"
```

---

## Task 7: Play section

**Files:**
- Create: `src/components/marketing/PlaySection.tsx`

**Interfaces:**
- Consumes: `Section`, `SectionEyebrow` (Task 5); `ScoreEntryPreview` (Task 4); `DEMO_PLAYERS`, `DEMO_WIN_THRESHOLD` (Task 2); `Standings` from `@/components/scoring/Standings`
- Produces: `PlaySection()`

- [ ] **Step 1: Write the section**

Create `src/components/marketing/PlaySection.tsx`:

```tsx
import { Section, SectionEyebrow } from "./Section";
import { ScoreEntryPreview } from "./ScoreEntryPreview";
import { Standings } from "@/components/scoring/Standings";
import { DEMO_PLAYERS, DEMO_WIN_THRESHOLD } from "./fixtures";

export function PlaySection() {
  return (
    <Section ground="cream">
      <div className="grid items-center gap-10 md:grid-cols-2 md:gap-14">
        <div className="order-2 rounded-xl border-[1.5px] border-borderWarm bg-surfaceRaised p-4 md:order-1">
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Phone frame — the scoring UI is designed thumb-first, so show it
                at the width it is actually used at. */}
            <div className="mx-auto w-[200px] rounded-[22px] border-[2.5px] border-brandAccent p-2">
              <div className="mx-auto mb-2 h-1 w-12 rounded-full bg-[#d1bfa8]" />
              <ScoreEntryPreview />
            </div>

            <div>
              <div className="mb-2 flex justify-between px-4 text-xs font-medium text-textMuted">
                <span>Standings</span>
                <span>after R4</span>
              </div>
              <Standings
                players={DEMO_PLAYERS}
                winThreshold={DEMO_WIN_THRESHOLD}
              />
            </div>
          </div>
        </div>

        <div className="order-1 md:order-2">
          <SectionEyebrow>2 · Play</SectionEyebrow>
          <h2 className="font-display text-4xl font-bold leading-[1.08] text-brandAccent">
            Lower friction than pen and paper. That&apos;s a higher bar than it
            sounds.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-[#5b4038]">
            Built thumb-first for a phone propped against the card box. Enter
            the blitz pile and cards played; the standings redraw before the
            next deal.
          </p>
        </div>
      </div>
    </Section>
  );
}
```

- [ ] **Step 2: Verify**

Run: `npm test`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/marketing/PlaySection.tsx
git commit -m "feat: add play section with live standings"
```

---

## Task 8: Settle section

**Files:**
- Create: `src/components/marketing/SettleSection.tsx`

**Interfaces:**
- Consumes: `Section`, `SectionEyebrow` (Task 5); `WinProbabilityDemo` (Task 4)
- Produces: `SettleSection()`

- [ ] **Step 1: Write the section**

Create `src/components/marketing/SettleSection.tsx`:

```tsx
import { Section } from "./Section";
import { WinProbabilityDemo } from "./WinProbabilityDemo";

export function SettleSection() {
  return (
    <Section ground="espresso">
      <div className="grid items-center gap-10 md:grid-cols-2 md:gap-14">
        <div>
          {/* SectionEyebrow's muted colour is tuned for light grounds. */}
          <div className="mb-3 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.13em] text-[#c4a99f]">
            3 · Settle it
            <span className="h-px flex-1 bg-[#5c2a25]" aria-hidden="true" />
          </div>
          <h2 className="font-display text-4xl font-bold leading-[1.08] text-brand">
            Real odds.
            <br />
            Not vibes.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-[#c9b0a7]">
            Blitzer simulates thousands of finishes from how your table has
            actually been scoring tonight. So &ldquo;she&apos;s got this&rdquo;
            stops being an opinion and becomes a number everyone can see.
          </p>
        </div>

        <WinProbabilityDemo />
      </div>
    </Section>
  );
}
```

- [ ] **Step 2: Verify**

Run: `npm test`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/marketing/SettleSection.tsx
git commit -m "feat: add settle section with win probability"
```

---

## Task 9: Remember section

**Files:**
- Create: `src/components/marketing/RememberSection.tsx`
- Test: `src/components/__tests__/marketing/RememberSection.test.tsx`

**Interfaces:**
- Consumes: `Section`, `SectionEyebrow` (Task 5); `DEMO_PLAYERS`, `DEMO_SCORES_BY_ROUND`, `DEMO_WIN_THRESHOLD` (Task 2); `BasicStatBlock` from `@/components/BasicStatBlock`; `ScoreProgressionCard` from `@/components/scoring/graphs/ScoreProgressionCard`
- Produces: `RememberSection()`

**Why this one is tested:** this is the only section whose copy is constrained by a product limitation. Circles have no stats surface — `src/server/queries/stats.ts` is entirely `…ForUser` — so any group-stats wording would be a false claim. The test pins that down so a future copy edit cannot quietly reintroduce it.

- [ ] **Step 1: Write the failing test**

Create `src/components/__tests__/marketing/RememberSection.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { RememberSection } from "@/components/marketing/RememberSection";

describe("RememberSection", () => {
  it("claims shared history and shareable results", () => {
    render(<RememberSection />);

    expect(screen.getByText(/lands in your Circle/i)).toBeInTheDocument();
    expect(screen.getByText(/link anyone can open/i)).toBeInTheDocument();
  });

  it("makes no group-stats claim, because Circles have no stats surface", () => {
    const { container } = render(<RememberSection />);
    const copy = container.textContent ?? "";

    // stats.ts is entirely `…ForUser` — there is no circle leaderboard,
    // head-to-head record, or group standing anywhere in the product.
    for (const forbidden of [
      /leaderboard/i,
      /head.to.head/i,
      /group stats/i,
      /your group's stats/i,
      /stack up game after game/i,
      /best in your circle/i,
    ]) {
      expect(copy).not.toMatch(forbidden);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/components/__tests__/marketing/RememberSection.test.tsx`
Expected: FAIL — `Cannot find module '@/components/marketing/RememberSection'`

- [ ] **Step 3: Write the section**

Create `src/components/marketing/RememberSection.tsx`:

```tsx
import { Section, SectionEyebrow } from "./Section";
import BasicStatBlock from "@/components/BasicStatBlock";
import { ScoreProgressionCard } from "@/components/scoring/graphs/ScoreProgressionCard";
import {
  DEMO_PLAYERS,
  DEMO_SCORES_BY_ROUND,
  DEMO_WIN_THRESHOLD,
} from "./fixtures";

/**
 * Copy constraint: Circles today only scope which games you can see. There is
 * no circle leaderboard, head-to-head record, or group stat of any kind —
 * every function in server/queries/stats.ts filters by userId alone. This
 * section may claim shared history and shareable results, nothing more.
 * See GitHub #274. RememberSection.test.tsx enforces this.
 */
export function RememberSection() {
  return (
    <Section ground="white">
      <div className="grid items-center gap-10 md:grid-cols-2 md:gap-14">
        <div>
          <div className="mb-3 grid grid-cols-2 gap-3">
            <BasicStatBlock label="Batting Average" value=".412" />
            <BasicStatBlock label="Games Won" value="17" />
          </div>
          <ScoreProgressionCard
            players={DEMO_PLAYERS}
            scoresByRound={DEMO_SCORES_BY_ROUND}
            winThreshold={DEMO_WIN_THRESHOLD}
          />
        </div>

        <div>
          <SectionEyebrow>4 · Remember</SectionEyebrow>
          <h2 className="font-display text-4xl font-bold leading-[1.08] text-brandAccent">
            Your average — per round, per game, against one specific person?
          </h2>
          <p className="mt-4 text-base leading-relaxed text-[#5b4038]">
            Every game your group plays lands in your Circle, so the record is
            all in one place instead of scattered across whoever remembered to
            write it down.
          </p>
          <p className="mt-3 text-base leading-relaxed text-[#5b4038]">
            And every finished game gets a link anyone can open — no account, no
            app, just send it to the group chat.
          </p>
        </div>
      </div>
    </Section>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/components/__tests__/marketing/RememberSection.test.tsx`
Expected: PASS — 2 tests

`BasicStatBlock` is `w-full max-w-sm`; if the two blocks look cramped side by side at desktop width, keep the grid and let them size down rather than adding a shadow or a new card style.

- [ ] **Step 5: Commit**

```bash
git add src/components/marketing/RememberSection.tsx src/components/__tests__/marketing/RememberSection.test.tsx
git commit -m "feat: add remember section with constrained Circles claims"
```

---

## Task 10: Quote, guide teaser, and final CTA

**Files:**
- Create: `src/components/marketing/QuoteSection.tsx`
- Create: `src/components/marketing/GuideTeaser.tsx`
- Create: `src/components/marketing/FinalCta.tsx`

**Interfaces:**
- Consumes: `Section` (Task 5); `StartGameCta`, `MarketingCta` (Task 3)
- Produces: `QuoteSection()`, `GuideTeaser()`, `FinalCta()`

- [ ] **Step 1: Write the quote section**

Create `src/components/marketing/QuoteSection.tsx`:

```tsx
import Link from "next/link";
import { Section } from "./Section";

export function QuoteSection() {
  return (
    <Section ground="cream">
      <figure className="mx-auto max-w-2xl text-center">
        <blockquote className="font-display text-2xl font-normal leading-[1.42] text-brandAccent md:text-[25px]">
          Dutch Blitz forces you to be in the moment. You can&apos;t play well
          and be thinking about anything else — that&apos;s one of the things I
          love about it. But afterwards, wouldn&apos;t you like to know how it
          actually went?
        </blockquote>
        <figcaption className="mt-5 text-sm font-medium text-textMuted">
          Mike, who built Blitzer ·{" "}
          <Link
            href="/guide/why-blitzer"
            className="font-semibold text-brandAccent underline underline-offset-4"
          >
            Read why I built this →
          </Link>
        </figcaption>
      </figure>
    </Section>
  );
}
```

- [ ] **Step 2: Write the guide teaser**

Create `src/components/marketing/GuideTeaser.tsx`:

```tsx
import Link from "next/link";
import { Section, SectionEyebrow } from "./Section";

const CARDS = [
  {
    href: "/guide/how-scoring-works",
    title: "How scoring works",
    blurb:
      "Cards played, minus twice your blitz pile. Why the maths is the way it is.",
  },
  {
    href: "/guide/circles-and-pickup-games",
    title: "Circles vs pickup games",
    blurb:
      "One is for tonight. One is for the next three years of Thursdays.",
  },
  {
    href: "/guide/reading-your-stats",
    title: "Reading your stats",
    blurb:
      "What batting average means here, and how the odds are calculated.",
  },
];

export function GuideTeaser() {
  return (
    <Section ground="white">
      <SectionEyebrow>The guide</SectionEyebrow>
      <h2 className="font-display text-3xl font-bold text-brandAccent">
        New to any of this? Start here.
      </h2>

      <div className="mt-6 grid gap-3 md:grid-cols-3">
        {CARDS.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="rounded-xl border-[1.5px] border-borderWarm bg-surfaceRaised p-4 transition-colors hover:border-brandAccent"
          >
            <h3 className="font-display text-base font-bold text-brandAccent">
              {card.title}
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed text-[#5b4038]">
              {card.blurb}
            </p>
            <span className="mt-3 inline-block text-[13px] font-semibold text-brandAccent">
              Read →
            </span>
          </Link>
        ))}
      </div>
    </Section>
  );
}
```

- [ ] **Step 3: Write the final CTA**

Create `src/components/marketing/FinalCta.tsx`:

```tsx
import { Section } from "./Section";
import { StartGameCta, MarketingCta } from "./MarketingCta";

export function FinalCta() {
  return (
    <Section ground="espresso" className="text-center">
      <h2 className="font-display text-4xl font-bold text-brand md:text-5xl">
        Get the table started
      </h2>
      <p className="mx-auto mt-4 max-w-md text-base text-[#c9b0a7]">
        Free. Takes about as long as shuffling.
      </p>
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <StartGameCta section="final_cta" variant="inverse" />
        <MarketingCta
          section="final_cta"
          href="/guide"
          variant="inverseGhost"
        >
          Read the guide
        </MarketingCta>
      </div>
    </Section>
  );
}
```

- [ ] **Step 4: Verify**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/marketing/QuoteSection.tsx src/components/marketing/GuideTeaser.tsx src/components/marketing/FinalCta.tsx
git commit -m "feat: add quote, guide teaser, and final CTA sections"
```

---

## Task 11: Compose the landing page

**Files:**
- Modify: `src/app/page.tsx` (full replacement — currently 265 lines)

**Interfaces:**
- Consumes: every section component from Tasks 5–10
- Produces: the new `/` route

- [ ] **Step 1: Replace the page**

Replace the entire contents of `src/app/page.tsx` with:

```tsx
import type { Metadata } from "next";
import { Hero } from "@/components/marketing/Hero";
import { GatherSection } from "@/components/marketing/GatherSection";
import { PlaySection } from "@/components/marketing/PlaySection";
import { SettleSection } from "@/components/marketing/SettleSection";
import { RememberSection } from "@/components/marketing/RememberSection";
import { QuoteSection } from "@/components/marketing/QuoteSection";
import { GuideTeaser } from "@/components/marketing/GuideTeaser";
import { FinalCta } from "@/components/marketing/FinalCta";

export const metadata: Metadata = {
  title: "Blitzer — scoring and stats for Dutch Blitz",
  description:
    "Blitzer runs the scoring for your Dutch Blitz table — live standings, real win odds, and a permanent record of who's actually best.",
};

/**
 * The section order is chronological — gather, play, settle, remember — so the
 * page follows the shape of an actual game night and each feature appears at
 * the moment it matters.
 */
export default function Home() {
  return (
    <main className="flex min-h-screen flex-col bg-brand">
      <Hero />
      <GatherSection />
      <PlaySection />
      <SettleSection />
      <RememberSection />
      <QuoteSection />
      <GuideTeaser />
      <FinalCta />
    </main>
  );
}
```

**If shipping phase 1 without the guide:** remove the `GuideTeaser` import and element, and change the two `href="/guide"` CTAs (in `Hero.tsx` and `FinalCta.tsx`) to point at `/games/new`.

- [ ] **Step 2: Verify the build**

Run: `npm run build`
Expected: build succeeds. A "functions cannot be passed to client components" error means a section is passing a callback across the boundary — check that `ScoreEntryCard` is only reached via `ScoreEntryPreview`.

Run: `npm test`
Expected: PASS

- [ ] **Step 3: Check it in the browser**

Run: `npm run dev`, open `http://localhost:3000`.

Confirm: no drop shadows anywhere; deck colours appear only inside product panels; the win-probability bars show percentages rather than "Available after 3 rounds"; sections alternate cream / white / espresso; the page is not horizontally scrollable at 375px width.

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: rebuild landing page from marketing sections"
```

---

## Task 12: Auth-gated navigation

**Files:**
- Create: `src/components/marketing/navLinks.ts`
- Modify: `src/app/NavBar.tsx:50-69` (`navData`), `:91-109` (mobile sheet), `:119-133` (desktop nav)
- Test: `src/components/__tests__/marketing/navLinks.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `SIGNED_OUT_LINKS: NavLink[]`, `signedInLinks(llmEnabled: boolean): NavLink[]`, `type NavLink = { label: string; href: string }`

**Why the link sets are extracted:** the spec requirement is *"signed-out visitors must not see Dashboard or Games links."* Asserting that by rendering `NavBar` would mean fighting Clerk's `<Show>` in jsdom. A pure module states the rule directly and tests it directly.

- [ ] **Step 1: Write the failing test**

Create `src/components/__tests__/marketing/navLinks.test.ts`:

```ts
import {
  SIGNED_OUT_LINKS,
  signedInLinks,
} from "@/components/marketing/navLinks";

describe("navLinks", () => {
  it("offers signed-out visitors the guide and nothing that needs auth", () => {
    expect(SIGNED_OUT_LINKS).toEqual([{ label: "Guide", href: "/guide" }]);
  });

  it("never exposes app routes to signed-out visitors", () => {
    const hrefs = SIGNED_OUT_LINKS.map((l) => l.href);
    for (const authOnly of ["/dashboard", "/games", "/insights"]) {
      expect(hrefs).not.toContain(authOnly);
    }
  });

  it("gives signed-in users the app routes", () => {
    const hrefs = signedInLinks(false).map((l) => l.href);
    expect(hrefs).toEqual(["/dashboard", "/games", "/guide"]);
  });

  it("adds Insights only when the llm-features flag is on", () => {
    expect(signedInLinks(false).map((l) => l.href)).not.toContain("/insights");
    expect(signedInLinks(true).map((l) => l.href)).toContain("/insights");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/components/__tests__/marketing/navLinks.test.ts`
Expected: FAIL — `Cannot find module '@/components/marketing/navLinks'`

- [ ] **Step 3: Write the module**

Create `src/components/marketing/navLinks.ts`:

```ts
export type NavLink = { label: string; href: string };

/**
 * Signed-out visitors previously saw Dashboard and Games links that only
 * bounced them into sign-in. They now get the guide and the auth buttons,
 * which the header renders separately.
 */
export const SIGNED_OUT_LINKS: NavLink[] = [{ label: "Guide", href: "/guide" }];

export function signedInLinks(llmEnabled: boolean): NavLink[] {
  return [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Games", href: "/games" },
    ...(llmEnabled ? [{ label: "Insights", href: "/insights" }] : []),
    { label: "Guide", href: "/guide" },
  ];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/components/__tests__/marketing/navLinks.test.ts`
Expected: PASS — 4 tests

- [ ] **Step 5: Wire it into NavBar**

In `src/app/NavBar.tsx`, add the import beside the existing ones:

```tsx
import { SIGNED_OUT_LINKS, signedInLinks } from "@/components/marketing/navLinks";
```

Replace the `navData` definition (lines 50–69) with:

```tsx
  const appLinks = signedInLinks(llmEnabled);
```

Replace the mobile `<nav>` block (lines 91–109) with:

```tsx
                <nav className="flex flex-col gap-4 mt-4">
                  <Show when="signed-in">
                    {appLinks.map((navItem) => (
                      <MobileNavLink
                        href={navItem.href}
                        label={navItem.label}
                        onClick={() => setIsMenuOpen(false)}
                        pathName={pathName}
                        key={navItem.href}
                      />
                    ))}
                    <Button asChild>
                      <Link href="/games/new" onClick={() => setIsMenuOpen(false)}>
                        New game
                      </Link>
                    </Button>
                  </Show>
                  <Show when="signed-out">
                    {SIGNED_OUT_LINKS.map((navItem) => (
                      <MobileNavLink
                        href={navItem.href}
                        label={navItem.label}
                        onClick={() => setIsMenuOpen(false)}
                        pathName={pathName}
                        key={navItem.href}
                      />
                    ))}
                  </Show>
                </nav>
```

Replace the desktop `<nav>` block (lines 119–133) with:

```tsx
          <nav className="hidden md:flex items-center space-x-6">
            <Show when="signed-in">
              {appLinks.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`text-sm font-medium transition-colors hover:text-primary ${
                    pathName === item.href
                      ? "text-primary font-semibold"
                      : "text-muted-foreground"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </Show>
            <Show when="signed-out">
              {SIGNED_OUT_LINKS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`text-sm font-medium transition-colors hover:text-primary ${
                    pathName === item.href
                      ? "text-primary font-semibold"
                      : "text-muted-foreground"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </Show>
          </nav>
```

**If shipping phase 1 without the guide:** make `SIGNED_OUT_LINKS` an empty array and drop `{ label: "Guide", href: "/guide" }` from `signedInLinks`, adjusting the two tests to match.

- [ ] **Step 6: Verify**

Run: `npm test`
Expected: PASS

Run `npm run dev` and load `/` in a private window. Confirm the header shows Guide, Sign In, Sign Up — and no Dashboard or Games.

- [ ] **Step 7: Commit**

```bash
git add src/components/marketing/navLinks.ts src/components/__tests__/marketing/navLinks.test.ts src/app/NavBar.tsx
git commit -m "feat: gate navigation links by auth state"
```

---

## Task 13: Footer rework

**Files:**
- Modify: `src/components/Footer.tsx` (full replacement)
- Test: `src/components/__tests__/Footer.test.tsx`

**Interfaces:**
- Consumes: nothing
- Produces: the reworked `Footer()`

- [ ] **Step 1: Write the failing test**

Create `src/components/__tests__/Footer.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import Footer from "@/components/Footer";

describe("Footer", () => {
  it("states that Blitzer is unaffiliated with Dutch Blitz Games Company", () => {
    render(<Footer />);

    expect(
      screen.getByText(/not affiliated with, endorsed by, or sponsored by/i)
    ).toBeInTheDocument();
  });

  it("links the guide instead of the retired Notion vision doc", () => {
    const { container } = render(<Footer />);

    expect(container.querySelector('a[href*="notion.site"]')).toBeNull();
    expect(
      screen.getByRole("link", { name: "Why Blitzer" })
    ).toHaveAttribute("href", "/guide/why-blitzer");
  });

  it("does not link app routes that require auth", () => {
    const { container } = render(<Footer />);

    expect(container.querySelector('a[href="/dashboard"]')).toBeNull();
    expect(container.querySelector('a[href="/games"]')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/components/__tests__/Footer.test.tsx`
Expected: FAIL — the disclaimer text is absent and the Notion link is present.

- [ ] **Step 3: Replace the footer**

Replace the entire contents of `src/components/Footer.tsx` with:

```tsx
import Link from "next/link";
import Image from "next/image";

const GUIDE_LINKS = [
  { label: "Getting started", href: "/guide/getting-started" },
  { label: "How scoring works", href: "/guide/how-scoring-works" },
  { label: "Circles & pickup games", href: "/guide/circles-and-pickup-games" },
  { label: "Reading your stats", href: "/guide/reading-your-stats" },
  { label: "Why Blitzer", href: "/guide/why-blitzer" },
];

const LEGAL_LINKS = [
  { label: "Privacy policy", href: "/privacy" },
  { label: "Terms of service", href: "/terms" },
];

export default function Footer() {
  return (
    <footer className="mt-auto border-t-[1.5px] border-borderWarm bg-surfaceSubtle">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="grid gap-8 md:grid-cols-[1.5fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-3">
              <Image
                src="/img/blitzer-logo.png"
                width={44}
                height={44}
                alt=""
                aria-hidden="true"
                className="h-auto w-11"
              />
              <span className="font-display text-lg font-bold text-brandAccent">
                Blitzer
              </span>
            </div>
            <p className="mt-3 max-w-[34ch] text-sm leading-relaxed text-[#5b4038]">
              Scoring and stats for people who take Thursday night far too
              seriously.
            </p>
          </div>

          <div>
            <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.11em] text-textMuted">
              Guide
            </h2>
            <ul className="space-y-2">
              {GUIDE_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-[#5b4038] transition-colors hover:text-brandAccent"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.11em] text-textMuted">
              Legal
            </h2>
            <ul className="space-y-2">
              {LEGAL_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-[#5b4038] transition-colors hover:text-brandAccent"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-8 border-t border-borderWarm pt-5 text-xs leading-relaxed text-textMuted">
          <p className="font-semibold text-brandAccent">
            Blitzer is an unofficial companion app and is not affiliated with,
            endorsed by, or sponsored by Dutch Blitz Games Company.
          </p>
          <p className="mt-1.5">
            For scoring and tracking statistics for{" "}
            <a
              href="https://www.dutchblitz.com"
              className="font-medium text-brandAccent hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Dutch Blitz
            </a>
            , the fast-paced, multiplayer card game. © {new Date().getFullYear()}{" "}
            Blitzer.
          </p>
        </div>
      </div>
    </footer>
  );
}
```

**If shipping phase 1 without the guide:** replace `GUIDE_LINKS` with an empty array and drop that column; keep the disclaimer. Adjust the second test accordingly.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/components/__tests__/Footer.test.tsx`
Expected: PASS — 3 tests

- [ ] **Step 5: Commit**

```bash
git add src/components/Footer.tsx src/components/__tests__/Footer.test.tsx
git commit -m "feat: rework footer with guide links and unaffiliated disclaimer"
```

---

## Task 14: Guide shell

**Files:**
- Create: `src/components/marketing/Prose.tsx`
- Create: `src/app/guide/layout.tsx`

**Interfaces:**
- Consumes: `SIGNED_OUT_LINKS` is unrelated; nothing from prior tasks except tokens
- Produces: `Prose({ children })`, `GuidePageHeader({ title, intro })`, and the `/guide/*` layout

- [ ] **Step 1: Write the prose component**

Create `src/components/marketing/Prose.tsx`:

```tsx
import { cn } from "@/lib/utils";

/**
 * Guide pages are TSX rather than MDX so they can embed the live scoring
 * components. That means no markdown pipeline styles them — this carries the
 * typography instead.
 */
export function Prose({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "text-base leading-relaxed text-[#5b4038]",
        "[&>p]:mb-4",
        "[&>h2]:font-display [&>h2]:text-2xl [&>h2]:font-bold [&>h2]:text-brandAccent [&>h2]:mt-10 [&>h2]:mb-3",
        "[&>h3]:font-display [&>h3]:text-lg [&>h3]:font-bold [&>h3]:text-brandAccent [&>h3]:mt-6 [&>h3]:mb-2",
        "[&>ul]:mb-4 [&>ul]:list-disc [&>ul]:pl-5 [&>ul>li]:mb-1.5",
        "[&>ol]:mb-4 [&>ol]:list-decimal [&>ol]:pl-5 [&>ol>li]:mb-1.5",
        "[&_a]:font-medium [&_a]:text-brandAccent [&_a]:underline [&_a]:underline-offset-4",
        className
      )}
    >
      {children}
    </div>
  );
}

export function GuidePageHeader({
  title,
  intro,
}: {
  title: string;
  intro: string;
}) {
  return (
    <header className="mb-8 border-b-[1.5px] border-borderWarm pb-6">
      <h1 className="font-display text-4xl font-bold leading-[1.08] text-brandAccent">
        {title}
      </h1>
      <p className="mt-3 text-lg leading-relaxed text-[#5b4038]">{intro}</p>
    </header>
  );
}
```

- [ ] **Step 2: Write the guide layout**

Create `src/app/guide/layout.tsx`:

```tsx
import Link from "next/link";

const GUIDE_NAV = [
  { label: "Overview", href: "/guide" },
  { label: "Getting started", href: "/guide/getting-started" },
  { label: "How scoring works", href: "/guide/how-scoring-works" },
  { label: "Circles & pickup games", href: "/guide/circles-and-pickup-games" },
  { label: "Reading your stats", href: "/guide/reading-your-stats" },
  { label: "Why Blitzer", href: "/guide/why-blitzer" },
];

export default function GuideLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bg-brand">
      <div className="mx-auto grid max-w-5xl gap-10 px-6 py-12 md:grid-cols-[210px_1fr] md:gap-12">
        <nav aria-label="Guide" className="md:sticky md:top-20 md:self-start">
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.11em] text-textMuted">
            Guide
          </h2>
          <ul className="space-y-1.5">
            {GUIDE_NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="block rounded-md px-2 py-1.5 text-sm text-[#5b4038] transition-colors hover:bg-surfaceSubtle hover:text-brandAccent"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
```

Note: page views are already captured globally by `PostHogPageView` (`src/app/PostHogPageView.tsx`), which fires `$pageview` with the pathname on every route change. That covers guide traffic, so no separate `guide_page_viewed` event is needed — drop it rather than double-counting.

- [ ] **Step 3: Verify**

Run: `npm test` and `npm run build`
Expected: PASS / build succeeds. `/guide` will 404 until Task 15 — that is expected.

- [ ] **Step 4: Commit**

```bash
git add src/components/marketing/Prose.tsx src/app/guide/layout.tsx
git commit -m "feat: add guide layout and prose component"
```

---

## Task 15: Guide hub

**Files:**
- Create: `src/app/guide/page.tsx`

**Interfaces:**
- Consumes: `Prose`, `GuidePageHeader` (Task 14)
- Produces: the `/guide` route

- [ ] **Step 1: Write the hub**

Create `src/app/guide/page.tsx`:

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { Prose, GuidePageHeader } from "@/components/marketing/Prose";

export const metadata: Metadata = {
  title: "Guide — Blitzer",
  description:
    "How to use Blitzer: starting a game, entering scores, Circles and pickup games, and what the stats mean.",
};

const TOPICS = [
  {
    href: "/guide/getting-started",
    title: "Getting started",
    blurb: "Your first game, from opening the app to a final score.",
  },
  {
    href: "/guide/how-scoring-works",
    title: "How scoring works",
    blurb: "The Dutch Blitz maths, and what Blitzer does with it.",
  },
  {
    href: "/guide/circles-and-pickup-games",
    title: "Circles & pickup games",
    blurb: "Two ways to play. Which one you want depends on how often.",
  },
  {
    href: "/guide/reading-your-stats",
    title: "Reading your stats",
    blurb: "Batting average, win odds, and the charts during a game.",
  },
  {
    href: "/guide/why-blitzer",
    title: "Why Blitzer",
    blurb: "Why this exists at all.",
  },
];

const FAQ = [
  {
    q: "Do all the players need an account?",
    a: "No. Only the person hosting needs one. Everyone else can join a pickup game with a code, and anyone who does not want an account at all can be added as a guest and still be scored normally.",
  },
  {
    q: "How many people can play?",
    a: "Up to eight, which is what the Dutch Blitz expansion packs seat.",
  },
  {
    q: "Can I fix a score I entered wrong?",
    a: "Yes. Rounds can be edited after they are recorded, and the standings and charts recalculate.",
  },
  {
    q: "Does a pickup game code expire?",
    a: "Yes, after twelve hours. A pickup lobby is meant for one sitting, so a screenshot of the code forwarded weeks later will not add anyone to a game nobody is at.",
  },
  {
    q: "Can I share the result with people who do not use Blitzer?",
    a: "Yes. Every finished game has a page anyone can open with the link — no account needed.",
  },
  {
    q: "Is this made by Dutch Blitz?",
    a: "No. Blitzer is an unofficial companion app and is not affiliated with, endorsed by, or sponsored by Dutch Blitz Games Company.",
  },
];

export default function GuideHub() {
  return (
    <>
      <GuidePageHeader
        title="Using Blitzer"
        intro="Everything you need to run a game night, enter scores, and make sense of the numbers afterwards."
      />

      <div className="grid gap-3 sm:grid-cols-2">
        {TOPICS.map((topic) => (
          <Link
            key={topic.href}
            href={topic.href}
            className="rounded-xl border-[1.5px] border-borderWarm bg-surfaceRaised p-4 transition-colors hover:border-brandAccent"
          >
            <h2 className="font-display text-base font-bold text-brandAccent">
              {topic.title}
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-[#5b4038]">
              {topic.blurb}
            </p>
          </Link>
        ))}
      </div>

      <Prose className="mt-12">
        <h2>Common questions</h2>
        <dl>
          {FAQ.map((item) => (
            <div key={item.q} className="mb-5">
              <dt className="font-semibold text-brandAccent">{item.q}</dt>
              <dd className="mt-1">{item.a}</dd>
            </div>
          ))}
        </dl>
      </Prose>
    </>
  );
}
```

- [ ] **Step 2: Verify**

Run: `npm test` and `npm run build`
Expected: PASS / build succeeds. Visit `/guide` in dev and confirm it renders with the sidebar.

- [ ] **Step 3: Commit**

```bash
git add src/app/guide/page.tsx
git commit -m "feat: add guide hub with FAQ"
```

---

## Task 16: Getting started page

**Files:**
- Create: `src/app/guide/getting-started/page.tsx`

**Interfaces:**
- Consumes: `Prose`, `GuidePageHeader` (Task 14); `MAX_PICKUP_PLAYERS` from `@/lib/lobbies`
- Produces: the `/guide/getting-started` route

- [ ] **Step 1: Write the page**

Create `src/app/guide/getting-started/page.tsx`:

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { Prose, GuidePageHeader } from "@/components/marketing/Prose";
import { MAX_PICKUP_PLAYERS } from "@/lib/lobbies";

export const metadata: Metadata = {
  title: "Getting started — Blitzer guide",
  description:
    "Run your first Dutch Blitz game in Blitzer: set up the table, enter scores round by round, and finish the game.",
};

export default function GettingStarted() {
  return (
    <>
      <GuidePageHeader
        title="Getting started"
        intro="Your first game, from opening the app to a final score. About two minutes of setup, most of it choosing colours."
      />

      <Prose>
        <h2>1. Pick how you are playing</h2>
        <p>
          When you start a new game, Blitzer asks whether it is a pickup game or
          a Circle game. If tonight is a one-off, or you are playing with people
          who are not in a group with you, choose pickup. If you play with the
          same crew regularly, a Circle keeps all your games together — see{" "}
          <Link href="/guide/circles-and-pickup-games">
            Circles &amp; pickup games
          </Link>
          .
        </p>

        <h2>2. Get everyone in</h2>
        <p>
          A pickup game opens a lobby with a QR code and a short join code. Show
          the screen; anyone who scans it or types the code joins the game on
          their own phone. You can seat up to {MAX_PICKUP_PLAYERS} players.
        </p>
        <p>
          Playing with someone who does not want an account? Add them as a guest
          by name. They are scored exactly like everyone else — they just cannot
          open the game on their own device.
        </p>
        <p>
          Lobby codes expire twelve hours after the lobby is created, so an old
          screenshot cannot pull someone into a game that finished last week.
        </p>

        <h2>3. Choose colours</h2>
        <p>
          Each player gets a colour, which is how they are identified in the
          standings, the race track and every chart. Blitzer assigns colours
          automatically, and anyone can change theirs before play starts. If two
          people pick the same colour, the one who had it gets bumped to the
          next free one.
        </p>

        <h2>4. Score each round</h2>
        <p>Once a round finishes, each player needs two numbers:</p>
        <ul>
          <li>
            <strong>Blitz pile remaining</strong> — how many cards were left in
            their Blitz pile when someone called Blitz.
          </li>
          <li>
            <strong>Cards played</strong> — how many of their cards ended up on
            the Dutch piles in the middle.
          </li>
        </ul>
        <p>
          Blitzer does the arithmetic. If you want to know exactly what it is
          doing, that is in{" "}
          <Link href="/guide/how-scoring-works">How scoring works</Link>.
        </p>
        <p>
          Entered something wrong? Rounds can be edited after the fact and
          everything downstream recalculates — you do not need to start over.
        </p>

        <h2>5. Finish the game</h2>
        <p>
          The game ends when someone crosses the win threshold, which is 75 by
          default. Blitzer marks the winner and writes the result to your
          history.
        </p>
        <p>
          Every finished game gets its own page that anyone can open with the
          link, whether or not they use Blitzer. It is the easiest way to settle
          an argument in the group chat the next morning.
        </p>
      </Prose>
    </>
  );
}
```

- [ ] **Step 2: Verify**

Run: `npm test` and `npm run build`
Expected: PASS / build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/app/guide/getting-started/page.tsx
git commit -m "docs: add getting started guide page"
```

---

## Task 17: How scoring works page

**Files:**
- Create: `src/app/guide/how-scoring-works/page.tsx`

**Interfaces:**
- Consumes: `Prose`, `GuidePageHeader` (Task 14); `GAME_RULES` and `calculateRoundScore` from `@/lib/validation/gameRules`
- Produces: the `/guide/how-scoring-works` route

The arithmetic below matches `src/lib/validation/gameRules.ts`: `BLITZ_PENALTY_MULTIPLIER: 2`, `MAX_BLITZ_PILE: 10`, `MAX_CARDS_PLAYED: 40`, and `calculateRoundScore` returns `totalCardsPlayed - (blitzPileRemaining * 2)`. If any of those change, every example on this page changes with them.

- [ ] **Step 1: Write the page**

Create `src/app/guide/how-scoring-works/page.tsx`:

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { Prose, GuidePageHeader } from "@/components/marketing/Prose";

export const metadata: Metadata = {
  title: "How Dutch Blitz scoring works — Blitzer guide",
  description:
    "Dutch Blitz scoring explained: cards played minus twice your remaining Blitz pile, and how Blitzer tracks it round by round.",
};

export default function HowScoringWorks() {
  return (
    <>
      <GuidePageHeader
        title="How scoring works"
        intro="The whole of Dutch Blitz scoring is one line of arithmetic. It is the consequences that are interesting."
      />

      <Prose>
        <h2>The formula</h2>
        <p>
          At the end of a round, each player scores the number of their cards
          that made it onto the Dutch piles in the middle, minus twice the
          number of cards still sitting in their Blitz pile.
        </p>
        <p>
          <strong>Score = cards played − (2 × blitz pile remaining)</strong>
        </p>
        <p>
          Emptying your Blitz pile is what ends the round, so whoever calls
          Blitz subtracts nothing. Everyone else pays two points for every card
          they did not get rid of.
        </p>

        <h2>Why it stings</h2>
        <p>
          The doubled penalty is the whole game. Playing lots of cards into the
          middle feels productive, but if you have been feeding the Dutch piles
          while your own Blitz pile sits untouched, you can finish a round with
          a negative score — and negative rounds are common enough that Blitzer
          shows them in red.
        </p>
        <p>
          It is why a round can swing the standings much harder than it looks
          like it should, and why the win odds during a game are not simply a
          function of who is ahead.
        </p>

        <h2>Worked example</h2>
        <p>Say a round ends and three players report:</p>
        <ul>
          <li>
            Dana called Blitz — 14 cards played, 0 left in her Blitz pile.
            14 − (2 × 0) = <strong>14</strong>.
          </li>
          <li>
            Mike — 11 cards played, 2 left. 11 − (2 × 2) ={" "}
            <strong>7</strong>.
          </li>
          <li>
            Priya — 6 cards played, 7 left. 6 − (2 × 7) ={" "}
            <strong>−8</strong>.
          </li>
        </ul>
        <p>
          Priya played more than half a dozen cards and still went backwards.
          That is normal.
        </p>

        <h2>Winning</h2>
        <p>
          Rounds keep going until someone crosses the win threshold — 75 by
          default. Because a strong round is worth double digits, a game is
          rarely as settled as the standings suggest, which is what the{" "}
          <Link href="/guide/reading-your-stats">win odds</Link> are for.
        </p>

        <h2>A small piece of trivia</h2>
        <p>
          Dutch Blitz was reportedly created in part to help teach the
          designer&apos;s children arithmetic. Whether or not that is the whole
          story, you can see it in the scoring: the doubling is exactly the kind
          of mental sum that is easy to state and annoying to do forty times an
          evening. Blitzer does it so you can keep playing.
        </p>
      </Prose>
    </>
  );
}
```

- [ ] **Step 3: Verify**

Run: `npm test` and `npm run build`
Expected: PASS / build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/app/guide/how-scoring-works/page.tsx
git commit -m "docs: add how scoring works guide page"
```

---

## Task 18: Circles and pickup games page

**Files:**
- Create: `src/app/guide/circles-and-pickup-games/page.tsx`

**Interfaces:**
- Consumes: `Prose`, `GuidePageHeader` (Task 14); `MAX_PICKUP_PLAYERS` from `@/lib/lobbies`
- Produces: the `/guide/circles-and-pickup-games` route

**Copy constraint:** this page explains the two modes. It must not claim circle leaderboards, head-to-head records, or group standings — see Global Constraints.

- [ ] **Step 1: Write the page**

Create `src/app/guide/circles-and-pickup-games/page.tsx`:

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { Prose, GuidePageHeader } from "@/components/marketing/Prose";
import { MAX_PICKUP_PLAYERS } from "@/lib/lobbies";

export const metadata: Metadata = {
  title: "Circles & pickup games — Blitzer guide",
  description:
    "The difference between a pickup game and a Circle in Blitzer, and which one to use.",
};

export default function CirclesAndPickupGames() {
  return (
    <>
      <GuidePageHeader
        title="Circles & pickup games"
        intro="Two ways to start a game. The difference is whether tonight is a one-off or part of something ongoing."
      />

      <Prose>
        <h2>Pickup games</h2>
        <p>
          A pickup game is for right now. You open a lobby, everyone at the
          table joins with a code or a QR scan, and you play. Nobody needs an
          account except you, and you can seat up to {MAX_PICKUP_PLAYERS}{" "}
          players.
        </p>
        <p>Use one when:</p>
        <ul>
          <li>You are playing with people you do not usually play with.</li>
          <li>Somebody at the table will never make an account.</li>
          <li>You just want to start without setting anything up.</li>
        </ul>
        <p>
          The lobby code stops working twelve hours after you create it, since a
          pickup lobby is meant for a single sitting.
        </p>

        <h2>Circles</h2>
        <p>
          A Circle is your regular group. Everyone in it can see the games
          played within it, so your history lives in one place instead of
          scattered across whoever happened to open the app that night.
        </p>
        <p>Use one when:</p>
        <ul>
          <li>You play with roughly the same people repeatedly.</li>
          <li>
            You want the games you played months ago to still be somewhere
            sensible.
          </li>
          <li>You want everyone in the group to see the same history.</li>
        </ul>
        <p>
          You can belong to more than one Circle — the family one and the
          Thursday one do not have to be the same group — and you switch between
          them from the header.
        </p>

        <h2>Guests</h2>
        <p>
          Either mode supports guests: players you add by name who do not have
          accounts. They are scored normally and appear in the standings and
          charts like anyone else. They just cannot open the game on their own
          phone, so someone else enters their numbers.
        </p>

        <h2>Which should I use?</h2>
        <p>
          If you are hesitating, start with a pickup game. It takes no setup and
          nothing is lost — your own stats still accumulate from it. You can
          create a Circle later, once it is clear the group is a regular thing.
        </p>
        <p>
          One thing to know: your{" "}
          <Link href="/guide/reading-your-stats">stats dashboard</Link> requires
          an active Circle, so if you have only ever played pickup games you
          will be asked to create one before you can see it.
        </p>
      </Prose>
    </>
  );
}
```

- [ ] **Step 2: Verify**

Run: `npm test` and `npm run build`
Expected: PASS / build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/app/guide/circles-and-pickup-games/page.tsx
git commit -m "docs: add circles and pickup games guide page"
```

---

## Task 19: Reading your stats page

**Files:**
- Create: `src/app/guide/reading-your-stats/page.tsx`

**Interfaces:**
- Consumes: `Prose`, `GuidePageHeader` (Task 14); `WinProbabilityDemo` (Task 4)
- Produces: the `/guide/reading-your-stats` route

**Copy constraint:** batting average and the other dashboard numbers are per-user across **all** games — `src/server/queries/stats.ts` filters by `userId` only, never by Circle. The page must say so rather than implying the numbers are group-scoped.

- [ ] **Step 1: Write the page**

Create `src/app/guide/reading-your-stats/page.tsx`:

```tsx
import type { Metadata } from "next";
import { Prose, GuidePageHeader } from "@/components/marketing/Prose";
import { WinProbabilityDemo } from "@/components/marketing/WinProbabilityDemo";

export const metadata: Metadata = {
  title: "Reading your stats — Blitzer guide",
  description:
    "What batting average means in Blitzer, how the in-game win odds are calculated, and what the charts show.",
};

export default function ReadingYourStats() {
  return (
    <>
      <GuidePageHeader
        title="Reading your stats"
        intro="What the numbers mean, and what they do not mean."
      />

      <Prose>
        <h2>Batting average</h2>
        <p>
          Your batting average is the share of rounds in which you emptied your
          Blitz pile — where you were the one who called Blitz. Rounds blitzed,
          divided by rounds played.
        </p>
        <p>
          It is not the share of rounds you outscored everyone. Those are
          different things: you can take the highest score in a round without
          blitzing, and you can blitz in a round where someone else scores more.
          Batting average measures the specific thing the game is named after.
        </p>
        <p>
          It counts every round you have ever played, across every Circle and
          every pickup game, pooled together. It is not scoped to the Circle you
          are currently looking at.
        </p>

        <h2>Win odds during a game</h2>
        <p>
          Mid-game, Blitzer estimates each player&apos;s chance of winning by
          simulating the rest of the game thousands of times, using how this
          table has actually been scoring tonight rather than a generic
          assumption. It appears once three rounds have been played — before
          that there is not enough to go on.
        </p>
      </Prose>

      <div className="my-8">
        <WinProbabilityDemo />
      </div>

      <Prose>
        <p>
          Because the simulation is driven by observed round scores, a player
          who has been quietly posting big rounds can hold better odds than
          someone a few points ahead of them. That is the point of it — the
          standings tell you who is ahead, the odds tell you who is winning.
        </p>

        <h2>The charts</h2>
        <h3>Score progression</h3>
        <p>
          Cumulative score per player across the rounds played so far. Useful
          for spotting the round where a game turned.
        </p>
        <h3>Hot &amp; cold</h3>
        <p>
          Each player&apos;s per-round scores as an intensity grid, so you can
          see streaks rather than totals. A player&apos;s best round is marked.
        </p>
        <h3>Race track</h3>
        <p>
          Where everyone sits relative to the win threshold. When players are
          close together their markers group so the track stays readable.
        </p>

        <h2>High and low single hand</h2>
        <p>
          Your best and worst single-round scores. The worst one is usually the
          more interesting number, and is usually the result of feeding the
          Dutch piles while ignoring your own Blitz pile.
        </p>
      </Prose>
    </>
  );
}
```

- [ ] **Step 3: Verify**

Run: `npm test` and `npm run build`
Expected: PASS / build succeeds. In dev, confirm the embedded win-probability card shows percentages, not the "Available after 3 rounds" fallback.

- [ ] **Step 4: Commit**

```bash
git add src/app/guide/reading-your-stats/page.tsx
git commit -m "docs: add reading your stats guide page"
```

---

## Task 20: Why Blitzer page

**Files:**
- Create: `src/app/guide/why-blitzer/page.tsx`
- Test: `src/app/guide/__tests__/why-blitzer.test.tsx`

**Interfaces:**
- Consumes: `Prose`, `GuidePageHeader` (Task 14)
- Produces: the `/guide/why-blitzer` route

**Why this one is tested:** this page is a rewrite of a 2024 vision doc that promised four things which do not exist. The test bars them from creeping back in during future edits.

- [ ] **Step 1: Write the failing test**

Create `src/app/guide/__tests__/why-blitzer.test.tsx`:

```tsx
import { render } from "@testing-library/react";
import WhyBlitzer from "@/app/guide/why-blitzer/page";

describe("Why Blitzer page", () => {
  it("makes none of the retired vision doc's unbuilt promises", () => {
    const { container } = render(<WhyBlitzer />);
    const copy = container.textContent ?? "";

    // The 2024 vision doc promised all of these. None of them ship:
    // friend approval was replaced by Circles (#205); there are no global
    // leaderboards; outlier showcases were never built; AI chat is Insights,
    // which is flag-gated and excluded from marketing entirely.
    for (const forbidden of [
      /friend request/i,
      /approve friendships/i,
      /best Dutch Blitz players in the world/i,
      /leaderboard/i,
      /AI chat/i,
      /ask questions of the data/i,
    ]) {
      expect(copy).not.toMatch(forbidden);
    }
  });

  it("tells the origin story in the present tense", () => {
    const { container } = render(<WhyBlitzer />);
    expect(container.textContent).toMatch(/in the moment/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/app/guide/__tests__/why-blitzer.test.tsx`
Expected: FAIL — `Cannot find module '@/app/guide/why-blitzer/page'`

- [ ] **Step 3: Write the page**

Create `src/app/guide/why-blitzer/page.tsx`:

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { Prose, GuidePageHeader } from "@/components/marketing/Prose";

export const metadata: Metadata = {
  title: "Why Blitzer — Blitzer guide",
  description:
    "Why a scorekeeping app for Dutch Blitz exists at all, written by the person who built it.",
};

export default function WhyBlitzer() {
  return (
    <>
      <GuidePageHeader
        title="Why Blitzer"
        intro="Why a scorekeeping app for a card game exists at all."
      />

      <Prose>
        <p>
          Keeping score for Dutch Blitz is genuinely simple. A sheet of paper
          and a pen is more than enough, and any app that wants to replace them
          has a higher bar to clear than it first appears. Paper never loses
          your data, never needs a signal, and never makes you wait.
        </p>
        <p>
          But paper does not capture the whole story. The patterns you start to
          notice after playing a lot of Dutch Blitz are the interesting part,
          and the more you play the more intriguing they get. You feel them
          while you are playing — you just cannot do anything with them at the
          time.
        </p>
        <p>
          That is because Dutch Blitz forces you to be in the moment. You cannot
          play well and be thinking about anything else. It is one of the best
          things about the game, and it is exactly why the reflection has to
          happen afterwards.
        </p>

        <h2>The questions</h2>
        <p>
          So: how did that game actually go? How have you been playing lately?
          Have you changed as a player? What is your average per round, per
          game, against one specific person? What is the longest game you have
          ever been part of?
        </p>
        <p>
          These are all answerable, but only if somebody wrote the rounds down
          in a form you can still use six months later. That is the job Blitzer
          took.
        </p>

        <h2>The bar</h2>
        <p>
          Which brings it back to the paper problem. Score entry has to be
          faster than a pen, mistakes have to be fixable, and a score must never
          be lost for a technical reason. If it is not lower friction than the
          thing it replaces, nobody uses it long enough to accumulate the
          history that made it worth building.
        </p>
        <p>
          That is why so much of the work has gone into the scoring screen
          rather than the charts. The charts are the reward; the scoring screen
          is the rent.
        </p>

        <h2>Where it is now</h2>
        <p>
          Today Blitzer scores a game round by round, shows live standings and
          real win odds while you play, keeps your group&apos;s games together
          in a{" "}
          <Link href="/guide/circles-and-pickup-games">Circle</Link>, and builds
          up your own stats over time. There is a great deal more that could be
          answered with this data than currently is. That is the fun part still
          ahead.
        </p>
      </Prose>
    </>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/app/guide/__tests__/why-blitzer.test.tsx`
Expected: PASS — 2 tests

- [ ] **Step 5: Full verification**

Run: `npm test`
Expected: PASS — the whole suite.

Run: `npm run build`
Expected: build succeeds.

Run `npm run dev` and walk `/`, `/guide`, and all five topic pages in a private window. Confirm every link in the guide sidebar and footer resolves, and no page shows the Dashboard or Games nav links while signed out.

- [ ] **Step 6: Commit**

```bash
git add src/app/guide/why-blitzer/page.tsx src/app/guide/__tests__/why-blitzer.test.tsx
git commit -m "docs: add why Blitzer origin page"
```

---

## Deferred (explicitly out of scope)

These are noted so nobody implements them by accident:

- **Interactive score-entry demo.** `ScoreEntryPreview` renders statically. Wiring it to local state so a visitor can type a score and watch the standings reorder is a follow-up.
- **Logo at small sizes.** The windmill mark is detailed line art. If it reads as mud at 44px in the footer or in the nav, a simplified small-size mark is needed — a separate design task.
- **Reconciling the scoring token drift.** `globals.css:41-50` defines `--scoring-*` variables that `Standings.tsx` and `RaceTrack.tsx` ignore in favour of hardcoded hex. Marketing uses tokens properly; fixing scoring is separate work.
- **Accent colour palette** — GitHub #273.
- **Circle-scoped stats** — GitHub #274. Until it ships, the Circles copy constraint in Global Constraints stands.
