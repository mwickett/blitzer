// src/components/scoring/useGameColors.ts
"use client";

import { useState, useCallback } from "react";
import { assignColorsToPlayers } from "@/lib/scoring/colors";
import { resolveColorCascade } from "@/lib/scoring/colorCascade";

export interface ColorStepPlayer {
  id: string;
  name: string;
  isGuest: boolean;
  isCurrentUser: boolean;
  defaultColor: string | null;
  avatarUrl?: string | null;
}

export function useGameColors(players: ColorStepPlayer[]) {
  const [colors, setColors] = useState<Record<string, string>>(() => {
    const inputs = players.map((p) => ({
      id: p.id,
      resolvedColor: p.defaultColor,
    }));
    return assignColorsToPlayers(inputs);
  });

  const updateColor = useCallback((playerId: string, newColor: string) => {
    setColors((prev) => resolveColorCascade(prev, playerId, newColor));
  }, []);

  return { colors, updateColor };
}
