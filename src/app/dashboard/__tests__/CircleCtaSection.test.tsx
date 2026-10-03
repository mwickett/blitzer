import { render, screen } from "@testing-library/react";
import CircleCtaSection from "../_components/CircleCtaSection";

const mockAuth = jest.fn();
jest.mock("@clerk/nextjs/server", () => ({ auth: () => mockAuth() }));
jest.mock("@/components/CreateCircleBanner", () => ({
  __esModule: true,
  default: () => <div>create circle banner</div>,
}));

it("invites players without a Circle to create one", async () => {
  mockAuth.mockResolvedValue({ userId: "user_1", orgId: null });
  render(<>{await CircleCtaSection()}</>);
  expect(screen.getByText("create circle banner")).toBeInTheDocument();
});

it("stays out of the way for Circle members", async () => {
  mockAuth.mockResolvedValue({ userId: "user_1", orgId: "org_1" });
  expect(await CircleCtaSection()).toBeNull();
});
