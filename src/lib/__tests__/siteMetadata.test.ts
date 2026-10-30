import { pageMetadata } from "@/lib/siteMetadata";
import sitemap from "@/app/sitemap";
import { metadata as scoringGuide } from "@/app/guide/how-scoring-works/page";

describe("pageMetadata", () => {
  it("points a page's share tags at that page, not the home page", () => {
    const meta = pageMetadata({
      title: "How scoring works",
      description: "The formula.",
      path: "/guide/how-scoring-works",
    });

    expect(meta.alternates?.canonical).toBe("/guide/how-scoring-works");
    expect(meta.openGraph).toMatchObject({
      url: "/guide/how-scoring-works",
      title: "How scoring works",
      description: "The formula.",
    });
    expect(meta.twitter).toMatchObject({
      title: "How scoring works",
      description: "The formula.",
    });
    // Next replaces the parent's openGraph object, so the image must be
    // carried here or the preview loses it.
    expect(meta.openGraph?.images).toBeTruthy();
  });

  it("is what the guide pages export", () => {
    expect(scoringGuide.openGraph).toMatchObject({
      url: "/guide/how-scoring-works",
    });
  });
});

describe("sitemap", () => {
  it("lists the public pages with absolute URLs", () => {
    const urls = sitemap().map((entry) => entry.url);
    expect(urls).toContain("https://www.blitzer.fun/");
    expect(urls).toContain("https://www.blitzer.fun/guide/how-scoring-works");
    expect(urls.some((url) => url.includes("/dashboard"))).toBe(false);
  });
});
