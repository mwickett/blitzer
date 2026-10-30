import { pageMetadata } from "@/lib/siteMetadata";
import { Hero } from "@/components/marketing/Hero";
import { GatherSection } from "@/components/marketing/GatherSection";
import { PlaySection } from "@/components/marketing/PlaySection";
import { SettleSection } from "@/components/marketing/SettleSection";
import { RememberSection } from "@/components/marketing/RememberSection";
import { QuoteSection } from "@/components/marketing/QuoteSection";
import { GuideTeaser } from "@/components/marketing/GuideTeaser";
import { FinalCta } from "@/components/marketing/FinalCta";

export const metadata = pageMetadata({
  title: "Blitzer — scoring and stats for Dutch Blitz",
  description:
    "Nobody has to do the math. Blitzer does the Dutch Blitz minus-twos, keeps the totals, and tells you who's actually going to win.",
  path: "/",
});

/**
 * The section order is chronological — gather, play, settle, remember — so the
 * page follows the shape of an actual game night and each feature appears at
 * the moment it matters.
 */
export default function Home() {
  return (
    // A <div>, not a <main>: NavBar.tsx:164 already provides the document's
    // one <main>. The outgoing page nested a second one; this does not.
    <div className="flex min-h-svh flex-col bg-brand">
      <Hero />
      <GatherSection />
      <PlaySection />
      <SettleSection />
      <RememberSection />
      <QuoteSection />
      <GuideTeaser />
      <FinalCta />
    </div>
  );
}
