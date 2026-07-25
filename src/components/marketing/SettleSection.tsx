import { Section, SectionEyebrow } from "./Section";
import { WinProbabilityDemo } from "./WinProbabilityDemo";

export function SettleSection() {
  return (
    <Section ground="espresso">
      <div className="grid items-center gap-10 md:grid-cols-2 md:gap-14">
        <div>
          <SectionEyebrow tone="dark">3 · Settle it</SectionEyebrow>
          <h2 className="font-display text-4xl font-bold leading-[1.08] tracking-[-0.018em] text-brand">
            Real odds.
            <br />
            Not vibes.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-[#c9b0a7]">
            Blitzer simulates thousands of finishes from how your table has
            actually been scoring tonight. So &ldquo;she&apos;s got this&rdquo;
            stops being an opinion and becomes a number everyone can see.
          </p>
        </div>

        <WinProbabilityDemo />
      </div>
    </Section>
  );
}
