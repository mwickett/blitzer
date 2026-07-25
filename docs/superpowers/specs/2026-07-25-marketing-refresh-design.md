# Marketing page refresh — design

**Date:** 2026-07-25
**Status:** Approved, ready for implementation planning

## Problem

The marketing site is one page (`src/app/page.tsx`) that undersells and partly misdescribes the product.

**It is stale.** The copy promises a "friends list" — that system was replaced by Circles in March 2026 (#205). It never mentions anything shipped since: pickup lobbies with join codes and QR, Monte Carlo win probability, the race track, per-player deck colours, shareable public game pages, or guest players.

**It looks like a different product than the app.** The landing page uses drop shadows, `hover:-translate-y-1` floating cards, gradient blur blobs and an `animate-pulse` halo. The scoring UI uses flat panels with a warm `1.5px` border and no shadows. Nothing on the marketing page shows the actual software.

**The unauthenticated IA is thin.** Only `/`, `/privacy`, `/terms` and `/sign-in`. There is no how-to content anywhere. `NavBar.tsx:51` builds `navData` unconditionally, so signed-out visitors see Dashboard and Games links that bounce them into sign-in. Both the landing CTA and the footer link out to a Notion vision doc from June 2024 that promises features which do not exist.

## Goals

1. Tighten the existing brand rather than replace it — cream, espresso and the windmill logo stay.
2. Show the real product, and keep it shown as the product changes.
3. Make the in-person, social character of the game structural to the page, not a section.
4. Position Blitzer as a competition enhancer.
5. Add a how-to-use section and fix the signed-out IA.

## Non-goals

No CMS, MDX pipeline, blog, marketing dark mode, i18n, or new component library. No changes to the scoring components themselves. No promotion of Circles beyond what ships today (see "Circles" below). No promotion of Insights.

---

## Visual direction

Cream `#fff7ea`, espresso `#290806`, warm border `#e6d7c3`, muted text `#8b5e3c` — unchanged.

**Type:** Fraunces (`SOFT 40`, `WONK 1`) for headings, loaded via `next/font/google` and mapped to a `font-display` family in `tailwind.config.ts`. Inter stays for all body copy. Fraunces is a soft, slightly irregular serif that rhymes with the logo's wordmark; Inter alone was the largest generic tell on the old page.

**Removed:** all drop shadows, `hover:-translate-y-1` transforms, gradient blur blobs, the `animate-pulse` logo halo, and icon-in-a-circle feature cards.

**Replaced with:** the app's own panel idiom — flat, `1.5px` warm border, `~13px` radius. Section separation comes from alternating ground colour (cream → white → espresso) rather than from effects.

**Colour discipline:** the saturated deck colours (`#3b82f6`, `#ef4444`, `#eab308`, `#22c55e`) appear *only inside product panels*, never on headings, buttons or backgrounds. This keeps them reading as data rather than decoration, and confines the warm/cool clash documented in #273 to one context.

---

## Information architecture

All routes public. `/guide/*` requires no change to `src/proxy.ts` — `isProtectedRoute` is an explicit allowlist and does not match it.

```
/                                 landing
/guide                            hub — orientation + FAQ inline
/guide/getting-started            first game end to end
/guide/how-scoring-works          Dutch Blitz scoring maths + win threshold
/guide/circles-and-pickup-games   the two modes, guests, invites
/guide/reading-your-stats         batting average, race outlook, charts
/guide/why-blitzer                rewritten origin story
/privacy  /terms                  unchanged
```

Six pages. "Running a game night" and "entering scores" were folded into `getting-started` — they are the same walkthrough told three times, and three thin pages read worse than one complete one. The FAQ lives on the hub for the same reason.

### Navigation

`NavBar.tsx` renders two variants inside Clerk `<Show>` blocks instead of the current unconditional `navData`:

- **Signed out:** `Guide` · Sign in · Get started
- **Signed in:** unchanged (Dashboard, Games, Insights-if-flagged, `OrganizationSwitcher`, New game, `UserButton`), with `Guide` added to the mobile sheet

### Footer

Three columns — Guide links, Legal, and the existing Dutch Blitz attribution line, which stays. The Notion "About" link is retired and points at `/guide/why-blitzer`.

New required line, above the attribution:

> Blitzer is an unofficial companion app and is not affiliated with, endorsed by, or sponsored by Dutch Blitz Games Company.

The site is about to publish a page explaining another company's scoring system while linking their website, with no statement of the relationship.

### Metadata

Each guide page gets its own `title` and `description`. Today `src/app/layout.tsx:19` sets one generic pair for the entire site.

---

## Landing page

Narrative order is chronological — **gather → play → settle → remember** — the shape of an actual game night. Each feature appears at the moment in the evening when it matters, which makes the social and competitive framing structural rather than a section that asserts it.

One fixture module (`src/components/marketing/fixtures.ts`) supplies the same four players and colours to every section, so the page reads as one continuous game night rather than disconnected screenshots.

### Hero — live `<RaceTrack>`, round 4, first to 75

> # Keep score. Settle scores.
> Blitzer runs the scoring for your Dutch Blitz table — live standings, real win odds, and a permanent record of who's actually best.

`[Start a game]` `[See how it works →]`. Logo stays, halo goes.

### 1 · Gather — lobby panel

> ## Everyone's in before the deck is shuffled
> Start a pickup game and show the code. They scan, sign in, and they're at the table — up to eight players, with no Circle to set up and no invitations to send.

*(Corrected during implementation: the original wording claimed "nobody needs an account first", which is false. `joinPickupGame` and `joinPickupGameByCode` both call `requireAuthContext("user")`, and `/join/[token]` gates signed-out visitors behind sign-in. The only account-free path is a host-added guest, which the next paragraph already covers.)*
>
> Playing with someone who'll never sign up? Add them as a guest and they're scored like anyone else.

Uses a **pre-generated QR image committed to `public/img/`**, not `LobbyQrCode`. That component lazily imports the `qrcode` encoder specifically so it ships only to people sitting in a lobby (see its own header comment); reusing it here would hand the encoder to every landing visitor. The image is decorative and encodes nothing meaningful, so it carries an empty `alt` and the join code beside it conveys the actual point.

### 2 · Play — live `<Standings>` + `<ScoreEntryCard>`

> ## Lower friction than pen and paper. That's a higher bar than it sounds.
> Built thumb-first for a phone propped against the card box. Enter the blitz pile and cards played; the standings redraw before the next deal.

### 3 · Settle it — live `<WinProbabilityCard>`, on espresso

> ## Real odds. Not vibes.
> Blitzer simulates thousands of finishes from how your table has actually been scoring tonight. So "she's got this" stops being an opinion and becomes a number everyone can see.

### 4 · Remember — `<StatTile>` + live `<ScoreProgressionCard>`

> ## Your average — per round, per game, against one specific person?
> Every game your group plays lands in your Circle, so the record is all in one place instead of scattered across whoever remembered to write it down.
>
> And every finished game gets a link anyone can open — no account, no app, just send it to the group chat.

### 5 · Why this exists — signed pull-quote

> "Dutch Blitz forces you to be in the moment. You can't play well and be thinking about anything else — that's one of the things I love about it. But afterwards, wouldn't you like to know how it actually went?"
>
> — Mike, who built Blitzer · *Read why I built this →*

### 6 · Guide teaser — three cards into `/guide`

### 7 · Final CTA

> ## Get the table started
> Free. Takes about as long as shuffling.

---

## Circles: what the page may claim

Circles is deliberately **not** promoted beyond shared history.

Circles today is a Clerk organization that scopes which games you see (`src/server/queries/games.ts` filters by `organizationId`) plus membership and invites. `src/app/circles/` contains only `setup` and `invite-friends`. Every function in `src/server/queries/stats.ts` is `…ForUser`, filtered by `userId` and never by `organizationId` — so there is no circle leaderboard, no head-to-head, and no group stats page of any kind. The dashboard's batting average pools every round across every Circle *and* every pickup game.

Section 4 may therefore claim shared history and shareable results, and nothing more. Any "the stats stack up for your group" framing describes software that does not exist.

The casual-vs-regular-crew distinction goes in `/guide/circles-and-pickup-games`, where someone actively choosing between modes will be, rather than on the landing page.

Tracked as **#274** — circle-scoped standings and head-to-head. When that ships, Circles earns a real section here.

---

## Vision doc

The Notion doc (June 2024) is mined for voice and retired as a link. Three lines carry forward, already placed above: the pen-and-paper friction bar (section 2), the questions cascade (section 4), and the in-the-moment quote (section 5). `/guide/how-scoring-works` picks up the note that Dutch Blitz was reportedly designed partly to teach the creator's children arithmetic — kept hedged, as the doc hedges it.

`/guide/why-blitzer` is an honest present-tense rewrite, not a republication. The original promises four things that do not exist or are gone: friend approval (replaced by Circles), comparison against "the best Dutch Blitz players in the world" (no global leaderboards), leaderboards and outlier games (not built), and an AI chat interface (that is Insights, which is flag-gated and excluded here). None of these may appear.

---

## Technical shape

### Tokens

`tailwind.config.ts` exposes only `brand` and `brandAccent`. Add four surface tokens, all of which already exist as values in `globals.css`:

| Token | Value | Existing source |
| --- | --- | --- |
| `surfaceRaised` | `#ffffff` | panel background in scoring UI |
| `surfaceSubtle` | `#faf5ed` | `--scoring-bg-subtle` |
| `borderWarm` | `#e6d7c3` | `--scoring-border` |
| `textMuted` | `#8b5e3c` | `--scoring-text-muted` |
| `textBody` | `#5b4038` | marketing body copy |

**Flagged, not fixed:** `globals.css:41-50` defines `--scoring-bg`, `--scoring-border`, `--scoring-text-muted` and others, but the scoring components do not use them. `Standings.tsx` and `RaceTrack.tsx` hardcode `#e6d7c3`, `#8b5e3c` and `#f0e6d2` directly. The variables and components have drifted apart. Marketing will use tokens properly; reconciling scoring is separate work and out of scope here.

### Files

```
src/app/page.tsx                    landing, composed of sections
src/components/marketing/
  fixtures.ts                       the shared demo game
  Hero.tsx  GatherSection.tsx  PlaySection.tsx  SettleSection.tsx
  RememberSection.tsx  QuoteSection.tsx  GuideTeaser.tsx  FinalCta.tsx
  MarketingCta.tsx                  auth-aware CTA + PostHog
  WinProbabilityDemo.tsx            "use client" wrapper
  Prose.tsx                         shared guide typography
src/app/guide/
  layout.tsx  page.tsx
  getting-started/page.tsx
  how-scoring-works/page.tsx
  circles-and-pickup-games/page.tsx
  reading-your-stats/page.tsx
  why-blitzer/page.tsx
```

Each section is its own file with one job. Today's `page.tsx` is 265 lines of inline markup and the new page carries more content.

### Component reuse

Verified presentational — plain props, no auth, no data fetching:

| Component | Status |
| --- | --- |
| `RaceTrack` | `"use client"`, ready |
| `ScoreProgressionCard` | `"use client"`, ready |
| `Standings` | pure, hook-free, ready |
| `HotColdCard` | pure, hook-free, ready |
| `BasicStatBlock` | pure, but **not used** — wraps `ui/card`'s `shadow-sm`, which the no-shadow rule bans. Marketing uses a purpose-built `StatTile` instead; the dashboard keeps `BasicStatBlock` |
| `RoundHistoryTable` | pure, optional callback |
| `ScoreEntryCard` | `"use client"`, requires an `onUpdate` callback |
| `WinProbabilityCard` | calls `useMemo` with **no** `"use client"` directive — needs a thin client wrapper |

`ScoreEntryCard` renders statically with a no-op `onUpdate`. Wiring it to local state would make section 2 a playable demo where a visitor types a score and watches the standings reorder — deferred, noted as a follow-up.

### Guide pages as TSX

Not MDX. No new dependency, and guide pages can embed the live product components — `how-scoring-works` renders an actual worked example with `<ScoreEntryCard>` rather than describing one. A shared `<Prose>` component carries the typography.

### Tracking

`marketing_cta_clicked` `{section, destination}` and `guide_page_viewed` `{slug}`. snake_case, no PII, per the repo convention.

### Tests

Light. Fixtures conform to `PlayerWithScore`; `NavBar` renders the correct links for each auth state. Marketing pages are otherwise static.

---

### Suggested phasing

The work splits cleanly at the nav boundary and can ship in two passes:

1. **Landing + chrome** — tokens, Fraunces, the seven landing sections, auth-gated nav, new footer with disclaimer. Self-contained and shippable; the guide teaser links can point at `/guide` before it is fleshed out only if phase 2 lands in the same release, otherwise the teaser section is held back.
2. **Guide** — layout, hub, five topic pages, per-page metadata.

## Open items

- **Fixture player names** are placeholders (Dana, Mike, Priya, Tom).
- **Logo at small sizes.** The windmill mark is detailed line art; at ~74px in the hero and ~20px in the nav it may read as mud. Needs checking against the real asset, and possibly a simplified small-size mark.
- **Interactive score-entry demo** deferred; static render ships first.

## Related issues

- **#273** — match player accent colours to the printed Dutch Blitz deck, and decide whether players pick a colour or a deck
- **#274** — Circles have no stats surface; blocks any real Circles section on a future version of this page
