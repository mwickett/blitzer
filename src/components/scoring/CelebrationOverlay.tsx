"use client";

import { useEffect, useState, useRef } from "react";

interface CelebrationOverlayProps {
  winnerName: string;
  winnerScore: number;
  winnerColor: string;
  onComplete: () => void;
  onCancel?: () => void;
  cancelled?: boolean;
}

function generateConfetti(count: number, colors: string[]) {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    color: colors[i % colors.length],
    left: `${Math.random() * 100}%`,
    top: `${-10 + Math.random() * 20}%`,
    size: 4 + Math.random() * 8,
    isCircle: Math.random() > 0.5,
    delay: `${Math.random() * 0.5}s`,
    duration: `${2 + Math.random() * 1.5}s`,
  }));
}

const CONFETTI_COLORS = [
  "#3b82f6", "#ef4444", "#eab308", "#22c55e",
  "#8b5cf6", "#f97316", "#fff", "#fbbf24",
];

export function CelebrationOverlay({
  winnerName,
  winnerScore,
  winnerColor,
  onComplete,
  onCancel,
  cancelled,
}: CelebrationOverlayProps) {
  const [visible, setVisible] = useState(true);
  const confetti = useRef(generateConfetti(50, CONFETTI_COLORS));

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      onComplete();
    }, 2500);
    return () => clearTimeout(timer);
  }, [onComplete]);

  useEffect(() => {
    if (cancelled) {
      setVisible(false);
      onCancel?.();
    }
  }, [cancelled, onCancel]);

  if (!visible) return null;

  return (
    <div className="absolute inset-0 z-40 flex flex-col items-center justify-center pointer-events-none animate-[celebrationFade_2.5s_ease-out_forwards]">
      {/* Background flash */}
      <div
        className="absolute inset-0 animate-[bgFlash_2.5s_ease-out_forwards]"
        style={{
          background: `linear-gradient(135deg, ${winnerColor}, ${winnerColor}dd)`,
        }}
      />

      {/* Confetti */}
      <div className="absolute inset-0 overflow-hidden">
        {confetti.current.map((c) => (
          <div
            key={c.id}
            className="absolute animate-[confettiFall_3s_ease-out_forwards]"
            style={{
              left: c.left,
              top: c.top,
              width: c.size,
              height: c.size,
              backgroundColor: c.color,
              borderRadius: c.isCircle ? "50%" : "2px",
              animationDelay: c.delay,
              animationDuration: c.duration,
              opacity: 0,
            }}
          />
        ))}
      </div>

      {/* Content */}
      <div className="relative z-10 text-center animate-[contentPop_2.5s_ease-out_forwards]">
        <div className="text-6xl mb-3 animate-[trophyBounce_2.5s_ease-out_forwards]">
          🏆
        </div>
        <div className="text-3xl font-black text-white drop-shadow-lg">
          {winnerName}
        </div>
        <div className="text-base font-semibold text-white/85">
          wins the game!
        </div>
        <div className="text-5xl font-black text-white mt-2 drop-shadow-lg">
          {winnerScore}
        </div>
      </div>
    </div>
  );
}
