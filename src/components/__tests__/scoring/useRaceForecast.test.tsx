import { act, render, screen } from "@testing-library/react";
import { useRaceForecast } from "@/components/scoring/graphs/useRaceForecast";
import { createForecastWorker } from "@/lib/scoring/createForecastWorker";
import {
  forecastKey,
  type ForecastInput,
  type ForecastReply,
} from "@/lib/scoring/forecastInput";
import type { RaceForecast } from "@/lib/scoring/probability";

jest.mock("@/lib/scoring/createForecastWorker", () => ({
  createForecastWorker: jest.fn(),
}));

class TestWorker {
  onmessage: ((event: MessageEvent<ForecastReply>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  onmessageerror: (() => void) | null = null;
  postMessage = jest.fn();
  terminate = jest.fn();
  reply(forecast: RaceForecast, key = this.postMessage.mock.calls[0][0].key) {
    this.onmessage?.(
      new MessageEvent("message", { data: { key, ok: true, forecast } }),
    );
  }
}
const forecast: RaceForecast = {
  players: {},
  gameEndRound: null,
  unresolvedProbability: 0,
  confidence: "low",
  simulationCount: 10000,
  usesHistoricalData: false,
  historicalSampleCount: 0,
  usesMechanicsModel: true,
};
let sequence = 0;
const input = (): ForecastInput => ({
  players: [{ id: `p${sequence++}`, score: 10, roundsPlayed: 3 }],
  winThreshold: 200,
  options: {},
});
let workers: TestWorker[];
let observers: {
  callback: IntersectionObserverCallback;
  disconnect: jest.Mock;
}[];
const originalObserver = globalThis.IntersectionObserver;

function Harness({ input }: { input: ForecastInput }) {
  const { containerRef, status, forecast } = useRaceForecast(input);
  return (
    <div ref={containerRef} data-testid="forecast" data-status={status}>
      {forecast?.confidence}
    </div>
  );
}
function visibility(visible: boolean) {
  act(() =>
    observers
      .at(-1)!
      .callback(
        [{ isIntersecting: visible } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      ),
  );
}
beforeEach(() => {
  workers = [];
  observers = [];
  (createForecastWorker as jest.Mock).mockImplementation(() => {
    const worker = new TestWorker();
    workers.push(worker);
    return worker;
  });
  Object.defineProperty(globalThis, "IntersectionObserver", {
    configurable: true,
    writable: true,
    value: jest.fn((callback: IntersectionObserverCallback) => {
      const observer = { callback, observe: jest.fn(), disconnect: jest.fn() };
      observers.push(observer);
      return observer;
    }),
  });
});
afterAll(() => {
  globalThis.IntersectionObserver = originalObserver;
});

it("waits for visibility and reuses identical content across polls and remounts", () => {
  const data = input();
  const view = render(<Harness input={data} />);
  expect(workers).toHaveLength(0);
  visibility(true);
  expect(workers).toHaveLength(1);
  expect(screen.getByTestId("forecast")).toHaveAttribute(
    "data-status",
    "loading",
  );
  view.rerender(<Harness input={JSON.parse(JSON.stringify(data))} />);
  expect(workers).toHaveLength(1);
  act(() => workers[0].reply(forecast));
  expect(screen.getByTestId("forecast")).toHaveAttribute(
    "data-status",
    "ready",
  );
  view.unmount();
  render(<Harness input={data} />);
  visibility(true);
  expect(workers).toHaveLength(1);
  expect(screen.getByTestId("forecast")).toHaveAttribute(
    "data-status",
    "ready",
  );
});

it("terminates obsolete work and ignores late or mismatched replies", () => {
  const data = input();
  const view = render(<Harness input={data} />);
  visibility(true);
  const oldWorker = workers[0];
  view.rerender(<Harness input={{ ...data, winThreshold: 150 }} />);
  expect(oldWorker.terminate).toHaveBeenCalled();
  expect(workers).toHaveLength(2);
  act(() => oldWorker.reply({ ...forecast, confidence: "high" }));
  act(() => workers[1].reply(forecast, "wrong request"));
  expect(screen.getByTestId("forecast")).toHaveAttribute(
    "data-status",
    "loading",
  );
  act(() => workers[1].reply(forecast));
  expect(screen.getByTestId("forecast")).toHaveTextContent("low");
  view.unmount();
  expect(workers[1].terminate).toHaveBeenCalled();
});

it("cancels a pending forecast when the card leaves the carousel viewport", () => {
  render(<Harness input={input()} />);
  visibility(true);
  visibility(false);
  expect(workers[0].terminate).toHaveBeenCalled();
  act(() => workers[0].reply(forecast));
  expect(screen.getByTestId("forecast")).not.toHaveTextContent("low");
});

it("shows an unavailable state for worker errors and construction failures", () => {
  const view = render(<Harness input={input()} />);
  visibility(true);
  act(() => workers[0].onerror?.(new ErrorEvent("error")));
  expect(screen.getByTestId("forecast")).toHaveAttribute(
    "data-status",
    "unavailable",
  );
  (createForecastWorker as jest.Mock).mockImplementationOnce(() => {
    throw new Error("Worker unsupported");
  });
  view.rerender(<Harness input={input()} />);
  expect(screen.getByTestId("forecast")).toHaveAttribute(
    "data-status",
    "unavailable",
  );
});

it("does not create a worker before there is enough evidence", () => {
  const data = input();
  data.players[0].roundsPlayed = 2;
  render(<Harness input={data} />);
  visibility(true);
  expect(workers).toHaveLength(0);
  expect(screen.getByTestId("forecast")).toHaveAttribute(
    "data-status",
    "insufficient",
  );
});

it("uses a stable key for reordered player arrays and record properties", () => {
  const data = input();
  data.players.push({ id: "other", score: 20, roundsPlayed: 3 });
  data.deltasByPlayer = { other: [1, 2, 3], [data.players[0].id]: [4, 5, 6] };
  const reordered = {
    options: data.options,
    winThreshold: data.winThreshold,
    players: [...data.players].reverse(),
    deltasByPlayer: Object.fromEntries(
      Object.entries(data.deltasByPlayer).reverse(),
    ),
  };
  expect(forecastKey(reordered)).toBe(forecastKey(data));
  reordered.players = reordered.players.map((player) => ({
    ...player,
    score: player.score + 1,
  }));
  expect(forecastKey(reordered)).not.toBe(forecastKey(data));
});
