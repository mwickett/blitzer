import { render, screen } from "@testing-library/react";
import { RouteLoading } from "@/components/RouteLoading";

it("announces a busy region with a readable label and hides the placeholders", () => {
  const { container } = render(<RouteLoading label="Loading your games…" rows={2} />);

  expect(screen.getByRole("main")).toHaveAttribute("aria-busy", "true");
  expect(screen.getByText("Loading your games…")).toHaveClass("sr-only");
  const placeholders = container.querySelector('[aria-hidden="true"]');
  // Title, subtitle, and the requested rows
  expect(placeholders?.children).toHaveLength(4);
});
