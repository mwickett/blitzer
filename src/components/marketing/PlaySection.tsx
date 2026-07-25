import { Section, SectionEyebrow } from "./Section";
import { ScoreEntryPreview } from "./ScoreEntryPreview";
import { Standings } from "@/components/scoring/Standings";
import { DEMO_PLAYERS, DEMO_WIN_THRESHOLD } from "./fixtures";

export function PlaySection() {
  return (
    <Section ground="cream">
      <div className="grid items-center gap-10 md:grid-cols-2 md:gap-14">
        <div className="order-2 rounded-xl border-[1.5px] border-borderWarm bg-surfaceRaised p-4 md:order-1">
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Phone frame — the scoring UI is designed thumb-first, so show it
                at the width it is actually used at. */}
            <div className="mx-auto w-[200px] rounded-[22px] border-[2.5px] border-brandAccent p-2">
              <div className="mx-auto mb-2 h-1 w-12 rounded-full bg-[#d1bfa8]" />
              <ScoreEntryPreview />
            </div>

            <div>
              <div className="mb-2 flex justify-between px-4 text-xs font-medium text-textMuted">
                <span>Standings</span>
                <span>after R4</span>
              </div>
              <Standings
                players={DEMO_PLAYERS}
                winThreshold={DEMO_WIN_THRESHOLD}
              />
            </div>
          </div>
        </div>

        <div className="order-1 md:order-2">
          <SectionEyebrow>2 · Play</SectionEyebrow>
          <h2 className="font-display text-4xl font-bold leading-[1.08] text-brandAccent">
            Lower friction than pen and paper. That&apos;s a higher bar than it
            sounds.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-textBody">
            Built thumb-first for a phone propped against the card box. Enter
            the blitz pile and cards played; the standings redraw before the
            next deal.
          </p>
        </div>
      </div>
    </Section>
  );
}
