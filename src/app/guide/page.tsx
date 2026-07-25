import type { Metadata } from "next";
import Link from "next/link";
import { Prose, GuidePageHeader } from "@/components/marketing/Prose";

export const metadata: Metadata = {
  title: "Guide — Blitzer",
  description:
    "How to use Blitzer: starting a game, entering scores, Circles and pickup games, and what the stats mean.",
};

const TOPICS = [
  {
    href: "/guide/getting-started",
    title: "Getting started",
    blurb: "Your first game, from opening the app to a final score.",
  },
  {
    href: "/guide/how-scoring-works",
    title: "How scoring works",
    blurb: "The Dutch Blitz maths, and what Blitzer does with it.",
  },
  {
    href: "/guide/circles-and-pickup-games",
    title: "Circles & pickup games",
    blurb: "Two ways to play. Which one you want depends on how often.",
  },
  {
    href: "/guide/reading-your-stats",
    title: "Reading your stats",
    blurb: "Batting average, win odds, and the charts during a game.",
  },
  {
    href: "/guide/why-blitzer",
    title: "Why Blitzer",
    blurb: "Why this exists at all.",
  },
];

const FAQ = [
  {
    q: "Do all the players need an account?",
    a: "Anyone joining from their own phone does. They sign in as they scan the code, and it is free. If someone would rather not make one, the host can add them as a guest instead. Guests are scored exactly like everyone else; they just cannot open the game themselves.",
  },
  {
    q: "How many people can play?",
    a: "Up to eight, which is what the Dutch Blitz expansion packs seat.",
  },
  {
    q: "Can I fix a score I entered wrong?",
    a: "Yes. You can edit a round after it is recorded, and the standings and charts recalculate.",
  },
  {
    q: "Does a pickup game code expire?",
    a: "Yes, after twelve hours. A pickup lobby is meant for one sitting, so a screenshot of the code forwarded weeks later will not add anyone to a game nobody is at.",
  },
  {
    q: "Can I share the result with people who do not use Blitzer?",
    a: "Yes. Every finished game has a page anyone can open with the link. No account needed.",
  },
  {
    q: "Is this made by Dutch Blitz?",
    a: "No. Blitzer is an unofficial companion app and is not affiliated with, endorsed by, or sponsored by Dutch Blitz Games Company.",
  },
];

export default function GuideHub() {
  return (
    <>
      <GuidePageHeader
        title="Using Blitzer"
        intro="How to run a game night, enter scores, and make sense of the numbers afterwards."
      />

      <div className="grid gap-3 sm:grid-cols-2">
        {TOPICS.map((topic) => (
          <Link
            key={topic.href}
            href={topic.href}
            className="rounded-xl border-[1.5px] border-borderWarm bg-surfaceRaised p-4 transition-colors hover:border-brandAccent"
          >
            <h2 className="font-display text-base font-bold tracking-[-0.018em] text-brandAccent">
              {topic.title}
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-textBody">
              {topic.blurb}
            </p>
          </Link>
        ))}
      </div>

      <Prose className="mt-12">
        <h2>Common questions</h2>
        <dl>
          {FAQ.map((item) => (
            <div key={item.q} className="mb-5">
              <dt className="font-semibold text-brandAccent">{item.q}</dt>
              <dd className="mt-1">{item.a}</dd>
            </div>
          ))}
        </dl>
      </Prose>
    </>
  );
}
