import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ShareResult from "../[id]/ShareResult";

const mockCapture = jest.fn();
jest.mock("posthog-js/react", () => ({
  usePostHog: () => ({ capture: mockCapture }),
}));

const nav = navigator as unknown as Record<string, unknown>;

beforeEach(() => {
  mockCapture.mockReset();
  delete nav.share;
  delete nav.canShare;
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    blob: () => Promise.resolve(new Blob(["png"], { type: "image/png" })),
  }) as unknown as typeof fetch;
});

function press() {
  const button = screen.getByRole("button", { name: /Share result/ });
  fireEvent.pointerDown(button);
  fireEvent.click(button);
}

it("shares the recap picture when the device can share files", async () => {
  const share = jest.fn().mockResolvedValue(undefined);
  Object.assign(nav, { share, canShare: () => true });
  render(<ShareResult gameId="g1" winnerName="Priya" />);
  press();
  await screen.findByText("Shared");
  expect(global.fetch).toHaveBeenCalledWith("/games/g1/opengraph-image");
  expect(share.mock.calls[0][0].files[0].name).toBe("blitzer-game.png");
  expect(share.mock.calls[0][0].title).toBe("Priya won at Dutch Blitz");
  expect(mockCapture).toHaveBeenCalledWith("game_result_shared", {
    game_id: "g1",
    method: "image",
  });
});

it("shares the link when files can't be shared", async () => {
  const share = jest.fn().mockResolvedValue(undefined);
  Object.assign(nav, { share, canShare: () => false });
  render(<ShareResult gameId="g1" winnerName="Priya" />);
  press();
  await screen.findByText("Shared");
  expect(share.mock.calls[0][0].files).toBeUndefined();
  expect(mockCapture).toHaveBeenCalledWith("game_result_shared", {
    game_id: "g1",
    method: "link",
  });
});

it("copies the link without a share sheet", async () => {
  const writeText = jest.fn().mockResolvedValue(undefined);
  Object.assign(nav, { clipboard: { writeText } });
  render(<ShareResult gameId="g1" winnerName="Priya" />);
  press();
  await screen.findByText("Link copied");
  expect(writeText).toHaveBeenCalledWith(window.location.href);
});

it("treats closing the share sheet as nothing happening", async () => {
  const share = jest
    .fn()
    .mockRejectedValue(new DOMException("closed", "AbortError"));
  Object.assign(nav, { share, canShare: () => true });
  render(<ShareResult gameId="g1" winnerName="Priya" />);
  press();
  await waitFor(() => expect(share).toHaveBeenCalled());
  expect(
    screen.getByRole("button", { name: /Share result/ }),
  ).toBeInTheDocument();
  expect(mockCapture).not.toHaveBeenCalled();
});
