# Forecast worker verification

The forecast card now starts a worker when it becomes visible, caches up to 20
score/history snapshots, and cancels pending work when hidden, replaced, or
unmounted. The main thread never falls back to running the simulation. Worker
failures leave a readable unavailable state and scoring remains available.

Run the deterministic comparison with:

```sh
npx tsx scripts/benchmark-forecast.ts
```

The script runs the actual browser worker message handler through a Node worker
adapter. Each result is deeply compared with the synchronous engine's result.
The fixture has three valid rounds, a 200-point threshold, eight cards played
per player, and one rotating blitzer per round; others have five blitz cards
left. All 10,000 simulations and the 50-round horizon are unchanged.

Measured on local macOS with Node 24.15.0 on 2026-09-05, five warm runs:

| Players | Synchronous call | Worker round trip | Main-thread content key |
| --- | --- | --- | --- |
| 2 | 52.4–55.5 ms | 54.2–71.4 ms | 0.018–0.020 ms |
| 4 | 204.3–215.6 ms | 208.1–213.0 ms | 0.023–0.053 ms |
| 8 | 413.6–418.3 ms | 425.0–428.8 ms | 0.025–0.030 ms |

Outputs matched exactly for every run. During the five worker runs a 5 ms
main-thread timer fired 52, 187, and 380 times respectively, with less than
0.8 ms added delay. Total simulation cost is similar; the work moves off the
thread handling rendering and input.

These are Node measurements. They exclude browser worker startup/download cost
and do not establish mobile rendering or input latency. The browser gate is to
open a three-round, eight-player game, reveal the forecast carousel card, and
verify worker loading, responsive input/navigation, cached unchanged refreshes,
and cancellation when moving away. Repeat on representative mobile hardware.

Server history enrichment now reuses the authenticated page's game snapshot,
skips finished games and initial entry, retains per-player sample bounds and
same-circle scoping, and falls back to current-game evidence if its queries fail.
