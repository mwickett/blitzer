import type { Metadata } from "next";
import Link from "next/link";
import { Prose, GuidePageHeader } from "@/components/marketing/Prose";

export const metadata: Metadata = {
  title: "How Dutch Blitz scoring works — Blitzer guide",
  description:
    "Dutch Blitz scoring explained: cards played minus twice your remaining Blitz pile, and how Blitzer tracks it round by round.",
};

export default function HowScoringWorks() {
  return (
    <>
      <GuidePageHeader
        title="How scoring works"
        intro="The whole of Dutch Blitz scoring is one line of arithmetic. It is the consequences that are interesting."
      />

      <Prose>
        <h2>The formula</h2>
        <p>
          At the end of a round, each player scores the number of their cards
          that made it onto the Dutch piles in the middle, minus twice the
          number of cards still sitting in their Blitz pile.
        </p>
        <p>
          <strong>Score = cards played − (2 × blitz pile remaining)</strong>
        </p>
        <p>
          Emptying your Blitz pile is what ends the round, so whoever calls
          Blitz subtracts nothing. Everyone else pays two points for every card
          they did not get rid of.
        </p>

        <h2>Why it stings</h2>
        <p>
          The doubled penalty is the whole game. Playing lots of cards into the
          middle feels productive, but if you have been feeding the Dutch piles
          while your own Blitz pile sits untouched, you can finish a round with
          a negative score — and negative rounds are common enough that Blitzer
          shows them in red.
        </p>
        <p>
          It is why a round can swing the standings much harder than it looks
          like it should, and why the win odds during a game are not simply a
          function of who is ahead.
        </p>

        <h2>Worked example</h2>
        <p>Say a round ends and three players report:</p>
        <ul>
          <li>
            Dana called Blitz — 14 cards played, 0 left in her Blitz pile.
            14 − (2 × 0) = <strong>14</strong>.
          </li>
          <li>
            Mike — 11 cards played, 2 left. 11 − (2 × 2) ={" "}
            <strong>7</strong>.
          </li>
          <li>
            Priya — 6 cards played, 7 left. 6 − (2 × 7) ={" "}
            <strong>−8</strong>.
          </li>
        </ul>
        <p>
          Priya played more than half a dozen cards and still went backwards.
          That is normal.
        </p>

        <h2>Winning</h2>
        <p>
          Rounds keep going until someone crosses the win threshold — 75 by
          default. Because a strong round is worth double digits, a game is
          rarely as settled as the standings suggest, which is what the{" "}
          <Link href="/guide/reading-your-stats">win odds</Link> are for.
        </p>

        <h2>A small piece of trivia</h2>
        <p>
          Dutch Blitz was reportedly created in part to help teach the
          designer&apos;s children arithmetic. Whether or not that is the whole
          story, you can see it in the scoring: the doubling is exactly the kind
          of mental sum that is easy to state and annoying to do forty times an
          evening. Blitzer does it so you can keep playing.
        </p>
      </Prose>
    </>
  );
}
