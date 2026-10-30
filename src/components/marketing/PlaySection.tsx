import { Section, SectionEyebrow } from "./Section";
import { Standings } from "@/components/scoring/Standings";
import { DEMO_PLAYERS, DEMO_WIN_THRESHOLD } from "./fixtures";

export function PlaySection() {
  return (
    <Section ground="cream">
      <div className="grid items-center gap-10 md:grid-cols-2 md:gap-14">
        <div className="order-2 rounded-xl border-[1.5px] border-borderWarm bg-surfaceRaised p-4 md:order-1">
          {/* The hero's phone shows round 4 being keyed in; this is the
              table right after it is saved. */}
          <div className="mb-2 flex justify-between px-4 text-xs font-medium text-textMuted">
            <span>Standings</span>
            <span>after R4</span>
          </div>
          <Standings players={DEMO_PLAYERS} winThreshold={DEMO_WIN_THRESHOLD} />
        </div>

        <div className="order-1 md:order-2">
          <SectionEyebrow>2 · Play</SectionEyebrow>
          <h2 className="font-display text-4xl font-bold leading-[1.08] tracking-[-0.018em] text-brandAccent">
            Faster than the pencil.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-textBody">
            Built thumb-first for a phone propped against the card box. Whoever
            has a phone out punches in the round for the table, and the
            standings redraw before the next deal. Typo? Fix the round and
            every total after it follows.
          </p>
        </div>
      </div>
    </Section>
  );
}
