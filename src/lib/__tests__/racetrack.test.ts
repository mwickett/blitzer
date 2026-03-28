import {
  calcTrackBounds,
  scoreToPosition,
  groupMarkers,
  type TrackMarker,
} from "../scoring/racetrack";

describe("calcTrackBounds", () => {
  it("uses default min of -10 when all scores are positive", () => {
    const bounds = calcTrackBounds([10, 20, 30], 75);
    expect(bounds.min).toBe(-10);
    expect(bounds.max).toBe(75);
  });

  it("expands min when a player is below -10", () => {
    const bounds = calcTrackBounds([-15, 20, 30], 75);
    expect(bounds.min).toBe(-20); // -15 - 5
  });

  it("uses custom win threshold as max", () => {
    const bounds = calcTrackBounds([10, 20], 50);
    expect(bounds.max).toBe(50);
  });
});

describe("scoreToPosition", () => {
  it("maps min score to 0%", () => {
    expect(scoreToPosition(-10, -10, 75)).toBe(0);
  });

  it("maps max score to 100%", () => {
    expect(scoreToPosition(75, -10, 75)).toBe(100);
  });

  it("maps zero correctly within range", () => {
    const pos = scoreToPosition(0, -20, 80);
    expect(pos).toBe(20); // 20/100 = 20%
  });

  it("returns 50 when range is zero", () => {
    expect(scoreToPosition(5, 5, 5)).toBe(50);
  });
});

describe("groupMarkers", () => {
  it("keeps spread markers as individual groups", () => {
    const markers: TrackMarker[] = [
      { id: "1", name: "A", score: 10, color: "#3b82f6" },
      { id: "2", name: "B", score: 50, color: "#ef4444" },
    ];
    const groups = groupMarkers(markers, 8, -10, 75);
    expect(groups).toHaveLength(2);
    expect(groups[0].markers).toHaveLength(1);
    expect(groups[1].markers).toHaveLength(1);
  });

  it("merges close markers into a single pill", () => {
    const markers: TrackMarker[] = [
      { id: "1", name: "A", score: 10, color: "#3b82f6" },
      { id: "2", name: "B", score: 12, color: "#ef4444" },
    ];
    const groups = groupMarkers(markers, 8, -10, 75);
    expect(groups).toHaveLength(1);
    expect(groups[0].markers).toHaveLength(2);
  });

  it("merges all markers when extremely clustered", () => {
    const markers: TrackMarker[] = [
      { id: "1", name: "A", score: 0, color: "#3b82f6" },
      { id: "2", name: "B", score: 1, color: "#ef4444" },
      { id: "3", name: "C", score: 2, color: "#eab308" },
      { id: "4", name: "D", score: 3, color: "#22c55e" },
    ];
    const groups = groupMarkers(markers, 8, -10, 75);
    expect(groups).toHaveLength(1);
    expect(groups[0].markers).toHaveLength(4);
  });

  it("handles negative scores", () => {
    const markers: TrackMarker[] = [
      { id: "1", name: "A", score: -8, color: "#3b82f6" },
      { id: "2", name: "B", score: 20, color: "#ef4444" },
    ];
    const groups = groupMarkers(markers, 8, -20, 75);
    expect(groups).toHaveLength(2);
    expect(groups[0].markers[0].score).toBe(-8);
  });

  it("returns empty array for empty input", () => {
    expect(groupMarkers([], 8, -10, 75)).toHaveLength(0);
  });

  it("sorts markers by score within groups", () => {
    const markers: TrackMarker[] = [
      { id: "1", name: "A", score: 5, color: "#3b82f6" },
      { id: "2", name: "B", score: 3, color: "#ef4444" },
    ];
    const groups = groupMarkers(markers, 8, -10, 75);
    expect(groups[0].markers[0].score).toBe(3);
    expect(groups[0].markers[1].score).toBe(5);
  });
});
