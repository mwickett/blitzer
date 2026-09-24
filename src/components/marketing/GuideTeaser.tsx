import Link from "next/link";
import { Section, SectionEyebrow } from "./Section";

const CARDS = [
  {
    href: "/guide/how-scoring-works",
    title: "How scoring works",
    blurb:
      "Cards played, minus twice your Blitz pile. Why the maths is the way it is.",
  },
  {
    href: "/guide/circles-and-pickup-games",
    title: "Circles vs pickup games",
    blurb:
      "One is for tonight. One is for the next three years of Thursdays.",
  },
  {
    href: "/guide/reading-your-stats",
    title: "Reading your stats",
    blurb:
      "What batting average means here, and where the odds come from.",
  },
];

export function GuideTeaser() {
  return (
    <Section ground="white">
      <SectionEyebrow>The guide</SectionEyebrow>
      <h2 className="font-display text-3xl font-bold tracking-[-0.018em] text-brandAccent">
        Start here if you&apos;re new to any of this
      </h2>

      <div className="mt-6 grid gap-3 md:grid-cols-3">
        {CARDS.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="rounded-xl border-[1.5px] border-borderWarm bg-surfaceRaised p-4 transition-colors hover:border-brandAccent"
          >
            <h3 className="font-display text-base font-bold tracking-[-0.018em] text-brandAccent">
              {card.title}
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed text-textBody">
              {card.blurb}
            </p>
            <span className="mt-3 inline-block text-[13px] font-semibold text-brandAccent">
              Read →
            </span>
          </Link>
        ))}
      </div>
    </Section>
  );
}
