import type { Metadata } from "next";
import Link from "next/link";
import { Prose, GuidePageHeader } from "@/components/marketing/Prose";

export const metadata: Metadata = {
  title: "Why Blitzer — Blitzer guide",
  description:
    "Why a scorekeeping app for Dutch Blitz exists at all, written by the person who built it.",
};

export default function WhyBlitzer() {
  return (
    <>
      <GuidePageHeader
        title="Why Blitzer"
        intro="Why a scorekeeping app for a card game exists at all."
      />

      <Prose>
        <p>
          Keeping score for Dutch Blitz is genuinely simple. A sheet of paper
          and a pen is more than enough, and replacing them is harder than it
          looks. Paper never loses your data, never needs a signal, and never
          makes you wait.
        </p>
        <p>
          But paper only holds one night. The patterns you start to notice after
          playing a lot of Dutch Blitz are the interesting part, and there are
          more of them the longer you play. You feel them while you&apos;re
          playing. You just can&apos;t do anything with them at the time.
        </p>
        <p>
          That&apos;s because Dutch Blitz forces you to be in the moment. You
          can&apos;t play well and be thinking about anything else. It&apos;s
          one of the best things about the game, and it&apos;s why the
          reflection has to happen afterwards.
        </p>

        <h2>The questions</h2>
        <p>
          How did that game actually go? How have you changed as a player? Who
          really has the better record against whom? What&apos;s the longest
          game you&apos;ve ever been part of?
        </p>
        <p>
          None of that is answerable unless somebody wrote the rounds down in a
          form that still means something six months later. Capturing the data
          is the job Blitzer took first. What it can answer today is a shorter
          list than the one above, and it&apos;s written out in{" "}
          <Link href="/guide/reading-your-stats">Reading your stats</Link>.
        </p>

        <h2>The bar</h2>
        <p>
          Score entry has to be faster than a pen, mistakes have to be fixable,
          and a score must never be lost for a technical reason. If it
          isn&apos;t lower friction than the thing it replaces, nobody uses it
          long enough to accumulate the history that made it worth building.
        </p>
        <p>
          That&apos;s why so much of the work has gone into the scoring screen
          rather than the charts. The charts are the reward; the scoring screen
          is the rent.
        </p>

        <h2>Where it is now</h2>
        <p>
          Today Blitzer scores a game round by round, shows live standings and
          real win odds while you play, keeps your group&apos;s games together
          in a{" "}
          <Link href="/guide/circles-and-pickup-games">Circle</Link>, and builds
          up your own stats over time. There&apos;s a lot more this data could
          answer than it does today. That&apos;s the fun part still ahead.
        </p>
      </Prose>
    </>
  );
}
