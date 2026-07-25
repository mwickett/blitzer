import { Section } from "./Section";
import { StartGameCta, MarketingCta } from "./MarketingCta";

export function FinalCta() {
  return (
    <Section ground="espresso" className="text-center">
      <h2 className="font-display text-4xl font-bold text-brand md:text-5xl">
        Get the table started
      </h2>
      <p className="mx-auto mt-4 max-w-md text-base text-[#c9b0a7]">
        Free. Takes about as long as shuffling.
      </p>
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <StartGameCta section="final_cta" variant="inverse" />
        <MarketingCta
          section="final_cta"
          href="/guide"
          variant="inverseGhost"
        >
          Read the guide
        </MarketingCta>
      </div>
    </Section>
  );
}
