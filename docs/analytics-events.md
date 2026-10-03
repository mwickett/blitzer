# Analytics events

Every PostHog product event Blitzer sends, where it fires, and what it carries. Add new events here when you add them.

## Rules

- Event names are `snake_case`. New properties are `snake_case` too; a few older server events still use camelCase properties (noted below) and are left as-is so existing PostHog insights keep working.
- No names, emails, IP addresses, join tokens, email subjects, or chat contents in properties. IDs (`game_id`), counts, categories, and durations are fine.
- Analytics never blocks or fails a user action. Client calls are wrapped in `try`/`catch`; server events go through `captureServerEvent` (`src/server/telemetry.ts`), which delivers inside Next's `after` lifetime.
- Pageviews are sent by `PostHogPageView` with sanitized URLs; see the README for identity handling.

## Scoring flow (client)

| Event | Fires when | Properties |
| --- | --- | --- |
| `scoring_round_submitted` | A new round saves | `game_id`, `round_number`, `player_count`, `entry_duration_ms` |
| `scoring_round_edited` | An edit to a saved round saves | same as above |
| `scoring_round_edit_cancelled` | The user backs out of editing a saved round | `game_id`, `round_number`, `had_conflict` |
| `scoring_round_conflict` | The server rejects a save as stale or conflicting | `game_id`, `round_number`, `is_edit`, `reason` (`round_conflict`, `stale_round`, `game_finished`) |
| `scoring_enter_next_round` | "Enter Round N Scores" is tapped | `round_number` |
| `scoring_graph_viewed` | A graph card is swiped into view, once per card per screen visit (the first card is visible by default and not counted) | `graph` (`score_progression`, `hot_cold`, `win_probability`), `position`, `context` (`between_rounds`, `game_over`) |
| `game_over_rematch` | "New Game with Same Players" is tapped | `player_count` |
| `game_over_back_to_games` | "Back to Games" is tapped on the finished screen | none |

`entry_duration_ms` runs from the first value typed into the draft to the successful save, so it measures entry effort rather than how long the round took to play. It is `null` when a save happens without any typing (for example, resubmitting an unchanged edit).

## Game lifecycle (server)

| Event | Fires when | Properties |
| --- | --- | --- |
| `create_game` | A Circle game is created | `gameId`, `playerCount`, `guestPlayerCount`, `win_threshold` (camelCase kept for history) |
| `clone_game` | A rematch creates a new game | `originalGameId`, `newGameId` (camelCase kept for history) |
| `set_accent_color` | The creator saves a default colour from the colour step | `color` (a palette hex) |
| `update_game_as_finished` | A round save completes the game | `game_id` |
| `game_reopened_after_edit` | An edit drops the leader back under the threshold | `game_id` |
| `create_pickup_game` / `create_pickup_game_rejected` | A pickup lobby is created, or creation is refused | `game_id`, `guest_player_count`, `win_threshold` / `reason` |
| `join_pickup_game` / `join_pickup_game_rejected` | A player joins a lobby, or the join is refused | `game_id` / `reason`, optional `game_id` |
| `start_pickup_game` / `start_pickup_game_rejected` | The host starts a lobby, or the start is refused | `game_id` / `reason`, `game_id` |

## Email and LLM (server)

| Event | Fires when | Properties |
| --- | --- | --- |
| `email_send_success`, `email_send_failed`, `email_retry_attempt`, `email_rate_limit_hit` | Provider delivery outcomes in `src/server/email.ts` | `emailType`, `recipientCount`, attempt counters, `errorName`, `reason` |
| `email_batch_completed` | The game-complete email batch finishes | `game_id`, `recipient_count`, `failed_count` |
| `llm_error` | The Insights chat route fails | `error_type` |

LLM generations are traced separately by `@posthog/ai` in privacy mode.

## Marketing (client)

| Event | Fires when | Properties |
| --- | --- | --- |
| `marketing_cta_clicked` | A marketing page call to action is clicked | `section`, `destination` |

## Answering common questions

- **How often are rounds corrected?** `scoring_round_edited` against `scoring_round_submitted`; `scoring_round_edit_cancelled` shows edits opened and abandoned.
- **Which graphs do people look at?** `scoring_graph_viewed` by `graph` and `context`.
- **Is score entry smooth?** Median `entry_duration_ms` on `scoring_round_submitted`, broken down by `player_count`.
- **Do people use "save as my default colour"?** `set_accent_color` against `create_game`.
- **Do games get abandoned?** `create_game` and `start_pickup_game` that never reach `update_game_as_finished` for the same game.
- **How often do two devices collide?** `scoring_round_conflict` by `reason`.
