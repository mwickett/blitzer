import { cn } from "@/lib/utils";

/**
 * Guide pages are TSX rather than MDX so they can embed the live scoring
 * components. That means no markdown pipeline styles them — this carries the
 * typography instead.
 *
 * AUTHORING CONSTRAINT: every rule below except the link one uses a
 * direct-child selector (`[&>p]`, not `[&_p]`). Keep prose elements as direct
 * children of <Prose>. Wrapping a paragraph or heading in a <div> silently
 * drops its styling — nothing errors, it just renders unstyled.
 *
 * Styled: direct-child p, h2, h3, ul, ol, their immediate li, and any
 * descendant a. NOT styled: h4-h6, blockquote, table, pre, code, hr, dl,
 * second-level list items, or anything nested inside a wrapper element. Give
 * those explicit classes at the call site — the FAQ list in /guide does
 * exactly that for its <dl>.
 */
export function Prose({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "text-base leading-relaxed text-textBody",
        "[&>p]:mb-4",
        "[&>h2]:font-display [&>h2]:text-2xl [&>h2]:font-bold [&>h2]:tracking-[-0.018em] [&>h2]:text-brandAccent [&>h2]:mt-10 [&>h2]:mb-3",
        "[&>h3]:font-display [&>h3]:text-lg [&>h3]:font-bold [&>h3]:tracking-[-0.018em] [&>h3]:text-brandAccent [&>h3]:mt-6 [&>h3]:mb-2",
        "[&>ul]:mb-4 [&>ul]:list-disc [&>ul]:pl-5 [&>ul>li]:mb-1.5",
        "[&>ol]:mb-4 [&>ol]:list-decimal [&>ol]:pl-5 [&>ol>li]:mb-1.5",
        "[&_a]:font-medium [&_a]:text-brandAccent [&_a]:underline [&_a]:underline-offset-4",
        className
      )}
    >
      {children}
    </div>
  );
}

export function GuidePageHeader({
  title,
  intro,
}: {
  title: string;
  intro: string;
}) {
  return (
    <header className="mb-8 border-b-[1.5px] border-borderWarm pb-6">
      <h1 className="font-display text-4xl font-bold leading-[1.08] tracking-[-0.018em] text-brandAccent">
        {title}
      </h1>
      <p className="mt-3 text-lg leading-relaxed text-textBody">{intro}</p>
    </header>
  );
}
