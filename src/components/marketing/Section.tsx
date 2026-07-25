import { cn } from "@/lib/utils";

const GROUNDS = {
  cream: "bg-brand text-brandAccent border-borderWarm",
  white: "bg-surfaceRaised text-brandAccent border-borderWarm",
  espresso: "bg-brandAccent text-brand border-brandAccent",
} as const;

/**
 * Sections are separated by ground colour and a hairline rule — never by
 * shadow. Alternating cream / white / espresso is what gives the page its
 * rhythm now that the old floating-card treatment is gone.
 */
export function Section({
  ground = "cream",
  className,
  children,
}: {
  ground?: keyof typeof GROUNDS;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn("border-b-[1.5px] px-6 py-16 md:py-20", GROUNDS[ground], className)}
    >
      <div className="mx-auto max-w-5xl">{children}</div>
    </section>
  );
}

const EYEBROW_TONES = {
  light: "text-textMuted",
  dark: "text-[#c4a99f]",
} as const;

export function SectionEyebrow({
  tone = "light",
  children,
}: {
  tone?: keyof typeof EYEBROW_TONES;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "mb-3 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.13em]",
        EYEBROW_TONES[tone]
      )}
    >
      {children}
      <span className="h-px flex-1 bg-current opacity-30" aria-hidden="true" />
    </div>
  );
}
