import type { GameDetail } from "@/server/queries/games";
import transformGameData from "@/lib/gameLogic";
import {
  ACCENT_COLORS,
  assignColorsToPlayers,
  resolvePlayerColor,
} from "@/lib/scoring/colors";
import {
  describeHighlight,
  findScoredGameHighlights,
} from "@/lib/scoring/gameHighlights";
import {
  describeNamedMoment,
  findScoredGameNamedMoments,
} from "@/lib/scoring/namedMoments";

export interface RecapCardPlayer {
  name: string;
  score: number;
  color: string;
  isWinner: boolean;
}

/** What the shareable picture of a finished game shows. */
export interface RecapCard {
  winnerName: string;
  /** Final totals, highest first. */
  players: RecapCardPlayer[];
  roundCount: number;
  endedAt: Date | null;
  /** The game's headline moment, named moments first as on the game page. */
  moment: { title: string; detail: string } | null;
}

/** The recap for a finished game, or null while nobody has won. */
export function buildRecapCard(game: GameDetail): RecapCard | null {
  const scores = transformGameData(game);
  const winner = scores.find((s) => s.isWinner);
  if (!winner) return null;

  const colors = assignColorsToPlayers(
    game.players.map((p) => ({
      id: p.id,
      resolvedColor: resolvePlayerColor({
        gameColor: p.accentColor ?? null,
        userDefault: p.user?.accentColor ?? null,
      }),
    })),
  );
  const players = scores
    .map((s) => {
      const seat = game.players.find(
        (p) => p.userId === s.id || p.guestId === s.id,
      );
      return {
        name: s.username,
        score: s.total,
        color: colors[seat?.id ?? s.id] ?? ACCENT_COLORS[0].value,
        isWinner: s.isWinner,
      };
    })
    .sort(
      (a, b) => Number(b.isWinner) - Number(a.isWinner) || b.score - a.score,
    );

  const { highlights } = findScoredGameHighlights(game);
  const { moments: named } = findScoredGameNamedMoments(game);
  const names = new Map(scores.map((s) => [s.id, s.username]));
  const name = (id: string) => names.get(id) ?? "Someone";
  const top = named[0]
    ? describeNamedMoment(named[0], name)
    : highlights[0]
      ? describeHighlight(highlights[0], name)
      : null;

  return {
    winnerName: winner.username,
    players,
    roundCount: game.rounds.length,
    endedAt: game.endedAt,
    moment: top ? { title: top.title, detail: top.detail } : null,
  };
}
