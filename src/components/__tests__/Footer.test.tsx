import { render, screen } from "@testing-library/react";
import Footer from "@/components/Footer";

describe("Footer", () => {
  it("states that Blitzer is unaffiliated with Dutch Blitz Games Company", () => {
    render(<Footer />);

    expect(
      screen.getByText(/not affiliated with, endorsed by, or sponsored by/i)
    ).toBeInTheDocument();
  });

  it("links the guide instead of the retired Notion vision doc", () => {
    const { container } = render(<Footer />);

    expect(container.querySelector('a[href*="notion.site"]')).toBeNull();
    expect(
      screen.getByRole("link", { name: "Why Blitzer" })
    ).toHaveAttribute("href", "/guide/why-blitzer");
  });

  it("does not link app routes that require auth", () => {
    const { container } = render(<Footer />);

    expect(container.querySelector('a[href="/dashboard"]')).toBeNull();
    expect(container.querySelector('a[href="/games"]')).toBeNull();
  });
});
