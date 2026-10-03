"use client";

import { useRef, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, EyeOff, Plus, RotateCcw, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DASHBOARD_CARDS,
  defaultDashboardLayout,
  isDefaultLayout,
  moveCard,
  setCardVisible,
  visibleCards,
  type DashboardCardId,
  type DashboardLayout,
} from "@/lib/dashboardLayout";
import { saveDashboardLayout } from "@/server/mutations/dashboard";
import type { DashboardStats } from "@/server/queries/stats";
import { DashboardCardBody, WIDE_CARDS } from "./DashboardCards";
import { StatCard } from "./StatCard";

const CARD_INFO = new Map(DASHBOARD_CARDS.map((card) => [card.id, card]));

type SaveState = "idle" | "saving" | "saved" | "error";

export default function DashboardGrid({
  stats,
  initialLayout,
}: {
  stats: DashboardStats;
  initialLayout: DashboardLayout;
}) {
  const [layout, setLayout] = useState(initialLayout);
  const [editing, setEditing] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [, startTransition] = useTransition();
  // Only the latest save may report its outcome.
  const saveSeq = useRef(0);

  const persist = (next: DashboardLayout | null) => {
    const seq = ++saveSeq.current;
    setSaveState("saving");
    startTransition(async () => {
      try {
        const result = await saveDashboardLayout(next);
        if (seq === saveSeq.current) setSaveState(result.ok ? "saved" : "error");
      } catch {
        if (seq === saveSeq.current) setSaveState("error");
      }
    });
  };

  const update = (next: DashboardLayout) => {
    setLayout(next);
    persist(next);
  };

  const reset = () => {
    setLayout(defaultDashboardLayout());
    persist(null);
  };

  const shown = visibleCards(layout);
  const hidden = layout.order.filter((id) => layout.hidden.includes(id));

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
        {editing ? (
          <>
            <span className="mr-auto text-sm text-textMuted" role="status" aria-live="polite">
              {saveState === "saving"
                ? "Saving…"
                : saveState === "error"
                  ? "Couldn't save your layout. Your next change will try again."
                  : saveState === "saved"
                    ? "Saved"
                    : "Reorder or hide cards. Changes save automatically."}
            </span>
            {!isDefaultLayout(layout) ? (
              <Button variant="ghost" size="sm" onClick={reset}>
                <RotateCcw className="mr-1.5 h-4 w-4" aria-hidden />
                Reset
              </Button>
            ) : null}
            <Button size="sm" onClick={() => setEditing(false)}>
              Done
            </Button>
          </>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            <SlidersHorizontal className="mr-1.5 h-4 w-4" aria-hidden />
            Customize
          </Button>
        )}
      </div>

      {shown.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((id, index) => {
            const info = CARD_INFO.get(id)!;
            return (
              <StatCard
                key={id}
                title={info.title}
                subtitle={editing ? info.description : undefined}
                wide={WIDE_CARDS.has(id)}
                controls={
                  editing ? (
                    <CardControls
                      title={info.title}
                      first={index === 0}
                      last={index === shown.length - 1}
                      onMove={(direction) => update(moveCard(layout, id, direction))}
                      onHide={() => update(setCardVisible(layout, id, false))}
                    />
                  ) : null
                }
              >
                <DashboardCardBody id={id} stats={stats} />
              </StatCard>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border-[1.5px] border-dashed border-borderWarm p-6 text-center text-sm text-textMuted">
          All cards are hidden.{" "}
          {editing ? "Add some back below." : (
            <button className="font-medium text-brandAccent underline" onClick={() => setEditing(true)}>
              Choose cards to show
            </button>
          )}
        </div>
      )}

      {editing && hidden.length ? (
        <div className="mt-6">
          <h2 className="mb-2 text-sm font-bold text-brandAccent">More cards</h2>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {hidden.map((id: DashboardCardId) => {
              const info = CARD_INFO.get(id)!;
              return (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => update(setCardVisible(layout, id, true))}
                    className="flex w-full items-center gap-3 rounded-xl border-[1.5px] border-dashed border-borderWarm bg-surfaceSubtle p-3 text-left hover:border-textMuted"
                    aria-label={`Show ${info.title}`}
                  >
                    <Plus className="h-4 w-4 shrink-0 text-textMuted" aria-hidden />
                    <span>
                      <span className="block text-sm font-semibold text-brandAccent">{info.title}</span>
                      <span className="block text-xs text-textMuted">{info.description}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function CardControls({
  title,
  first,
  last,
  onMove,
  onHide,
}: {
  title: string;
  first: boolean;
  last: boolean;
  onMove: (direction: -1 | 1) => void;
  onHide: () => void;
}) {
  const iconButton =
    "flex h-8 w-8 items-center justify-center rounded-md text-textMuted hover:bg-surfaceSubtle hover:text-brandAccent disabled:opacity-30";
  return (
    <div className="flex shrink-0 gap-0.5">
      <button type="button" className={iconButton} disabled={first} onClick={() => onMove(-1)} aria-label={`Move ${title} earlier`}>
        <ArrowUp className="h-4 w-4" aria-hidden />
      </button>
      <button type="button" className={iconButton} disabled={last} onClick={() => onMove(1)} aria-label={`Move ${title} later`}>
        <ArrowDown className="h-4 w-4" aria-hidden />
      </button>
      <button type="button" className={iconButton} onClick={onHide} aria-label={`Hide ${title}`}>
        <EyeOff className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}
