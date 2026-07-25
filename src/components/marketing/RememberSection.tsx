import { Section, SectionEyebrow } from "./Section";
import { StatTile } from "./StatTile";
import { ScoreProgressionCard } from "@/components/scoring/graphs/ScoreProgressionCard";
import {
  DEMO_PLAYERS,
  DEMO_SCORES_BY_ROUND,
  DEMO_WIN_THRESHOLD,
} from "./fixtures";

/**
 * Copy constraint: Circles today only scope which games you can see. There is
 * no circle leaderboard, head-to-head record, or group stat of any kind —
 * every function in server/queries/stats.ts filters by userId alone. This
 * section may claim shared history and shareable results, nothing more.
 * See GitHub #274. RememberSection.test.tsx enforces this.
 */
export function RememberSection() {
  return (
    <Section ground="white">
      <div className="grid items-center gap-10 md:grid-cols-2 md:gap-14">
        <div>
          {/*
            Both tiles must correspond to something DashboardStats actually
            returns (batting average, score extremes, cumulative score, game
            round extremes). "Games won" was here once and is not computed
            anywhere — do not reintroduce a stat the product cannot show.
          */}
          <div className="mb-3 grid grid-cols-2 gap-3">
            <StatTile label="Batting average" value=".412" />
            <StatTile label="Rounds played" value="312" />
          </div>
          <ScoreProgressionCard
            players={DEMO_PLAYERS}
            scoresByRound={DEMO_SCORES_BY_ROUND}
            winThreshold={DEMO_WIN_THRESHOLD}
          />
        </div>

        <div>
          <SectionEyebrow>4 · Remember</SectionEyebrow>
          <h2 className="font-display text-4xl font-bold leading-[1.08] tracking-[-0.018em] text-brandAccent">
            The record keeps itself
          </h2>
          <p className="mt-4 text-base leading-relaxed text-textBody">
            Every game your group plays lands in your Circle, so the record is
            all in one place instead of scattered across whoever remembered to
            write it down.
          </p>
          <p className="mt-3 text-base leading-relaxed text-textBody">
            Every finished game also gets a link anyone can open. No account, no
            app, just send it to the group chat.
          </p>
        </div>
      </div>
    </Section>
  );
}
