# Quick Wins Tranche Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship three improvements — public game detail pages, email template standardization, and configurable win threshold — to build momentum before the orgs migration.

**Architecture:** Three independent features in one branch. Each task produces a commit. Task 1 touches middleware + queries. Task 2 touches email templates only. Task 3 touches schema, mutations, game logic, and UI.

**Tech Stack:** Next.js 16, React 19, Prisma 7, TypeScript 6, Clerk 7, React Email, Zod

---

### Task 1: Public Game Detail Pages (#183/#193)

**Files:**
- Modify: `src/middleware.ts`
- Modify: `src/server/queries/games.ts`
- Modify: `src/server/queries/index.ts`
- Modify: `src/server/queries.ts`
- Modify: `src/app/games/[id]/page.tsx`

- [ ] **Step 1: Update middleware to allow `/games/[id]` through without auth**

In `src/middleware.ts`, the protected route matcher currently matches `/games` which catches all sub-routes including `/games/[id]`. Change it to protect specific game routes but allow game detail pages through.

Replace the entire content of `src/middleware.ts` with:

```typescript
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isProtectedRoute = createRouteMatcher([
  "/dashboard",
  "/insights",
  "/games/new",
  "/games/clone(.*)",
  "/friends",
  "/api/chat",
  "/api/dev",
]);

const isPublicRoute = createRouteMatcher(["/sign-in(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) await auth.protect();
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
```

Key change: `/games` removed from protected routes, replaced with `/games/new` and `/games/clone(.*)`. The `/games` list page is also now public — this is fine because `getGames()` still requires auth and will show nothing to unauthenticated users.

- [ ] **Step 2: Make `getGameById()` not require auth**

In `src/server/queries/games.ts`, the `getGameById` function currently calls `auth()` and throws if no user. Remove the auth requirement — anyone with the game UUID can view it.

Replace the `getGameById` function:

```typescript
// Fetch a single game by ID — public, no auth required
export async function getGameById(id: string) {
  const game = await prisma.game.findUnique({
    where: { id },
    include: {
      players: {
        include: {
          user: true,
          guestUser: true,
        },
      },
      rounds: {
        include: {
          scores: {
            include: {
              user: true,
              guestUser: true,
            },
          },
        },
      },
    },
  });

  return game;
}
```

Also remove the `import { auth } from "@clerk/nextjs/server";` line if `getGames()` is the only other function using it — check first. If `getGames()` still uses `auth`, keep the import.

- [ ] **Step 3: Update game detail page to handle unauthenticated users**

