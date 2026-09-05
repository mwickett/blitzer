import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import CircleSetup from "../CircleSetup";
import CircleSetupPage from "../page";

const mockReplace = jest.fn();
const mockRefresh = jest.fn();
const mockRedirect = jest.fn(() => { throw new Error("redirect"); });
const mockAccept = jest.fn();
const mockSetActive = jest.fn();
const mockRevalidate = jest.fn();
const mockAuth = jest.fn();
const mockState = {
  isLoaded: true,
  organization: null as { id: string } | null,
  invitations: [{ id: "invitation", publicOrganizationData: { id: "circle", name: "Game night" }, accept: mockAccept }],
  memberships: [] as { organization: { id: string; name: string } }[],
};

jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace, refresh: mockRefresh }),
  redirect: () => mockRedirect(),
}));
jest.mock("@clerk/nextjs/server", () => ({ auth: () => mockAuth() }));
jest.mock("@clerk/nextjs", () => ({
  useOrganization: () => ({ isLoaded: mockState.isLoaded, organization: mockState.organization }),
  useOrganizationList: () => ({
    isLoaded: mockState.isLoaded,
    setActive: mockSetActive,
    userInvitations: { data: mockState.invitations, revalidate: mockRevalidate },
    userMemberships: { data: mockState.memberships, revalidate: mockRevalidate },
  }),
  CreateOrganization: () => <div>Create Circle form</div>,
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockState.isLoaded = true;
  mockState.organization = null;
  mockState.invitations = [{ id: "invitation", publicOrganizationData: { id: "circle", name: "Game night" }, accept: mockAccept }];
  mockState.memberships = [];
  mockAccept.mockResolvedValue({});
  mockSetActive.mockResolvedValue(undefined);
});

it("redirects an already-onboarded visitor from the server page", async () => {
  mockAuth.mockResolvedValue({ userId: "user", orgId: "circle" });
  await expect(CircleSetupPage()).rejects.toThrow("redirect");
  expect(mockRedirect).toHaveBeenCalledTimes(1);
});

it("shows loading separately from a loaded user with no Circles", () => {
  mockState.isLoaded = false;
  const { rerender } = render(<CircleSetup />);
  expect(screen.getByRole("status", { name: "Loading circles" })).toBeInTheDocument();
  mockState.isLoaded = true;
  mockState.invitations = [];
  rerender(<CircleSetup />);
  expect(screen.getByText(/No pending invitations/)).toBeInTheDocument();
  expect(mockReplace).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Create a new circle instead" }));
  expect(screen.getByText("Create Circle form")).toBeInTheDocument();
});

it("retains the pickup option for a user without a Circle", async () => {
  mockAuth.mockResolvedValue({ userId: "user", orgId: null });
  render(await CircleSetupPage());
  expect(screen.getByRole("link", { name: "Start a pickup game instead" }))
    .toHaveAttribute("href", "/games/new?type=pickup");
});

it("accepts once, activates the invited Circle, and navigates after activation", async () => {
  let finishAccept!: () => void;
  mockAccept.mockImplementation(() => new Promise<void>((resolve) => { finishAccept = resolve; }));
  render(<CircleSetup />);
  const join = screen.getByRole("button", { name: "Join" });
  fireEvent.click(join);
  fireEvent.click(join);
  expect(mockAccept).toHaveBeenCalledTimes(1);
  expect(join).toBeDisabled();
  expect(mockSetActive).not.toHaveBeenCalled();
  expect(mockReplace).not.toHaveBeenCalled();
  await act(async () => { finishAccept(); });
  expect(mockSetActive).toHaveBeenCalledWith({ organization: "circle" });
  expect(mockReplace).toHaveBeenCalledWith("/dashboard");
});

it("allows retry after invitation acceptance fails", async () => {
  mockAccept.mockRejectedValueOnce(new Error("Network error"));
  render(<CircleSetup />);
  fireEvent.click(screen.getByRole("button", { name: "Join" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Please try again");
  expect(mockSetActive).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Join" }));
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/dashboard"));
  expect(mockAccept).toHaveBeenCalledTimes(2);
});

it("retries activation without accepting an already-accepted invitation again", async () => {
  mockSetActive.mockRejectedValueOnce(new Error("Network error"));
  render(<CircleSetup />);
  fireEvent.click(screen.getByRole("button", { name: "Join" }));
  await screen.findByRole("alert");
  fireEvent.click(screen.getByRole("button", { name: "Join" }));
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/dashboard"));
  expect(mockAccept).toHaveBeenCalledTimes(1);
  expect(mockSetActive).toHaveBeenCalledTimes(2);
});

it("allows an existing membership to be activated with no active Circle", async () => {
  mockState.memberships = [{ organization: { id: "existing-circle", name: "Family" } }];
  render(<CircleSetup />);
  fireEvent.click(screen.getByRole("button", { name: "Open" }));
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/dashboard"));
  expect(mockSetActive).toHaveBeenCalledWith({ organization: "existing-circle" });
  expect(mockAccept).not.toHaveBeenCalled();
});
