# External cleanup after Slack / contact retirement

**Status (2026-09-24):** Application code for Slack `/whois`, contact export, and guest-email migration invitations is **already gone on `main`**. This checklist is the remaining **ops / artifact** work. Do **not** rewrite git history from this list.

Verified against `main` after [#308](https://github.com/mwickett/blitzer/pull/308) (Slack removal) and [#299](https://github.com/mwickett/blitzer/pull/299) (contact-export removal).

## Code verify (already done — no app change needed)

| Path / concern | Live on `main`? | Notes |
| --- | --- | --- |
| `/api/slack/whois` | No | Route, tests, and `docs/slack-integration.md` deleted in #308 |
| `SLACK_*` in `.env.example` | No | Three vars removed in #308 |
| Slack npm dependency | No | Never a package dependency; signing was env-only |
| `src/data/legacy-friends.json` | No | Deleted in #299 |
| Invite-friends migration UI / mutations | No | Banner, mutations, and plans removed; `/circles/invite-friends` only redirects to `/dashboard` |
| Guest-email invitation actions | No | No `invitationSent` / `emailSent` writers in `src/` |
| CI / GitHub Actions Slack secrets | No | Workflows do not reference `SLACK_*` |

Circle invitations remain **Clerk org invitations** (supported). Pickup “invitation” links use join tokens — unrelated to the retired contact-export flow.

---

## Safe to do now (owner / ops)

### 1. Vercel environment variables

In the Blitzer Vercel project, for **Production**, **Preview**, and **Development** (and any custom environments):

- [ ] Remove `SLACK_SIGNING_SECRET`
- [ ] Remove `SLACK_WHOIS_TEAM_ID`
- [ ] Remove `SLACK_WHOIS_USER_IDS`

Redeploy is optional; unused env vars do not restore the deleted route. Removing them avoids confusion and secret sprawl.

Also check any **local** `.env` / `.env.local` / teammate machines / password managers for the same three keys.

### 2. Slack app / workspace

The Slack app is external to the repo. Deleting the Next route does **not** uninstall the app or remove the slash command.

- [ ] Open the Slack app used for Blitzer `/whois`
- [ ] If that app exists **only** for Blitzer reports: uninstall it from the workspace (or delete the Slack app)
- [ ] If the app is shared with other tools: remove only the `/whois` slash command and any Request URL pointing at `…/api/slack/whois`
- [ ] Confirm a test `/whois` in Slack no longer hits a live Blitzer handler (expect Slack “failed” / dead endpoint, not a Blitzer stats reply)

### 3. Docs already in-repo

- [ ] No further README / `.env.example` Slack scrub needed on current `main` (done in #308)

---

## Needs an explicit owner decision (do not do casually)

### A. Contact-export copies in git history

`src/data/legacy-friends.json` (emails/usernames) was deleted from the tree in #299 but **still exists in older commits**. Forks, CI caches, local clones, and any exported artifacts may still hold copies.

| Action | Safe without extra process? |
| --- | --- |
| Leave history as-is; rely on private-repo access control | Yes — default |
| Rotate / treat listed emails as already exposed to repo collaborators | Owner judgment |
| `git filter-repo` / BFG / force-push rewrite | **No** — coordinated decision only; breaks SHAs, open PRs, and clones |
| Ask GitHub Support for blob purge after a rewrite | Only after a planned rewrite |

**This checklist does not authorize history rewrite.**

### B. Schema leftovers (separate migration track)

Still in `schema.prisma`, unused by the app:

- `OrganizationMembership` table (Clerk is source of truth; no sync)
- `GuestUser.invitationSent`, `invitationSentAt`, `emailSent`

Dropping these needs a dedicated migration review. Not required for Slack/contact ops cleanup.

### C. Historical design docs under `docs/superpowers`

Older plans/specs still mention Slack `/whois` or invite-previous-friends. They are design history, not live contracts. Leaving them is fine; rewriting or deleting them is optional hygiene, not security cleanup.

---

## Out of scope / do not restore

- Contact import / guest-email migration invitations
- Slack `/whois` or operator Slack telemetry
- Treating `docs/superpowers` invite/Slack plans as the current product contract

---

## Done when

1. Three `SLACK_*` vars are gone from all Vercel envs (and local copies you care about).
2. Slack `/whois` is uninstalled or deconfigured so it cannot call Blitzer.
3. Owner has either accepted “history remains” for `legacy-friends.json` or opened a **separate**, explicit history-remediation plan.
