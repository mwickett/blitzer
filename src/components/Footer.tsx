import Link from "next/link";
import Image from "next/image";

const GUIDE_LINKS = [
  { label: "Getting started", href: "/guide/getting-started" },
  { label: "How scoring works", href: "/guide/how-scoring-works" },
  { label: "Circles & pickup games", href: "/guide/circles-and-pickup-games" },
  { label: "Reading your stats", href: "/guide/reading-your-stats" },
  { label: "Why Blitzer", href: "/guide/why-blitzer" },
];

const LEGAL_LINKS = [
  { label: "Privacy policy", href: "/privacy" },
  { label: "Terms of service", href: "/terms" },
];

export default function Footer() {
  return (
    <footer className="mt-auto border-t-[1.5px] border-borderWarm bg-surfaceSubtle">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="grid gap-8 md:grid-cols-[1.5fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-3">
              <Image
                src="/img/blitzer-logo.png"
                width={44}
                height={44}
                alt=""
                aria-hidden="true"
                className="h-auto w-11"
              />
              <span className="font-display text-lg font-bold text-brandAccent">
                Blitzer
              </span>
            </div>
            <p className="mt-3 max-w-[34ch] text-sm leading-relaxed text-textBody">
              Scoring and stats for people who take Thursday night far too
              seriously.
            </p>
          </div>

          <div>
            <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.11em] text-textMuted">
              Guide
            </h2>
            <ul className="space-y-2">
              {GUIDE_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-textBody transition-colors hover:text-brandAccent"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.11em] text-textMuted">
              Legal
            </h2>
            <ul className="space-y-2">
              {LEGAL_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-textBody transition-colors hover:text-brandAccent"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-8 border-t border-borderWarm pt-5 text-xs leading-relaxed text-textMuted">
          <p className="font-semibold text-brandAccent">
            Blitzer is an unofficial companion app and is not affiliated with,
            endorsed by, or sponsored by Dutch Blitz Games Company.
          </p>
          <p className="mt-1.5">
            For scoring and tracking statistics for{" "}
            <a
              href="https://www.dutchblitz.com"
              className="font-medium text-brandAccent hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Dutch Blitz
            </a>
            , the fast-paced, multiplayer card game. © {new Date().getFullYear()}{" "}
            Blitzer.
          </p>
        </div>
      </div>
    </footer>
  );
}
