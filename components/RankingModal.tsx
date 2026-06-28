"use client";

import { useEffect, useState } from "react";
import { GlobalRankingBoard } from "@/components/GlobalRankingBoard";
import type { SharePlane } from "@/lib/share";

type RankingPlaneFilter = "all" | SharePlane;

type RankingModalProps = {
  open: boolean;
  onClose: () => void;
};

const TABS: { id: RankingPlaneFilter; label: string }[] = [
  { id: "all", label: "전체" },
  { id: "spread", label: "Spread" },
  { id: "laser", label: "Laser" },
];

export function RankingModal({ open, onClose }: RankingModalProps) {
  const [plane, setPlane] = useState<RankingPlaneFilter>("all");

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const title =
    plane === "all" ? "글로벌 랭킹" : plane === "spread" ? "Spread 랭킹" : "Laser 랭킹";

  return (
    <div className="app-bottom-sheet" role="presentation" onClick={onClose}>
      <div
        className="app-bottom-sheet__panel app-bottom-sheet__panel--wide"
        role="dialog"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="app-bottom-sheet__handle" aria-hidden />

        <div className="app-bottom-sheet__header">
          <h2 className="app-bottom-sheet__title">{title}</h2>
          <button
            type="button"
            className="app-bottom-sheet__close"
            onClick={onClose}
            aria-label="닫기"
          >
            ✕
          </button>
        </div>

        <div className="ranking-modal__tabs" role="tablist" aria-label="랭킹 종류">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={plane === tab.id}
              className={`ranking-modal__tab${plane === tab.id ? " ranking-modal__tab--active" : ""}`}
              onClick={() => setPlane(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <GlobalRankingBoard
          limit={20}
          plane={plane === "all" ? undefined : plane}
          title={title}
        />
      </div>
    </div>
  );
}
