# Audit implementation and verification

The September 5, 2026 audit implementation is a ten-part review stack on top of the audited dependency baseline, `e9035f5` (PR #277). The integration source tree at `73ea26c` is byte-for-byte identical to the final stack source tree at `784c645`; the later verification-guide commit changes documentation and artifact ignores only.

## Review and merge order

Review each PR against its preceding branch. Land the existing #277 baseline first, then proceed in the numbered order below. After a predecessor lands, retarget its successor to `main` and verify its diff and checks again. Avoid merging the whole stack into an intermediate feature branch: that obscures the individual review gates. No PR has been merged or production deployment performed as part of this implementation pass.

| Part | Branch suffix | Scope | Audit issues |
| --- | --- | --- | --- |
| 01 | foundation | Preserve preview fixtures; disposable PostgreSQL tests and CI/build gates | #295 |
| 02 | contact-export | Remove the legacy contact export and retired migration invitation flow | #288 |
| 03 | identity | Immutable Clerk identity provisioning, webhook replay behavior, unique-constraint compatibility | #287 |
| 04 | scoring | Validated, ordered, atomic scoring; correct winners; shared drafts, conflicts, celebration, accessibility | #279–285, #290 |
| 05 | setup | Recover Circle setup, game creation, and rematches; remove mutation-on-GET | #289, #294, audit findings in #199 |
| 06 | queries-chat | Bounded shared statistics and game pagination; current chat SDK contract and interrupted-stream recovery | #286, #292, audit findings in #241 and #202 |
| 07 | forecast | Visible-card worker calculation, cancellation, bounded cache, optional historical profiles | #291 |
| 08 | slack-telemetry | Operator-only Slack reports; telemetry delivery, identity, privacy, error context, and flag-cache bounds | #293, audit findings in #217 |
| 09 | dependencies | Compatible framework, Prisma, and transitive advisory fixes | #277 follow-up |
| 10 | cleanup | Remove dead code/dependencies, consolidate interfaces and error pages, update operating documentation | #296 |

All branch names start with `mwickett/audit-`. Every part includes the fixture-preservation foundation; deployment builds no longer seed test data automatically.

## Verification completed

- Every individual stack branch passed type checking, lint, and its source tests. The dependency branch briefly exposes three new lint warnings in old error-page navigation; the cleanup branch removes all three.
- The final source tree passes **46 suites / 318 source tests**, **18 real PostgreSQL integration tests**, type checking, lint with **zero warnings**, and a production Next.js build. Fresh `npm ci` and Prisma generation pass.
- PostgreSQL tests create their own disposable PostgreSQL 17 container and forcibly replace `DATABASE_URL`. They exercise competing independent connections, next-round order, duplicate retries, stale revisions, finalization/edit races, rollback on a forced database error, authorization, populated-schema migrations, identity collisions, statistics, keyset pagination, and preservation of edited/cloned preview fixtures.
- Behavioral regressions were reproduced before fixes. Examples include nine failing shared-scoring interaction cases, invalid raw AI UI messages, duplicate-username provisioning with the actual Prisma adapter metadata, stale/unauthorized Slack requests, and optional analytics preventing user actions.
- Actual installed AI, PostHog, and Sentry SDK tests use stubbed transports. They cover recovery after an interrupted empty assistant response, event versus flag-targeting identity properties, URL sanitization, and invitation-bearing request headers. A local recorder probe also verified that lobby join codes and QR images are blocked from session replay.
- Independent reviews covered scoring transactions and revisions, pagination access/cursors, identity provisioning, setup/rematch boundaries, telemetry delivery/privacy, and fixture preservation. Findings from those reviews were fixed and retested before packaging.

### Authenticated browser evidence

A production build ran locally against a separate disposable database and a local Resend-compatible email sink. Authentication used the existing development test account and a short-lived sign-in token because the local password setting was a placeholder. No account settings, organizations, or memberships were changed, and no test completion email was sent to an external recipient.

The browser exercised real UI events and server actions:

- Create a two-player, 50-point Circle game; reload the colors URL and recover to player selection.
- Delay action requests, then double-click game creation and round submission: one request for each operation.
- Save round one (30/10), complete round two (55/20), and verify persisted status/winner in the game list.
- Open editing using the keyboard, change the completed winner to the guest (40/50), reopen the game (34/20), and verify the new persisted state.
- Use two browser tabs with independently loaded drafts: the second saves 28 cards, the stale first tab retains its 29-card draft, blocks the conflicting save, shows 29 versus 28 after refresh, and saves only after explicit adoption of the new revision.
- Complete the game again and double-click rematch under a delayed request: one rematch request and a fresh round-one game.
- Load an eight-player, three-round game at a 360px viewport. Forecast calculation starts only after revealing its carousel card; the production worker asset returns HTTP 200 and renders a result. The observed worker duration was about **104 ms**, with no observed main-thread long task during that interval. The document remains 360px wide; the history table scrolls within its 326px container, and paired scoring inputs remain aligned and editable.
- On the final production build, paginate 28 synthetic games into pages of 20 and 8 with no overlap; changing the status filter resets the cursor and returns the single completed game.

The browser emits expected local-environment notices for disabled PostHog, the unavailable local Vercel Analytics endpoint, and Clerk development keys. These are not evidence of deployed telemetry behavior. The mobile-sized browser run is desktop Chromium, not a representative physical mobile-device performance benchmark.

## Reproduce the automated gates

```sh
npm ci
npx next typegen
npm run typecheck
npm run lint
npm test -- --runInBand --coverage=false
npm run test:integration
```

Use the synthetic service configuration in `.github/workflows/test.yml` for the isolated `npx next build` gate. Do not use `npm run build` as a read-only check against an existing database: that command intentionally deploys migrations first. The two new migrations add `Round.revision` and the game-list cursor index; neither drops data.

## Remaining decisions and limits

- The deleted contact export remains in older Git history and may remain in forks, caches, or artifacts. Repository-history and artifact remediation require a separate coordinated decision; source deletion is not historical erasure.
- Slack reports fail closed until `SLACK_WHOIS_TEAM_ID` and `SLACK_WHOIS_USER_IDS` identify the approved workspace and operators. Runtime configuration was not changed during this pass.
- Dependency audit findings fall from 14 affected entries to 3, all tracing to one Prisma-tooling `deepmerge-ts` advisory. The compatible Prisma line still pins the affected major; the patched major requires an upstream/tooling decision. Production trace inspection did not include that tooling path. See `dependency-remediation.md`.
- Automatic initial campaign/referrer attribution is disabled to keep invitation context out of telemetry; sanitized pageviews remain. Email and username targeting traits are supplied to feature flags separately from event identity.
- Welcome-email idempotency uses the provider's retention window; this is not a durable outbox or a general ordering guarantee for distinct webhook updates.
- Retired `OrganizationMembership` and guest invitation columns remain for a separate schema/data review. The older broad event-instrumentation wishlist in #217 and the separate Insights/marketing product work are not completed by this audit stack.
- Preview-environment browser verification and real mobile-device measurements remain useful pre-release checks. Local checks do not claim that these changes are merged, deployed, or approved by a human reviewer.
