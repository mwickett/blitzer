import { fireEvent, render, screen } from "@testing-library/react";
import posthog from "posthog-js";
import * as Sentry from "@sentry/nextjs";
import GamesListError from "../games/error";
import DashboardError from "../dashboard/error";
import GameDetailError from "../games/[id]/error";

jest.mock("@sentry/nextjs", () => ({
  captureException: jest.fn(),
}));

jest.mock("posthog-js", () => ({
  __esModule: true,
  default: { captureException: jest.fn() },
}));

jest.mock("next/navigation", () => ({
  useParams: () => ({ id: "game-123" }),
}));

const makeError = () => {
  const error = new Error("boom") as Error & { digest?: string };
  error.digest = "digest-abc123";
  return error;
};

// Jest runs with NODE_ENV=test — like production, anything gated to
// NODE_ENV === "development" is hidden. Issue #110: users in prod saw a
// generic error card with nothing reportable, because the digest was
// inside the dev-only block.
describe("route error boundaries outside development", () => {
  it.each([
    ["games list", GamesListError],
    ["dashboard", DashboardError],
    ["game detail", GameDetailError],
  ])("%s boundary shows the error digest", (_name, Boundary) => {
    render(<Boundary error={makeError()} reset={() => {}} />);
    expect(screen.getByText(/digest-abc123/)).toBeInTheDocument();
  });

  it("does not leak the raw error message", () => {
    render(<GamesListError error={makeError()} reset={() => {}} />);
    expect(screen.queryByText(/boom/)).not.toBeInTheDocument();
  });
});


it("keeps game context, reset, and recovery navigation in the shared boundary", () => {
  const error = makeError();
  const reset = jest.fn();
  render(<GameDetailError error={error} reset={reset} />);
  fireEvent.click(screen.getByRole("button", { name: "Try Again" }));
  expect(reset).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("link", { name: "Return to Games List" })).toHaveAttribute("href", "/games");
  expect(Sentry.captureException).toHaveBeenCalledWith(error, {
    tags: { section: "game-detail" }, contexts: { game: { gameId: "game-123" } },
  });
  expect(posthog.captureException).toHaveBeenCalledWith(error, {
    errorSource: "game-detail", errorDigest: error.digest, gameId: "game-123",
  });
});
