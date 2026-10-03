import { cn } from "@/lib/utils";

export function StatCard({
  title,
  subtitle,
  wide,
  controls,
  children,
}: {
  title: string;
  subtitle?: string;
  wide?: boolean;
  controls?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-label={title}
      className={cn(
        "flex flex-col rounded-xl border-[1.5px] border-borderWarm bg-surfaceRaised p-4",
        wide && "sm:col-span-2",
      )}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold text-brandAccent">{title}</h2>
          {subtitle ? (
            <p className="text-xs text-textMuted">{subtitle}</p>
          ) : null}
        </div>
        {controls}
      </div>
      <div className="flex flex-1 flex-col">{children}</div>
    </section>
  );
}

export function BigNumber({
  value,
  caption,
}: {
  value: string;
  caption?: React.ReactNode;
}) {
  return (
    <div>
      <div className="font-display text-5xl font-bold leading-none tracking-[-0.02em] text-brandAccent">
        {value}
      </div>
      {caption ? (
        <div className="mt-2 text-sm text-textBody">{caption}</div>
      ) : null}
    </div>
  );
}

export function StatRow({ label, value }: { label: React.ReactNode; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-t border-borderWarm/60 py-1.5 text-sm first:border-t-0">
      <span className="text-textMuted">{label}</span>
      <span className="font-semibold text-brandAccent">{value}</span>
    </div>
  );
}

export function EmptyNote({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-textMuted">{children}</p>;
}
