"use client";

import type { SharePlane } from "@/lib/share";

type ItemLegendDockProps = {
  plane: SharePlane;
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

export function ItemLegendDock({ plane }: ItemLegendDockProps) {
  const missileLabel = plane === "spread" ? "탄환↑" : "레이저↑";
  const items: LegendItem[] = [
    { color: "#3ecf8e", sym: "+", label: "HP회복" },
    { color: "#f0b429", sym: "P", label: "공격↑" },
    { color: "#6cb6ff", sym: "M", label: missileLabel },
    { color: "#fb923c", sym: "B", label: "폭탄↓" },
  ];

  return (
    <div className="item-legend-dock" aria-label="아이템 안내">
      {items.map((item) => (
        <LegendChip key={item.label} {...item} />
      ))}
    </div>
  );
}
