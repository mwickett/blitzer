import Link from "next/link";
import { Section } from "./Section";

export function QuoteSection() {
  return (
    <Section ground="cream">
      <figure className="mx-auto max-w-2xl text-center">
        <blockquote className="font-display text-2xl font-normal leading-[1.42] text-brandAccent md:text-[25px]">
          Dutch Blitz forces you to be in the moment. You can&apos;t play well
          and be thinking about anything else — that&apos;s one of the things I
          love about it. But afterwards, wouldn&apos;t you like to know how it
          actually went?
        </blockquote>
        <figcaption className="mt-5 text-sm font-medium text-textMuted">
          Mike, who built Blitzer ·{" "}
          <Link
            href="/guide/why-blitzer"
            className="font-semibold text-brandAccent underline underline-offset-4"
          >
            Read why I built this →
          </Link>
        </figcaption>
      </figure>
    </Section>
  );
}
