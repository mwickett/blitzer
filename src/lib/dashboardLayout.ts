/**
 * Dashboard card catalog and the saved layout contract. Shared by the client
 * editor and the save action, so both normalize the same way.
 */

export const DASHBOARD_CARDS = [
  { id: "record", title: "Win rate", description: "Wins, losses, and games played", defaultVisible: true },
  { id: "form", title: "Recent form", description: "Your last ten results and streaks", defaultVisible: true },
  { id: "blitzRate", title: "Batting average", description: "How often you empty your Blitz pile", defaultVisible: true },
  { id: "recentScores", title: "Recent scores", description: "Final scores from your latest games", defaultVisible: true },
  { id: "bestHand", title: "Best and worst hand", description: "Your highest and lowest single round", defaultVisible: true },
  { id: "rivals", title: "Rivals", description: "Head-to-head with the people you play most", defaultVisible: true },
  { id: "career", title: "Career totals", description: "Points, cards, and rounds all time", defaultVisible: true },
  { id: "moments", title: "Memorable moments", description: "Comebacks, photo finishes, and your nemesis", defaultVisible: true },
  { id: "decks", title: "Lucky deck", description: "Your win rate with each deck you tag", defaultVisible: true },
  { id: "widest", title: "Widest games", description: "Where the leader ran furthest ahead of the table", defaultVisible: true },
  { id: "namedMoments", title: "Named moments", description: "Tornadoes, U-turns, short fuses, and bounce backs", defaultVisible: true },
  { id: "leadChanges", title: "Lead changes", description: "How often the lead swaps hands in your games", defaultVisible: true },
  { id: "gameLength", title: "Game length", description: "Your longest and shortest finished games", defaultVisible: true },
  { id: "averages", title: "Per-round averages", description: "Cards played and Blitz cards left per round", defaultVisible: false },
] as const;

export type DashboardCardId = (typeof DASHBOARD_CARDS)[number]["id"];

export type DashboardLayout = {
  /** Every known card, in display order. */
  order: DashboardCardId[];
  hidden: DashboardCardId[];
};

const CARD_IDS = new Set<string>(DASHBOARD_CARDS.map((card) => card.id));

function isCardId(id: unknown): id is DashboardCardId {
  return typeof id === "string" && CARD_IDS.has(id);
}

export function defaultDashboardLayout(): DashboardLayout {
  return {
    order: DASHBOARD_CARDS.map((card) => card.id),
    hidden: DASHBOARD_CARDS.filter((card) => !card.defaultVisible).map((card) => card.id),
  };
}

/**
 * Accepts anything (a stored JSON value or a client submission) and returns a
 * complete layout. Unknown ids are dropped; cards added after the layout was
 * saved are appended with their default visibility.
 */
export function normalizeDashboardLayout(value: unknown): DashboardLayout {
  if (!value || typeof value !== "object") return defaultDashboardLayout();
  const raw = value as { order?: unknown; hidden?: unknown };
  if (!Array.isArray(raw.order)) return defaultDashboardLayout();

  const order = [...new Set(raw.order.filter(isCardId))];
  const savedHidden = new Set(Array.isArray(raw.hidden) ? raw.hidden.filter(isCardId) : []);
  const known = new Set(order);
  const hidden = order.filter((id) => savedHidden.has(id));

  for (const card of DASHBOARD_CARDS) {
    if (known.has(card.id)) continue;
    order.push(card.id);
    if (!card.defaultVisible) hidden.push(card.id);
  }
  return { order, hidden };
}

export function visibleCards(layout: DashboardLayout): DashboardCardId[] {
  const hidden = new Set(layout.hidden);
  return layout.order.filter((id) => !hidden.has(id));
}

export function isDefaultLayout(layout: DashboardLayout): boolean {
  const fallback = defaultDashboardLayout();
  return (
    layout.order.join() === fallback.order.join() &&
    [...layout.hidden].sort().join() === [...fallback.hidden].sort().join()
  );
}

/** Moves a visible card one step among the visible cards. */
export function moveCard(
  layout: DashboardLayout,
  id: DashboardCardId,
  direction: -1 | 1,
): DashboardLayout {
  const visible = visibleCards(layout);
  const index = visible.indexOf(id);
  const target = visible[index + direction];
  if (index < 0 || !target) return layout;
  const order = [...layout.order];
  const from = order.indexOf(id);
  const to = order.indexOf(target);
  [order[from], order[to]] = [order[to], order[from]];
  return { ...layout, order };
}

export function setCardVisible(
  layout: DashboardLayout,
  id: DashboardCardId,
  visible: boolean,
): DashboardLayout {
  const hidden = layout.hidden.filter((hiddenId) => hiddenId !== id);
  if (!visible) return { ...layout, hidden: [...hidden, id] };
  // A card brought back lands at the end of the visible cards.
  const order = [...layout.order.filter((orderId) => orderId !== id), id];
  return { order, hidden };
}
