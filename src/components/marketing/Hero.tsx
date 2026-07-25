import Image from "next/image";
import { RaceTrack } from "@/components/scoring/RaceTrack";
import { StartGameCta, MarketingCta } from "./MarketingCta";
import { DEMO_PLAYERS, DEMO_WIN_THRESHOLD } from "./fixtures";

export function Hero() {
  return (
    <section className="border-b-[1.5px] border-borderWarm bg-brand px-6 py-16 md:py-20">
      <div className="mx-auto max-w-4xl text-center">
        <Image
          src="/img/blitzer-logo.png"
          width={300}
          height={300}
          alt="Blitzer logo — line drawing of a windmill with hearts"
          priority
          className="mx-auto mb-8 h-auto w-[140px] md:w-[170px]"
        />

        <h1 className="font-display text-5xl font-bold leading-[1.02] tracking-[-0.018em] text-brandAccent md:text-6xl">
          Keep score.
          <br />
          Settle scores.
        </h1>

        <p className="mx-auto mt-5 max-w-xl text-[17px] leading-relaxed text-textBody">
          Blitzer runs the scoring for your Dutch Blitz table — live standings,
          real win odds, and a permanent record of who&apos;s actually best.
        </p>

        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <StartGameCta section="hero" />
          <MarketingCta section="hero" href="/guide" variant="ghost">
            See how it works →
          </MarketingCta>
        </div>

        <div className="mt-12 rounded-xl border-[1.5px] border-borderWarm bg-surfaceRaised p-4 text-left">
          {/*
            Only the left-hand label. RaceTrack renders its own header row with
            the floor score and "{winThreshold} to win" (RaceTrack.tsx:37-40),
            so repeating the threshold here would print it twice in one panel.
          */}
          <div className="mb-2 text-xs font-medium text-textMuted">
            Round 4 · Thursday night
          </div>
          <RaceTrack
            players={DEMO_PLAYERS}
            winThreshold={DEMO_WIN_THRESHOLD}
          />
        </div>
      </div>
    </section>
  );
}