In `src/app/games/[id]/page.tsx`, the `ScoreEntry` component should only render for authenticated users (you shouldn't be able to enter scores without logging in). Add an auth check:

At the top of the file, add:
```typescript
import { auth } from "@clerk/nextjs/server";
```

Then wrap the ScoreEntry rendering. Replace the return section:

```typescript
  const { userId } = await auth();
  const isAuthenticated = !!userId;

  return (
    <section className="py-6">
      <ScoreDisplay
        displayScores={displayScores}
        numRounds={game.rounds.length}
        gameId={game.id}
        isFinished={game.isFinished}
      />
      {isAuthenticated && (
        <ScoreEntry
          game={game}
          currentRoundNumber={currentRoundNumber}
          displayScores={displayScores}
        />
      )}
    </section>
  );
```

- [ ] **Step 4: Build and test**

Run: `npm run build && npm test`
Expected: Build passes, all tests pass

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: make game detail pages public for email link recipients (#193)

Closes #193, closes #183"
```

---

### Task 2: Email Template Standardization (#143)

**Files:**
- Modify: `src/components/email/welcome-template.tsx`
- Modify: `src/components/email/game-complete-template.tsx`
- Modify: `src/components/email/friend-request-template.tsx`

All three templates should share the same brand styling:
- Background: `#fff7ea` (brand cream)
- Container: white, rounded corners (16px), subtle shadow, max-width 480px
- Content padding: `0 48px` inside the section
- Text color: `#290806` (brand accent)
- Button: `#290806` background, white text, 8px border-radius
- Logo: Blitzer logo at top of every email
- Consistent spacing for title, paragraphs, buttons, hr, footer

- [ ] **Step 1: Rewrite `src/components/email/welcome-template.tsx`**

The main fix is adding `padding: "0 48px"` to the Section. Also tightening up spacing consistency.

Replace the entire file:

```typescript
import {
  Html,
  Head,
  Preview,
  Body,
  Container,
  Section,
  Text,
  Button,
  Hr,
} from "@react-email/components";
import { render } from "@react-email/render";
import * as React from "react";

interface WelcomeEmailProps {
  username: string;
}

const WelcomeEmailTemplate = ({ username }: WelcomeEmailProps) => {
  const previewText = `Welcome to Blitzer - Let's start scoring!`;

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={content}>
            <img
              src="https://blitzer.fun/img/blitzer-logo.png"
              alt="Blitzer Logo"
              width="80"
              height="80"
              style={logo}
            />
            <Text style={title}>Welcome to Blitzer!</Text>
            <Text style={paragraph}>Hi {username},</Text>
            <Text style={paragraph}>
              Thanks for joining Blitzer! We&apos;re excited to help you keep
              score and track your games with friends.
            </Text>
            <Text style={paragraph}>With Blitzer, you can:</Text>
            <Text style={listItem}>• Create and manage game scoresheets</Text>
            <Text style={listItem}>• Track scores across multiple rounds</Text>
            <Text style={listItem}>• Connect with friends and share games</Text>
            <Section style={buttonContainer}>
              <Button href="https://blitzer.fun" style={button}>
                Start Your First Game
              </Button>
            </Section>
            <Hr style={hr} />
            <Text style={footer}>
              This inbox isn&apos;t monitored, replies won&apos;t be read.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

const main = {
  backgroundColor: "#fff7ea",
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
  backgroundColor: "#fff",
  margin: "0 auto",
  padding: "32px 0 48px",
  marginBottom: "64px",
  borderRadius: "16px",
  boxShadow: "0 2px 12px rgba(41,8,6,0.06)",
  maxWidth: "480px",
};

const content = {
  padding: "0 48px",
};

const logo = {
  display: "block" as const,
  margin: "0 auto 24px auto",
  borderRadius: "16px",
  background: "#fff",
};

const title = {
  fontSize: "28px",
  fontWeight: "800",
  color: "#290806",
  textAlign: "center" as const,
  margin: "16px 0 24px 0",
  letterSpacing: "-0.5px",
};

const paragraph = {
  fontSize: "16px",
  lineHeight: "26px",
  color: "#290806",
  margin: "0 0 12px 0",
};

const listItem = {
  fontSize: "16px",
  lineHeight: "24px",
  color: "#290806",
  marginLeft: "18px",
  marginBottom: "4px",
};

const buttonContainer = {
  textAlign: "center" as const,
  margin: "36px 0 24px 0",
};

const button = {
  backgroundColor: "#290806",
  borderRadius: "8px",
  color: "#fff",
  fontSize: "17px",
  fontWeight: "600",
  textDecoration: "none",
  textAlign: "center" as const,
  display: "inline-block",
  padding: "14px 32px",
  boxShadow: "0 2px 8px rgba(41,8,6,0.10)",
  border: "none",
};

const hr = {
  borderColor: "#e6ebf1",
  margin: "32px 0 16px 0",
};

const footer = {
  color: "#8898aa",
  fontSize: "13px",
  lineHeight: "22px",
  textAlign: "center" as const,
  marginTop: "24px",
};

export const WelcomeEmail = (props: WelcomeEmailProps) => {
  const component = <WelcomeEmailTemplate {...props} />;
  const text = render(component, { plainText: true });
  return { component, text };
};
```

- [ ] **Step 2: Rewrite `src/components/email/game-complete-template.tsx`**

Align to the same brand styling — add logo, use brand colors, rounded container, consistent spacing.

Replace the entire file:

```typescript
import {
  Html,
  Head,
  Preview,
  Body,
  Container,
  Section,
  Text,
  Button,
  Hr,
} from "@react-email/components";
import { render } from "@react-email/render";
import * as React from "react";

interface GameCompleteEmailProps {
  username: string;
  winnerUsername: string;
  isWinner: boolean;
  gameId: string;
}

const GameCompleteEmailTemplate = ({
  username,
  winnerUsername,
  isWinner,
  gameId,
}: GameCompleteEmailProps) => {
  const previewText = isWinner
    ? "Congratulations on your win!"
    : `Game complete - ${winnerUsername} won!`;

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={content}>
            <img
              src="https://blitzer.fun/img/blitzer-logo.png"
              alt="Blitzer Logo"
              width="80"
              height="80"
              style={logo}
            />
            <Text style={title}>Game Complete!</Text>
            <Text style={paragraph}>Hi {username},</Text>
            {isWinner ? (
              <Text style={paragraph}>
                Congratulations! You won the game! 🎉
              </Text>
            ) : (
              <Text style={paragraph}>
                Game over! {winnerUsername} won this round. Better luck next
                time! 🎮
              </Text>
            )}
            <Text style={paragraph}>
              Want to see the final scores? Check out the game details:
            </Text>
            <Section style={buttonContainer}>
              <Button
                href={`https://blitzer.fun/games/${gameId}`}
                style={button}
              >
                View Game Details
              </Button>
            </Section>
            <Text style={paragraph}>
              Ready for another game? Start a new one and challenge your
              friends!
            </Text>
            <Hr style={hr} />
            <Text style={footer}>
              This inbox isn&apos;t monitored, replies won&apos;t be read.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

const main = {
  backgroundColor: "#fff7ea",
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
  backgroundColor: "#fff",
  margin: "0 auto",
  padding: "32px 0 48px",
  marginBottom: "64px",
  borderRadius: "16px",
  boxShadow: "0 2px 12px rgba(41,8,6,0.06)",
  maxWidth: "480px",
};

const content = {
  padding: "0 48px",
};

const logo = {
  display: "block" as const,
  margin: "0 auto 24px auto",
  borderRadius: "16px",
  background: "#fff",
};

const title = {
  fontSize: "28px",
  fontWeight: "800",
  color: "#290806",
  textAlign: "center" as const,
  margin: "16px 0 24px 0",
  letterSpacing: "-0.5px",
};

const paragraph = {
  fontSize: "16px",
  lineHeight: "26px",
  color: "#290806",
  margin: "0 0 12px 0",
};

const buttonContainer = {
  textAlign: "center" as const,
  margin: "36px 0 24px 0",
};

const button = {
  backgroundColor: "#290806",
  borderRadius: "8px",
  color: "#fff",
  fontSize: "17px",
  fontWeight: "600",
  textDecoration: "none",
  textAlign: "center" as const,
  display: "inline-block",
  padding: "14px 32px",
  boxShadow: "0 2px 8px rgba(41,8,6,0.10)",
  border: "none",
};

const hr = {
  borderColor: "#e6ebf1",
  margin: "32px 0 16px 0",
};

const footer = {
  color: "#8898aa",
  fontSize: "13px",
  lineHeight: "22px",
  textAlign: "center" as const,
  marginTop: "24px",
};

export const GameCompleteEmail = (props: GameCompleteEmailProps) => {
  const component = <GameCompleteEmailTemplate {...props} />;
  const text = render(component, { plainText: true });
  return { component, text };
};
```

- [ ] **Step 3: Rewrite `src/components/email/friend-request-template.tsx`**

Same brand alignment — logo, brand colors, rounded container.

Replace the entire file:

```typescript
import {
  Html,
  Head,
  Preview,
  Body,
  Container,
  Section,
  Text,
  Button,
  Hr,
} from "@react-email/components";
import { render } from "@react-email/render";
import * as React from "react";

interface FriendRequestEmailProps {
  username: string;
  fromUsername: string;
}

const FriendRequestEmailTemplate = ({
  username,
  fromUsername,
}: FriendRequestEmailProps) => {
  const previewText = `${fromUsername} sent you a friend request on Blitzer`;

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={content}>
            <img
              src="https://blitzer.fun/img/blitzer-logo.png"
              alt="Blitzer Logo"
              width="80"
              height="80"
              style={logo}
            />
            <Text style={title}>New Friend Request</Text>
            <Text style={paragraph}>Hi {username},</Text>
            <Text style={paragraph}>
              {fromUsername} would like to connect with you on Blitzer! Adding
              friends makes it easy to:
            </Text>
            <Text style={listItem}>• Start new games together</Text>
            <Text style={listItem}>• Share game results</Text>
            <Text style={listItem}>• Keep track of your gaming history</Text>
            <Section style={buttonContainer}>
              <Button href="https://blitzer.fun/friends" style={button}>
                View Friend Request
              </Button>
            </Section>
            <Hr style={hr} />
            <Text style={footer}>
              You received this email because you have notifications enabled for
              friend requests on Blitzer.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

const main = {
  backgroundColor: "#fff7ea",
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
  backgroundColor: "#fff",
  margin: "0 auto",
  padding: "32px 0 48px",
  marginBottom: "64px",
  borderRadius: "16px",
  boxShadow: "0 2px 12px rgba(41,8,6,0.06)",
  maxWidth: "480px",
};

const content = {
  padding: "0 48px",
};

const logo = {
  display: "block" as const,
  margin: "0 auto 24px auto",
  borderRadius: "16px",
  background: "#fff",
};

const title = {
  fontSize: "28px",
  fontWeight: "800",
  color: "#290806",
  textAlign: "center" as const,
  margin: "16px 0 24px 0",
  letterSpacing: "-0.5px",
};

const paragraph = {
  fontSize: "16px",
  lineHeight: "26px",
  color: "#290806",
  margin: "0 0 12px 0",
};

const listItem = {
  fontSize: "16px",
  lineHeight: "24px",
  color: "#290806",
  marginLeft: "18px",
  marginBottom: "4px",
};

const buttonContainer = {
  textAlign: "center" as const,
  margin: "36px 0 24px 0",
};

const button = {
  backgroundColor: "#290806",
  borderRadius: "8px",
  color: "#fff",
  fontSize: "17px",
  fontWeight: "600",
  textDecoration: "none",
  textAlign: "center" as const,
  display: "inline-block",
  padding: "14px 32px",
  boxShadow: "0 2px 8px rgba(41,8,6,0.10)",
  border: "none",
};

const hr = {
  borderColor: "#e6ebf1",
  margin: "32px 0 16px 0",
};

const footer = {
  color: "#8898aa",
  fontSize: "13px",
  lineHeight: "22px",
  textAlign: "center" as const,
  marginTop: "24px",
};

export const FriendRequestEmail = (props: FriendRequestEmailProps) => {
  const component = <FriendRequestEmailTemplate {...props} />;
  const text = render(component, { plainText: true });
  return { component, text };
};
```

- [ ] **Step 4: Build and test**

Run: `npm run build && npm test`
Expected: Build passes, all tests pass

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "fix: standardize email templates with brand styling and fix padding (#143)

Closes #143"
```

---

### Task 3: Configurable Win Threshold (#147)

**Files:**
- Modify: `src/server/db/schema.prisma` + run migration
- Modify: `src/server/mutations/games.ts`
- Modify: `src/lib/validation/gameRules.ts`
- Modify: `src/lib/gameLogic.ts`
- Modify: `src/app/games/new/newGameChooser.tsx`
- Modify: `src/app/games/[id]/page.tsx`
- Modify: `src/app/games/[id]/scoreEntry.tsx`

- [ ] **Step 1: Add `winThreshold` to the Game schema**

In `src/server/db/schema.prisma`, add a nullable Int field with default 75 to the Game model. Find the Game model (around line 66) and add the field:

```prisma
model Game {
  id           String        @id @default(uuid())
  createdAt    DateTime      @default(now()) @map("created_at")
  endedAt      DateTime?     @map("ended_at")
  isFinished   Boolean       @default(false) @map("is_finished")
  winnerId     String?
  winThreshold Int           @default(75) @map("win_threshold")
  players      GamePlayers[]
  rounds       Round[]
}
```

- [ ] **Step 2: Create and apply the migration**

Run: `npx prisma migrate dev --name add-win-threshold`
Expected: Migration created and applied successfully

Then regenerate the client:
Run: `npx prisma generate`

- [ ] **Step 3: Update `createGame()` to accept an optional threshold**

In `src/server/mutations/games.ts`, modify the function signature and game creation:

Change the function signature (lines 8-14) to:

```typescript
export async function createGame(
  users: {
    id: string;
    username?: string;
    isGuest?: boolean;
  }[],
  winThreshold?: number
)
```

Change the game creation (around line 25) from:

```typescript
const newGame = await prisma.game.create({
  data: {},
});
```

To:

```typescript
const newGame = await prisma.game.create({
  data: {
    ...(winThreshold && winThreshold !== 75 ? { winThreshold } : {}),
  },
});
```

Also add the threshold to the PostHog event properties. Find the `posthog.capture` call for game creation and add `win_threshold: winThreshold ?? 75` to its properties.

- [ ] **Step 4: Update `isWinningScore()` to accept a threshold parameter**

In `src/lib/validation/gameRules.ts`, change the function signature:

```typescript
// Check if score meets winning threshold
export function isWinningScore(total: number, threshold: number = GAME_RULES.POINTS_TO_WIN): boolean {
  return total >= threshold;
}
```

This is backward-compatible — existing callers without a threshold still use 75.

- [ ] **Step 5: Update `gameLogic.ts` to pass threshold through**

In `src/lib/gameLogic.ts`, the `GameWithPlayersAndScores` interface extends `Game`, which now includes `winThreshold`. So the threshold is already available on the game object.

Find where `isWinningScore` is called (around line 130) and pass the game's threshold:

```typescript
if (isWinningScore(playerScore.total, game.winThreshold)) {
```

The `transformGameData` function receives the full game object, so `game.winThreshold` is available.

- [ ] **Step 6: Add threshold presets UI to game creation**

In `src/app/games/new/newGameChooser.tsx`, add state and UI for the win threshold.

Add these imports if not already present:
```typescript
import { GAME_RULES } from "@/lib/validation/gameRules";
```

Add state near the other useState declarations:
```typescript
const [winThreshold, setWinThreshold] = useState<number>(GAME_RULES.POINTS_TO_WIN);
const [showCustomThreshold, setShowCustomThreshold] = useState(false);
```

Define the presets:
```typescript
const THRESHOLD_PRESETS = [50, 75, 100] as const;
const MIN_THRESHOLD = 25;
const MAX_THRESHOLD = 200;
```

Update `handleCreateGame` to pass the threshold:
```typescript
const result = await createGame(inGamePlayers, winThreshold);
```

Add the threshold UI inside the CardContent, after the player selection and before the create button. Add an "Advanced Options" section:

```tsx
<div className="border-t pt-4 mt-4">
  <p className="text-sm font-medium text-muted-foreground mb-3">
    Winning Score
  </p>
  <div className="flex gap-2 flex-wrap">
    {THRESHOLD_PRESETS.map((preset) => (
      <Button
        key={preset}
        type="button"
        variant={winThreshold === preset && !showCustomThreshold ? "default" : "outline"}
        size="sm"
        onClick={() => {
          setWinThreshold(preset);
          setShowCustomThreshold(false);
        }}
      >
        {preset}
      </Button>
    ))}
    <Button
      type="button"
      variant={showCustomThreshold ? "default" : "outline"}
      size="sm"
      onClick={() => setShowCustomThreshold(true)}
    >
      Custom
    </Button>
  </div>
  {showCustomThreshold && (
    <Input
      type="number"
      min={MIN_THRESHOLD}
      max={MAX_THRESHOLD}
      value={winThreshold}
      onChange={(e) => {
        const val = parseInt(e.target.value, 10);
        if (!isNaN(val) && val >= MIN_THRESHOLD && val <= MAX_THRESHOLD) {
          setWinThreshold(val);
        }
      }}
      className="mt-2 w-32"
      placeholder="Points to win"
    />
  )}
</div>
```

Note: Use the existing `Button` and `Input` components from `@/components/ui/`. You may need to import `Input` if not already imported.

- [ ] **Step 7: Display the target score in the game view**

In `src/app/games/[id]/page.tsx`, display the win threshold if it's not the default 75. Add this above the `<ScoreDisplay>` component:

```tsx
{game.winThreshold !== 75 && (
  <p className="text-center text-sm text-muted-foreground mb-2">
    Playing to {game.winThreshold} points
  </p>
)}
```

- [ ] **Step 8: Build and test**

Run: `npm run build && npm test`
Expected: Build passes, all tests pass

Note: Some existing tests in `gameLogic.test.ts` may need updating if they call `isWinningScore` without a threshold — but since the default parameter makes it backward-compatible, they should pass as-is.

- [ ] **Step 9: Commit**

```bash
git add -A && git commit -m "feat: configurable winning score threshold with presets (#147)

Adds winThreshold field to Game model (default 75). Players can choose
from presets (50/75/100) or enter a custom value (25-200) when creating
a game. Non-default thresholds are displayed in the game view.

Closes #147"
```

---

### Task 4: Create PR and Close Issues

- [ ] **Step 1: Push and create PR**

```bash
git push -u origin HEAD
gh pr create --title "Quick wins: public game pages, email templates, win threshold" --body "$(cat <<'EOF'
## Summary
- **Public game detail pages** (#193, #183) — anyone with a game link can view results without logging in. Fixes broken email link UX.
- **Email template standardization** (#143) — all templates now use brand colors (#fff7ea bg, #290806 accent), logo, rounded containers, consistent padding and spacing.
- **Configurable win threshold** (#147) — players can set a custom target score (presets: 50/75/100 or custom 25-200) when creating a game.

## Test plan
- [ ] Click a game link while logged out — should show game results (read-only, no score entry)
- [ ] Create a game with custom threshold (e.g. 50) — verify it displays and triggers win at correct score
- [ ] Verify email templates render correctly (welcome, game complete, friend request)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 2: Close linked issues**

Issues #183, #143, and #147 will auto-close via the commit messages. Verify after merge.
