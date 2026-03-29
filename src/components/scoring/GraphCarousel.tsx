"use client";

import { useRef, useState, useEffect, type ReactNode } from "react";

interface GraphCarouselProps {
  children: ReactNode[];
}

export function GraphCarousel({ children }: GraphCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const handleScroll = () => {
      const scrollLeft = el.scrollLeft;
      const cardWidth = el.offsetWidth * 0.88; // ~88% card width + gap
      const index = Math.round(scrollLeft / cardWidth);
      setActiveIndex(Math.min(index, children.length - 1));
    };

    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [children.length]);

  return (
    <div className="px-4 py-2">
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-hide"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {children.map((child, i) => (
          <div
            key={i}
            className="min-w-[88%] snap-start"
          >
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
