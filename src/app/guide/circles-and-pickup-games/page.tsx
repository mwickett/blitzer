import type { Metadata } from "next";
import Link from "next/link";
import { Prose, GuidePageHeader } from "@/components/marketing/Prose";
import { MAX_PICKUP_PLAYERS } from "@/lib/lobbies";

export const metadata: Metadata = {
  title: "Circles & pickup games — Blitzer guide",
  description:
    "The difference between a pickup game and a Circle in Blitzer, and which one to use.",
};

export default function CirclesAndPickupGames() {
  return (
    <>
      <GuidePageHeader
        title="Circles & pickup games"
        intro="Two ways to start a game. The difference is whether tonight is a one-off or part of something ongoing."
      />

      <Prose>
        <h2>Pickup games</h2>
        <p>
          A pickup game is for right now. You open a lobby, everyone at the
          table joins with a code or a QR scan, and you play. There is no Circle
          to create and nobody to invite in advance. You can seat up to{" "}
          {MAX_PICKUP_PLAYERS} players.
        </p>
        <p>
          Players joining from their own phone sign in as they come through. It
          is free, and it does not put them in any of your Circles. Add anyone
          who would rather not make an account as a guest instead.
        </p>
        <p>Use one when:</p>
        <ul>
          <li>You are playing with people you do not usually play with.</li>
          <li>Somebody at the table will never make an account.</li>
          <li>You just want to start without setting anything up.</li>
        </ul>
        <p>
          The lobby code stops working twelve hours after you create it, since a
          pickup lobby is meant for a single sitting.
        </p>

        <h2>Circles</h2>
        <p>
          A Circle is your regular group. Everyone in it can see the games
          played within it, so your history lives in one place instead of being
          scattered across whoever happened to open the app that night.
        </p>
        <p>Use one when:</p>
        <ul>
          <li>You play with roughly the same people repeatedly.</li>
          <li>
            You want the games you played months ago to still be somewhere
            sensible.
          </li>
          <li>You want everyone in the group to see the same history.</li>
        </ul>
        <p>
          You can belong to more than one Circle. The family one and the
          Thursday one do not have to be the same group, and you switch between
          them from the header.
        </p>

        <h2>Guests</h2>
        <p>
          Either mode supports guests: players you add by name who do not have
          accounts. They are scored normally and appear in the standings and
          charts like anyone else. They just cannot open the game on their own
          phone, so someone else enters their numbers.
        </p>

        <h2>Which should I use?</h2>
        <p>
          If you are hesitating, start with a pickup game. It takes no setup,
          and you can create a Circle later, once it is clear the group is a
          regular thing.
        </p>
        <p>
          Either way your{" "}
          <Link href="/guide/reading-your-stats">stats</Link> count every round
          you play. Pickup games and Circle games are pooled together.
        </p>
      </Prose>
    </>
  );
}
