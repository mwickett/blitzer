// src/components/scoring/useGameColors.ts
"use client";

import { useState, useCallback } from "react";
import { ACCENT_COLORS, assignColorsToPlayers } from "@/lib/scoring/colors";
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
  const allowDuplicateColors = players.length > ACCENT_COLORS.length;
  const [colors, setColors] = useState<Record<string, string>>(() => {
    const inputs = players.map((p) => ({
      id: p.id,
      resolvedColor: p.defaultColor,
    }));
    return assignColorsToPlayers(inputs);
  });

  const updateColor = useCallback((playerId: string, newColor: string) => {
    setColors((prev) =>
      allowDuplicateColors
        ? { ...prev, [playerId]: newColor }
        : resolveColorCascade(prev, playerId, newColor)
    );
  }, [allowDuplicateColors]);

  return { colors, updateColor };
}
