export interface TrackMarker {
  id: string;
  name: string;
  score: number;
  color: string;
}

export interface PillGroup {
  markers: TrackMarker[];
  position: number; // percentage 0-100
}

export function calcTrackBounds(
  scores: number[],
  winThreshold: number
): { min: number; max: number } {
  const lowest = scores.length > 0 ? Math.min(...scores) : 0;
  return {
    min: Math.min(lowest - 5, -10),
    max: winThreshold,
  };
}

export function scoreToPosition(
  score: number,
  min: number,
  max: number
): number {
  const range = max - min;
  if (range === 0) return 50;
  return ((score - min) / range) * 100;
}

export function groupMarkers(
  markers: TrackMarker[],
  threshold: number,
  trackMin: number,
  trackMax: number
): PillGroup[] {
  if (markers.length === 0) return [];

  const sorted = [...markers].sort((a, b) => a.score - b.score);
  const groups: PillGroup[] = [];
  let current: TrackMarker[] = [sorted[0]];
  let currentPos = scoreToPosition(sorted[0].score, trackMin, trackMax);

  for (let i = 1; i < sorted.length; i++) {
    const pos = scoreToPosition(sorted[i].score, trackMin, trackMax);
    if (pos - currentPos < threshold) {
      current.push(sorted[i]);
      currentPos = pos; // Track tail so chained-close scores group transitively
    } else {
      const avg =
        current.reduce((s, m) => s + m.score, 0) / current.length;
      groups.push({
        markers: current,
        position: scoreToPosition(avg, trackMin, trackMax),
      });
      current = [sorted[i]];
      currentPos = pos;
    }
  }

  const avg = current.reduce((s, m) => s + m.score, 0) / current.length;
  groups.push({
    markers: current,
    position: scoreToPosition(avg, trackMin, trackMax),
  });

  return groups;
}
