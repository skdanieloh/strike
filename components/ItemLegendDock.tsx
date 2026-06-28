"use client";

import type { SharePlane } from "@/lib/share";

type ItemLegendDockProps = {
  plane: SharePlane;
  side: "left" | "right";
};

type LegendItem = {
  color: string;
  sym: string;
  label: string;
};

function LegendChip({ color, sym, label }: LegendItem) {
  return (
    <div className="item-legend-chip" style={{ ["--chip-color" as string]: color }}>
      <span className="item-legend-chip__icon" aria-hidden>
        {sym}
      </span>
      <span className="item-legend-chip__label">{label}</span>
    </div>
  );
}

function itemsForSide(plane: SharePlane, side: "left" | "right"): LegendItem[] {
  const missileLabel = plane === "spread" ? "탄환↑" : "레이저↑";
  if (side === "left") {
    return [
      { color: "#3ecf8e", sym: "+", label: "HP회복" },
      { color: "#f0b429", sym: "P", label: "공격↑" },
    ];
  }
  return [{ color: "#6cb6ff", sym: "M", label: missileLabel }];
}

export function ItemLegendDock({ plane, side }: ItemLegendDockProps) {
  const items = itemsForSide(plane, side);

  return (
    <div
      className={`item-legend-dock item-legend-dock--${side}`}
      aria-label={side === "left" ? "아이템 안내" : undefined}
    >
      {items.map((item) => (
        <LegendChip key={item.label} {...item} />
      ))}
    </div>
  );
}
