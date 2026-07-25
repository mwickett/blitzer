import { render, screen } from "@testing-library/react";
import NavBar from "@/app/NavBar";

// jest.setup.js defines this global to drive the @clerk/nextjs `Show` mock.
declare global {
  function __setClerkAuthState(state: "signed-in" | "signed-out"): void;
}

// NavBar reads the llm-features flag; posthog is not wired up in jsdom.
jest.mock("@/hooks/useFeatureFlag", () => ({
  useLlmFeaturesFlag: () => false,
}));

// NavBar treats children as an array (children[0], children.slice(1)).
function renderNav() {
  return render(<NavBar>{[<div key="a" />, <div key="b" />]}</NavBar>);
}

function renderedHrefs() {
  return Array.from(document.querySelectorAll("a")).map((a) =>
    a.getAttribute("href")
  );
}

describe("NavBar", () => {
  // Covers the desktop nav only: the mobile sheet's contents live in a Radix
  // portal that mounts on open, so they are absent from the DOM here.
  it("offers signed-out visitors the guide and no route that needs auth", () => {
    global.__setClerkAuthState("signed-out");
    renderNav();

    const hrefs = renderedHrefs();
    expect(hrefs).toContain("/guide");
    for (const authOnly of ["/dashboard", "/games", "/insights"]) {
      expect(hrefs).not.toContain(authOnly);
    }
  });

  it("offers signed-in users the app routes", () => {
    global.__setClerkAuthState("signed-in");
    renderNav();

    const hrefs = renderedHrefs();
    expect(hrefs).toContain("/dashboard");
    expect(hrefs).toContain("/games");
  });
});
