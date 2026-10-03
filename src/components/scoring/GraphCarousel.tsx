"use client";

import { useRef, useState, useEffect, type ReactNode } from "react";
import { usePostHog } from "posthog-js/react";

interface GraphCarouselProps {
  children: ReactNode[];
  /** Analytics names for each card, in order (e.g. "hot_cold"). */
  graphNames?: string[];
  /** Where the carousel is shown, for analytics. */
  context?: "between_rounds" | "game_over";
}

export function GraphCarousel({
  children,
  graphNames,
  context,
}: GraphCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const posthog = usePostHog();
  // Count each card once per mount; the first card is visible by default.
  const viewed = useRef(new Set<number>([0]));
  const namesKey = graphNames?.join(",") ?? "";

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const names = namesKey ? namesKey.split(",") : [];
    const track = (index: number) => {
      if (viewed.current.has(index)) return;
      viewed.current.add(index);
      try {
        posthog?.capture("scoring_graph_viewed", {
          graph: names[index] ?? `card_${index}`,
          position: index,
          context,
        });
      } catch {
        // Optional analytics must not affect the carousel.
      }
    };

    const handleScroll = () => {
      const scrollLeft = el.scrollLeft;
      const firstCard = el.firstElementChild as HTMLElement | null;
      if (!firstCard) return;
      const cardStride = firstCard.offsetWidth + 12; // card width + gap-3
      // Elastic overscroll (Safari) can report a negative scrollLeft.
      const index = Math.max(
        0,
        Math.min(Math.round(scrollLeft / cardStride), children.length - 1),
      );
      setActiveIndex(index);
      track(index);
    };

    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [children.length, namesKey, context, posthog]);

  return (
    <div className="px-4 py-2">
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-hide"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {children.map((child, i) => (
          <div key={i} className="min-w-[82%] md:min-w-[88%] snap-start">
            {child}
          </div>
        ))}
        {/* Peek spacer */}
        <div className="min-w-[2%] flex-shrink-0" />
      </div>

      {/* Dot indicators */}
      {children.length > 1 && (
        <div className="flex justify-center gap-1.5 mt-2">
          {children.map((_, i) => (
            <div
              key={i}
              className={`w-1.5 h-1.5 rounded-full transition-colors ${
                i === activeIndex ? "bg-[#290806]" : "bg-[#d1bfa8]"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
