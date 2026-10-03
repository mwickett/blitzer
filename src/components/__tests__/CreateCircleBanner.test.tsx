import { act, fireEvent, render, screen } from "@testing-library/react";
import CreateCircleBanner from "../CreateCircleBanner";

const mockAuth = { isLoaded: true, userId: "user_1" as string | null | undefined };
jest.mock("@clerk/nextjs", () => ({ useAuth: () => mockAuth }));

const heading = "Play with the same crew often?";

beforeEach(() => {
  localStorage.clear();
  mockAuth.isLoaded = true;
  mockAuth.userId = "user_1";
});

it("stays hidden until Clerk knows who is signed in", () => {
  mockAuth.isLoaded = false;
  mockAuth.userId = undefined;
  const { rerender } = render(<CreateCircleBanner />);
  expect(screen.queryByText(heading)).not.toBeInTheDocument();

  mockAuth.isLoaded = true;
  mockAuth.userId = "user_1";
  rerender(<CreateCircleBanner />);
  expect(screen.getByText(heading)).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Create a Circle" })).toHaveAttribute("href", "/circles/setup");
});

it("remembers a dismissal for that player only", () => {
  const { unmount } = render(<CreateCircleBanner />);
  fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
  expect(screen.queryByText(heading)).not.toBeInTheDocument();
  expect(localStorage.getItem("blitzer:create-circle-banner-dismissed:user_1")).toBe("true");
  unmount();

  render(<CreateCircleBanner />);
  expect(screen.queryByText(heading)).not.toBeInTheDocument();
});

it("still shows for the next player on the same device", () => {
  localStorage.setItem("blitzer:create-circle-banner-dismissed:user_1", "true");
  mockAuth.userId = "user_2";
  render(<CreateCircleBanner />);
  expect(screen.getByText(heading)).toBeInTheDocument();
});

it("hides when the same player dismisses it in another tab", () => {
  render(<CreateCircleBanner />);
  const key = "blitzer:create-circle-banner-dismissed:user_1";
  act(() => {
    localStorage.setItem(key, "true");
    window.dispatchEvent(new StorageEvent("storage", { key, newValue: "true" }));
  });
  expect(screen.queryByText(heading)).not.toBeInTheDocument();
});
