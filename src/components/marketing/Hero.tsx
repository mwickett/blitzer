import Image from "next/image";
import { StartGameCta, MarketingCta } from "./MarketingCta";
import { ScoreEntryPreview } from "./ScoreEntryPreview";
import { FactsRow } from "./FactsRow";

export function Hero() {
  return (
    <section className="border-b-[1.5px] border-borderWarm bg-brand px-6 py-14 md:py-20">
      <div className="mx-auto grid max-w-5xl items-center gap-12 md:grid-cols-[1.15fr_1fr] md:gap-14">
        <div className="text-center md:text-left">
          <Image
            src="/img/blitzer-logo.png"
            width={300}
            height={300}
            alt="Blitzer logo — line drawing of a windmill with hearts"
            priority
            className="mx-auto mb-6 h-auto w-[84px] md:mx-0 md:w-[100px]"
          />

          <h1 className="font-display text-5xl font-bold leading-[1.02] tracking-[-0.018em] text-brandAccent md:text-6xl">
            Keep score.
            <br />
            Settle scores.
          </h1>

          <p className="mt-5 font-display text-2xl font-semibold tracking-[-0.018em] text-brandAccent">
            Nobody has to do the math.
          </p>
          <p className="mx-auto mt-3 max-w-xl text-[17px] leading-relaxed text-textBody md:mx-0">
            Punch in everyone&apos;s Blitz pile and cards played. Blitzer does
            the minus-twos, keeps the totals, and tells you who&apos;s actually
            going to win.
          </p>

          {/* A stacked grid on phones so both buttons are the same width. */}
          <div className="mt-7 grid gap-3 sm:flex sm:flex-wrap sm:justify-center md:justify-start">
            <StartGameCta section="hero" />
            <MarketingCta section="hero" href="/guide" variant="ghost">
              See how it works →
            </MarketingCta>
          </div>

          <FactsRow className="mt-7 justify-center md:justify-start" />
        </div>

        {/* Phone frame — the scoring UI is designed thumb-first, so show it
            at the width it is actually used at. */}
        <div className="mx-auto w-[240px] rounded-[26px] border-[2.5px] border-brandAccent bg-surfaceRaised p-2.5">
          <div className="mx-auto mb-2 h-1 w-12 rounded-full bg-[#d1bfa8]" />
          <ScoreEntryPreview />
        </div>
      </div>
    </section>
  );
}
