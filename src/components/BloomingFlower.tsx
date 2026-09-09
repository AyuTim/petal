"use client";

import type { CSSProperties } from "react";

export interface BloomingFlowerProps {
  completed: number;
  total: number;
  accentColor?: string;
}

export function BloomingFlower({ completed, total, accentColor = "#c084fc" }: BloomingFlowerProps) {
  const petalCount = 6;
  const progress = total > 0 ? Math.min(1, completed / total) : 0;
  const activePetals = Math.round(progress * petalCount);
  const complete = total > 0 && completed >= total;

  return (
    <div
      className={`blooming-flower ${complete ? "is-complete" : ""}`}
      style={{ "--bloom-accent": accentColor } as CSSProperties}
      title={`${Math.round(progress * 100)}% completed`}
    >
      <svg viewBox="0 0 24 24" role="img" aria-label={`${completed} of ${total} items done`}>
        {Array.from({ length: petalCount }).map((_, index) => {
          const bloomed = index < activePetals;
          return (
            <ellipse
              key={index}
              cx="12"
              cy="6"
              rx="2"
              ry="3.5"
              fill={bloomed ? accentColor : "#e2e8f0"}
              opacity={bloomed ? 0.9 : 0.72}
              transform={`rotate(${(360 / petalCount) * index} 12 12)`}
              className="blooming-flower-petal"
            />
          );
        })}
        <circle cx="12" cy="12" r="2.1" className="blooming-flower-pistil" />
      </svg>
    </div>
  );
}
