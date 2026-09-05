# Audit implementation and verification

The September 5, 2026 audit implementation was delivered as a ten-part review stack on top of the audited dependency baseline, `e9035f5` (PR #277). All ten PRs (#298–307) and #277 are merged into `main` at `0ac4a14`. Its tree matches the validated final stack, including the verification guide. [Post-merge CI passed](https://github.com/mwickett/blitzer/actions/runs/33983561377), and [Vercel reported a successful deployment](https://vercel.com/wickett-stuff/blitzer/5m7981dVEqEYgRJDLY1hGWfasB1e).

After the audit, the Slack integration was retired at the owner's request. The `/api/slack/whois` route, its tests, environment examples, and setup guide have been removed. References below to Slack describe the original audit's verification, not a supported feature. See the external cleanup steps under remaining decisions.

## Completed review and merge order

The existing #277 baseline landed first, followed by the numbered parts below. Each successor was retargeted to `main` after its predecessor landed; each proposed and actual merged tree was verified against the tested PR head. All PRs used merge commits.

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
- The final audit source tree passed **46 suites / 318 source tests**, **18 real PostgreSQL integration tests**, type checking, lint with **zero warnings**, and a production Next.js build. Fresh `npm ci` and Prisma generation passed. These counts precede the later Slack removal.
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

### Hosted and phone checks to run

Open the current Vercel preview in a desktop browser and on a physical phone. Use a development account and test Circle; create a two-player game with yourself and a guest, with a winning score of 50. Refresh the color-selection page before starting to check setup recovery. If using production instead, use your own account and expect test games to affect your statistics and potentially send completion email.

Enter these values by their field labels. After every save, check the scoreboard, reload the game, and check its status and winner in the game list.

| Action | Your cards played / Blitz left | Guest cards played / Blitz left | Expected cumulative result |
| --- | --- | --- | --- |
| Save round 1 | 30 / 0 | 20 / 5 | 30–10, ongoing |
| Save round 2 | 25 / 0 | 20 / 5 | 55–20, you win and celebration appears |
| Edit round 2 | 20 / 5 | 40 / 0 | 40–50, guest becomes winner |
| Edit round 2 again | 4 / 0 | 20 / 5 | 34–20, game reopens |

Then check:

1. Open the same existing round for editing in two tabs. Enter different drafts, save one, then save the stale tab. The stale tab must retain its draft and show a conflict. Use **Refresh current scores**, compare the saved values, and explicitly choose how to continue.
2. Complete the game again and double-click rematch. Exactly one new game should appear, starting at round one. Double-click round submission in that game and confirm only one round is saved.
3. On the phone, type with the numeric keyboard, edit an earlier round, and scroll the history table sideways. The page itself should stay within the screen, inputs should remain readable, and saving should preserve the values after reload.
4. Open a longer game with at least three rounds and swipe to its forecast card. It should load without freezing score entry or scrolling. Record the phone model/browser and any visible delay.
5. On desktop, use Tab and Enter to open a round editor, then Escape to cancel. Focus should return to the edit control.

Report the deployment URL, browser/device, step, expected result, and actual result for any failure. The earlier protected-preview automation attempt was denied access to the `wickett-stuff` Vercel scope; reconnect that connector with access to this team if delegating the hosted browser pass.

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
- Slack retirement requires external configuration cleanup: remove the Blitzer app's `/whois` command (or uninstall the app if it serves only Blitzer). Remove `SLACK_SIGNING_SECRET`, `SLACK_WHOIS_TEAM_ID`, and `SLACK_WHOIS_USER_IDS` wherever configured for this project, including Vercel environments and local environment files. Deleting the route does not change Slack installations or existing deployment settings.
- Dependency audit findings fall from 14 affected entries to 3, all tracing to one Prisma-tooling `deepmerge-ts` advisory. The compatible Prisma line still pins the affected major; the patched major requires an upstream/tooling decision. Production trace inspection did not include that tooling path. See `dependency-remediation.md`.
- Automatic initial campaign/referrer attribution is disabled to keep invitation context out of telemetry; sanitized pageviews remain. Email and username targeting traits are supplied to feature flags separately from event identity.
- Welcome-email idempotency uses the provider's retention window; this is not a durable outbox or a general ordering guarantee for distinct webhook updates.
- Retired `OrganizationMembership` and guest invitation columns remain for a separate schema/data review. The older broad event-instrumentation wishlist in #217 and the separate Insights/marketing product work are not completed by this audit stack.
- Authenticated hosted-browser verification and real mobile-device measurements remain outstanding. Successful CI, deployment status, and the public homepage smoke check do not establish that these user flows have passed on the hosted app.
