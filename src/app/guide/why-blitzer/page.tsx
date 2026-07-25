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
          and a pen is more than enough, and any app that wants to replace them
          has a higher bar to clear than it first appears. Paper never loses
          your data, never needs a signal, and never makes you wait.
        </p>
        <p>
          But paper does not capture the whole story. The patterns you start to
          notice after playing a lot of Dutch Blitz are the interesting part,
          and the more you play the more intriguing they get. You feel them
          while you are playing — you just cannot do anything with them at the
          time.
        </p>
        <p>
          That is because Dutch Blitz forces you to be in the moment. You cannot
          play well and be thinking about anything else. It is one of the best
          things about the game, and it is exactly why the reflection has to
          happen afterwards.
        </p>

        <h2>The questions</h2>
        <p>
          So: how did that game actually go? How have you changed as a player?
          Who really has the better record against whom? What is the longest
          game you have ever been part of?
        </p>
        <p>
          None of that is answerable unless somebody wrote the rounds down in a
          form that still means something six months later. Capturing the data
          is the job Blitzer took first. What it can answer today is a shorter
          list than the one above, and it is written out in{" "}
          <Link href="/guide/reading-your-stats">Reading your stats</Link>.
        </p>

        <h2>The bar</h2>
        <p>
          Which brings it back to the paper problem. Score entry has to be
          faster than a pen, mistakes have to be fixable, and a score must never
          be lost for a technical reason. If it is not lower friction than the
          thing it replaces, nobody uses it long enough to accumulate the
          history that made it worth building.
        </p>
        <p>
          That is why so much of the work has gone into the scoring screen
          rather than the charts. The charts are the reward; the scoring screen
          is the rent.
        </p>

        <h2>Where it is now</h2>
        <p>
          Today Blitzer scores a game round by round, shows live standings and
          real win odds while you play, keeps your group&apos;s games together
          in a{" "}
          <Link href="/guide/circles-and-pickup-games">Circle</Link>, and builds
          up your own stats over time. There is a great deal more that could be
          answered with this data than currently is. That is the fun part still
          ahead.
        </p>
      </Prose>
    </>
  );
}
