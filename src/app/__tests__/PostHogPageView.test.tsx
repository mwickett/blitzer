import { render } from "@testing-library/react";
import PostHogPageView from "../PostHogPageView";

let mockAuth: { isLoaded: boolean; isSignedIn: boolean | undefined; userId: string | null };
let mockUser: { id: string; username: string; primaryEmailAddress?: { emailAddress: string } } | null;
const mockPosthog = {
  capture: jest.fn(), identify: jest.fn(), reset: jest.fn(),
  get_distinct_id: jest.fn(), get_property: jest.fn(),
  setPersonPropertiesForFlags: jest.fn(),
};
jest.mock("@clerk/nextjs", () => ({ useAuth: () => mockAuth, useUser: () => ({ user: mockUser }) }));
jest.mock("posthog-js/react", () => ({ usePostHog: () => mockPosthog }));
jest.mock("next/navigation", () => ({ usePathname: () => "/dashboard", useSearchParams: () => new URLSearchParams() }));

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth = { isLoaded: false, isSignedIn: undefined, userId: null };
  mockUser = null;
  mockPosthog.get_distinct_id.mockReturnValue("previous-user");
  mockPosthog.get_property.mockReturnValue("previous-user");
});

test("auth hydration neither resets nor identifies a user", () => {
  render(<PostHogPageView />);
  expect(mockPosthog.reset).not.toHaveBeenCalled();
  expect(mockPosthog.identify).not.toHaveBeenCalled();
  expect(mockPosthog.capture).not.toHaveBeenCalled();
});

test("account switching identifies the new user only after its profile loads", () => {
  mockAuth = { isLoaded: true, isSignedIn: true, userId: "new-user" };
  mockUser = { id: "previous-user", username: "previous" };
  const { rerender } = render(<PostHogPageView />);
  expect(mockPosthog.identify).not.toHaveBeenCalled();
  mockUser = { id: "new-user", username: "new" };
  rerender(<PostHogPageView />);
  expect(mockPosthog.identify).toHaveBeenCalledWith("new-user");
  expect(mockPosthog.identify.mock.invocationCallOrder[0]).toBeLessThan(mockPosthog.capture.mock.invocationCallOrder[0]);
  expect(mockPosthog.setPersonPropertiesForFlags).toHaveBeenCalledWith(expect.objectContaining({ username: "new" }), false);
  mockPosthog.get_distinct_id.mockReturnValue("new-user");
  rerender(<PostHogPageView />);
  expect(mockPosthog.identify).toHaveBeenCalledTimes(1);
  expect(mockPosthog.capture).toHaveBeenCalledTimes(1);
});

test("confirmed sign-out clears persisted identity", () => {
  mockAuth = { isLoaded: true, isSignedIn: false, userId: null };
  render(<PostHogPageView />);
  expect(mockPosthog.reset).toHaveBeenCalledTimes(1);
  expect(mockPosthog.reset.mock.invocationCallOrder[0]).toBeLessThan(mockPosthog.capture.mock.invocationCallOrder[0]);
});

test("hydrated existing identities refresh flag traits once and after profile changes", () => {
  mockAuth = { isLoaded: true, isSignedIn: true, userId: "current-user" };
  mockUser = { id: "current-user", username: "before" };
  mockPosthog.get_distinct_id.mockReturnValue("current-user");
  const { rerender } = render(<PostHogPageView />);
  expect(mockPosthog.setPersonPropertiesForFlags).toHaveBeenCalledWith(expect.objectContaining({ username: "before" }), true);
  rerender(<PostHogPageView />);
  expect(mockPosthog.setPersonPropertiesForFlags).toHaveBeenCalledTimes(1);
  mockUser = { ...mockUser, username: "after" };
  rerender(<PostHogPageView />);
  expect(mockPosthog.setPersonPropertiesForFlags).toHaveBeenLastCalledWith(expect.objectContaining({ username: "after" }), true);
  expect(mockPosthog.capture).toHaveBeenCalledTimes(1);
});
