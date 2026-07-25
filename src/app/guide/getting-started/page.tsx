import type { Metadata } from "next";
import Link from "next/link";
import { Prose, GuidePageHeader } from "@/components/marketing/Prose";
import { MAX_PICKUP_PLAYERS } from "@/lib/lobbies";

export const metadata: Metadata = {
  title: "Getting started — Blitzer guide",
  description:
    "Run your first Dutch Blitz game in Blitzer: set up the table, enter scores round by round, and finish the game.",
};

export default function GettingStarted() {
  return (
    <>
      <GuidePageHeader
        title="Getting started"
        intro="Your first game, from opening the app to a final score. About two minutes of setup, most of it choosing colours."
      />

      <Prose>
        <h2>1. Pick how you are playing</h2>
        <p>
          When you start a new game, Blitzer asks whether it is a pickup game or
          a Circle game. If tonight is a one-off, or you are playing with people
          who are not in a group with you, choose pickup. If you play with the
          same crew regularly, a Circle keeps all your games together — see{" "}
          <Link href="/guide/circles-and-pickup-games">
            Circles &amp; pickup games
          </Link>
          .
        </p>

        <h2>2. Get everyone in</h2>
        <p>
          A pickup game opens a lobby with a QR code and a short join code. Show
          the screen; anyone who scans it or types the code signs in and joins
          the game on their own phone. Joining does not add them to your Circle.
          You can seat up to {MAX_PICKUP_PLAYERS} players.
        </p>
        <p>
          Playing with someone who does not want an account? Add them as a guest
          by name. They are scored exactly like everyone else — they just cannot
          open the game on their own device.
        </p>
        <p>
          Lobby codes expire twelve hours after the lobby is created, so an old
          screenshot cannot pull someone into a game that finished last week.
        </p>

        <h2>3. Choose colours</h2>
        <p>
          Each player gets a colour, which is how they are identified in the
          standings, the race track and every chart. In a Circle game, whoever
          sets it up picks colours for everyone on one screen before play
          starts; if they put two players on the same colour, the one who had
          it moves to the next free one. In a pickup game, Blitzer assigns
          colours automatically as people join.
        </p>
        <p>
          There are six colours, so a seven- or eight-player game runs out and
          one or two colours get used twice. Everything still scores correctly;
          you just have to look at the names rather than the colours.
        </p>

        <h2>4. Score each round</h2>
        <p>Once a round finishes, each player needs two numbers:</p>
        <ul>
          <li>
            <strong>Blitz pile remaining</strong> — how many cards were left in
            their Blitz pile when someone called Blitz.
          </li>
          <li>
            <strong>Cards played</strong> — how many of their cards ended up on
            the Dutch piles in the middle.
          </li>
        </ul>
        <p>
          Blitzer does the arithmetic. If you want to know exactly what it is
          doing, that is in{" "}
          <Link href="/guide/how-scoring-works">How scoring works</Link>.
        </p>
        <p>
          Entered something wrong? Rounds can be edited after the fact and
          everything downstream recalculates — you do not need to start over.
        </p>

        <h2>5. Finish the game</h2>
        <p>
          The game ends when someone crosses the win threshold, which is 75 by
          default. Blitzer marks the winner and writes the result to your
          history.
        </p>
        <p>
          Every finished game gets its own page that anyone can open with the
          link, whether or not they use Blitzer. It is the easiest way to settle
          an argument in the group chat the next morning.
        </p>
      </Prose>
    </>
  );
}
