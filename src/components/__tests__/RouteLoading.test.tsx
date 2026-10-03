import { render, screen } from "@testing-library/react";
import { RouteLoading } from "@/components/RouteLoading";

it("announces its label in a status region and hides the placeholders", async () => {
  const { container } = render(<RouteLoading label="Loading your games…" rows={2} />);

  const status = screen.getByRole("status");
  // The label is written into an already-mounted region so it is announced
  expect(await screen.findByText("Loading your games…")).toBe(status);
  expect(status.closest("[aria-busy]")).toBeNull();
  // Rendered inside the layout's <main>, so it must not add another landmark
  expect(screen.queryByRole("main")).toBeNull();
  const placeholders = container.querySelector('[aria-hidden="true"]');
  // Title, subtitle, and the requested rows
  expect(placeholders?.children).toHaveLength(4);
});
