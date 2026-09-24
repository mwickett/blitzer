import Link from "next/link";

const GUIDE_NAV = [
  { label: "Overview", href: "/guide" },
  { label: "Getting started", href: "/guide/getting-started" },
  { label: "How scoring works", href: "/guide/how-scoring-works" },
  { label: "Circles & pickup games", href: "/guide/circles-and-pickup-games" },
  { label: "Reading your stats", href: "/guide/reading-your-stats" },
  { label: "Why Blitzer", href: "/guide/why-blitzer" },
];

export default function GuideLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bg-brand">
      <div className="mx-auto grid max-w-5xl gap-10 px-6 py-12 md:grid-cols-[210px_1fr] md:gap-12">
        <nav aria-label="Guide" className="md:sticky md:top-20 md:self-start">
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.11em] text-textMuted">
            Guide
          </h2>
          <ul className="space-y-1.5">
            {GUIDE_NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="block rounded-md px-2 py-1.5 text-sm text-textBody transition-colors hover:bg-surfaceSubtle hover:text-brandAccent"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/*
          A <div>, not a <main>: NavBar.tsx:164 already wraps every page's
          content in the document's one <main>. Nesting a second would be
          invalid HTML and give screen readers two competing landmarks.
        */}
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
