// Run: npx tsx scripts/benchmark-forecast.ts
import assert from "node:assert/strict";
import { once } from "node:events";
import { performance } from "node:perf_hooks";
import { Worker } from "node:worker_threads";
import { calcRaceForecast } from "../src/lib/scoring/probability";
import {
  forecastKey,
  type ForecastInput,
  type ForecastReply,
} from "../src/lib/scoring/forecastInput";

async function main() {
  for (const count of [2, 4, 8]) {
    const players = Array.from({ length: count }, (_, index) => ({
      id: `p${index}`,
      score: 0,
      roundsPlayed: 3,
    }));
    const samples = Object.fromEntries(
      players.map((player, index) => [
        player.id,
        Array.from({ length: 3 }, (_, round) => ({
          totalCardsPlayed: 8,
          blitzPileRemaining: index === round % count ? 0 : 5,
        })),
      ]),
    );
    const deltas = Object.fromEntries(
      players.map((player) => [
        player.id,
        samples[player.id].map(
          (sample) => sample.totalCardsPlayed - 2 * sample.blitzPileRemaining,
        ),
      ]),
    );
    for (const player of players)
      player.score = deltas[player.id].reduce((sum, value) => sum + value, 0);
    const input: ForecastInput = {
      players,
      winThreshold: 200,
      deltasByPlayer: deltas,
      options: { roundSamplesByPlayer: samples },
    };
    const key = forecastKey(input);
    const expected = calcRaceForecast(players, 200, deltas, input.options);
    const syncMs: number[] = [];
    const keyMs: number[] = [];
    for (let index = 0; index < 5; index++) {
      let start = performance.now();
      forecastKey(input);
      keyMs.push(performance.now() - start);
      start = performance.now();
      assert.deepEqual(
        calcRaceForecast(players, 200, deltas, input.options),
        expected,
      );
      syncMs.push(performance.now() - start);
    }
    const worker = new Worker(
      new URL("./forecast-worker-harness.mjs", import.meta.url),
    );
    try {
      await once(worker, "message");
      const simulate = async () => {
        const replyPromise = once(worker, "message");
        worker.postMessage({ key, input });
        const [reply] = (await replyPromise) as [ForecastReply];
        assert.ok(reply.ok);
        assert.deepEqual(reply.forecast, expected);
      };
      await simulate();
      let ticks = 0;
      let maxTimerDelay = 0;
      let previousTick = performance.now();
      const timer = setInterval(() => {
        const now = performance.now();
        maxTimerDelay = Math.max(maxTimerDelay, now - previousTick - 5);
        previousTick = now;
        ticks++;
      }, 5);
      const workerMs: number[] = [];
      try {
        for (let index = 0; index < 5; index++) {
          const start = performance.now();
          await simulate();
          workerMs.push(performance.now() - start);
        }
      } finally {
        clearInterval(timer);
      }
      console.log(
        JSON.stringify({
          players: count,
          rounds: 3,
          threshold: 200,
          identicalOutput: true,
          syncMs,
          workerMs,
          keyMs,
          mainThreadTimerTicks: ticks,
          maxTimerDelayMs: maxTimerDelay,
        }),
      );
    } finally {
      await worker.terminate();
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
