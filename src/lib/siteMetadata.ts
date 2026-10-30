import type { Metadata } from "next";

export const SITE_URL = "https://www.blitzer.fun";

export const OG_IMAGE = {
  url: "/img/og-image.png",
  width: 1200,
  height: 630,
  alt: "Blitzer",
};

const TWITTER_IMAGE = { url: "/img/twitter-image.png", alt: "Blitzer" };

/**
 * Next replaces a parent's `openGraph` and `twitter` objects rather than
 * merging them, and the root layout's og:url points at the home page. A page
 * that only sets `title` and `description` therefore shares as the home page.
 * Public pages build their metadata here so the share tags follow the page.
 */
export function pageMetadata({
  title,
  description,
  path,
}: {
  title: string;
  description: string;
  path: string;
}): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      locale: "en_US",
      siteName: "Blitzer",
      url: path,
      title,
      description,
      images: [OG_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      site: "@blitzerfun",
      creator: "@mwickett",
      title,
      description,
      images: [TWITTER_IMAGE],
    },
  };
}
