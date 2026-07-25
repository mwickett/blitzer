import type { Metadata } from "next";
import { Hero } from "@/components/marketing/Hero";
import { GatherSection } from "@/components/marketing/GatherSection";
import { PlaySection } from "@/components/marketing/PlaySection";
import { SettleSection } from "@/components/marketing/SettleSection";
import { RememberSection } from "@/components/marketing/RememberSection";
import { QuoteSection } from "@/components/marketing/QuoteSection";
import { GuideTeaser } from "@/components/marketing/GuideTeaser";
import { FinalCta } from "@/components/marketing/FinalCta";

export const metadata: Metadata = {
  title: "Blitzer — scoring and stats for Dutch Blitz",
  description:
    "Blitzer runs the scoring for your Dutch Blitz table — live standings, real win odds, and a permanent record of who's actually best.",
};

/**
 * The section order is chronological — gather, play, settle, remember — so the
 * page follows the shape of an actual game night and each feature appears at
 * the moment it matters.
 */
export default function Home() {
  return (
    <main className="flex min-h-screen flex-col bg-brand">
      <Hero />
      <GatherSection />
      <PlaySection />
      <SettleSection />
      <RememberSection />
      <QuoteSection />
      <GuideTeaser />
      <FinalCta />
    </main>
  );
}
