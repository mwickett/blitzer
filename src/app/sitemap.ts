import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/siteMetadata";

/** The signed-out pages. Game pages are shared by link, not listed. */
const PUBLIC_PATHS = [
  "/",
  "/guide",
  "/guide/getting-started",
  "/guide/how-scoring-works",
  "/guide/circles-and-pickup-games",
  "/guide/reading-your-stats",
  "/guide/why-blitzer",
  "/privacy",
  "/terms",
];

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_PATHS.map((path) => ({ url: `${SITE_URL}${path}` }));
}
