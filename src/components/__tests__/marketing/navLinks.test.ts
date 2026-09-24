import {
  SIGNED_OUT_LINKS,
  signedInLinks,
} from "@/components/marketing/navLinks";

describe("navLinks", () => {
  it("offers signed-out visitors the guide and nothing that needs auth", () => {
    expect(SIGNED_OUT_LINKS).toEqual([{ label: "Guide", href: "/guide" }]);
  });

  it("never exposes app routes to signed-out visitors", () => {
    const hrefs = SIGNED_OUT_LINKS.map((l) => l.href);
    for (const authOnly of ["/dashboard", "/games", "/insights"]) {
      expect(hrefs).not.toContain(authOnly);
    }
  });

  it("gives signed-in users the app routes", () => {
    const hrefs = signedInLinks(false).map((l) => l.href);
    expect(hrefs).toEqual(["/dashboard", "/games", "/guide"]);
  });

  it("adds Insights only when the llm-features flag is on", () => {
    expect(signedInLinks(false).map((l) => l.href)).not.toContain("/insights");
    expect(signedInLinks(true).map((l) => l.href)).toContain("/insights");
  });
});
