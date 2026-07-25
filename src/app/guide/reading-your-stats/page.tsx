import type { Metadata } from "next";
import { Prose, GuidePageHeader } from "@/components/marketing/Prose";
import { WinProbabilityDemo } from "@/components/marketing/WinProbabilityDemo";

export const metadata: Metadata = {
  title: "Reading your stats — Blitzer guide",
  description:
    "What batting average means in Blitzer, how the in-game win odds are calculated, and what the charts show.",
};

export default function ReadingYourStats() {
  return (
    <>
      <GuidePageHeader
        title="Reading your stats"
        intro="What the numbers mean, and what they do not mean."
      />

      <Prose>
        <h2>Batting average</h2>
        <p>
          Your batting average is the share of rounds in which you emptied your
          Blitz pile — where you were the one who called Blitz. Rounds blitzed,
          divided by rounds played.
        </p>
        <p>
          It is not the share of rounds you outscored everyone. Those are
          different things: you can take the highest score in a round without
          blitzing, and you can blitz in a round where someone else scores more.
          Batting average measures the specific thing the game is named after.
        </p>
        <p>
          It counts every round you have ever played, across every Circle and
          every pickup game, pooled together. It is not scoped to the Circle you
          are currently looking at.
        </p>

        <h2>Win odds during a game</h2>
        <p>
          Mid-game, Blitzer estimates each player&apos;s chance of winning by
          simulating the rest of the game thousands of times, using how this
          table has actually been scoring tonight rather than a generic
          assumption. It normally needs three rounds before it has enough to go
          on. If it can lean on how the players have scored in earlier finished
          games, it can start sooner.
        </p>
      </Prose>

      <div className="my-8">
        <WinProbabilityDemo />
      </div>

      <Prose>
        <p>
          Because the simulation is driven by observed round scores, a player
          who has been quietly posting big rounds can hold better odds than
          someone a few points ahead of them. That is the point of it — the
          standings tell you who is ahead, the odds tell you who is winning.
        </p>

        <h2>The charts</h2>
        <h3>Score progression</h3>
        <p>
          Cumulative score per player across the rounds played so far. Useful
          for spotting the round where a game turned.
        </p>
        <h3>Hot &amp; cold</h3>
        <p>
          Each player&apos;s per-round scores as an intensity grid, so you can
          see streaks rather than totals. Each player&apos;s best round is
          marked, unless none of their rounds gained them points.
        </p>
        <h3>Race track</h3>
        <p>
          Where everyone sits relative to the win threshold. When players are
          close together their markers group so the track stays readable.
        </p>

        <h2>High and low single hand</h2>
        <p>
          Your best and worst single-round scores. The worst one is usually the
          more interesting number, and is usually the result of feeding the
          Dutch piles while ignoring your own Blitz pile.
        </p>
      </Prose>
    </>
  );
}
