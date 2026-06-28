"use client";

import type { PointerEvent as ReactPointerEvent } from "react";

type BombButtonProps = {
  count: number;
  disabled?: boolean;
  onBomb: () => void;
};

export function BombButton({ count, disabled = false, onBomb }: BombButtonProps) {
  const inactive = disabled || count <= 0;

  const onPointerDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (inactive) return;
    onBomb();
  };

  return (
    <button
      type="button"
      className={`bomb-button${inactive ? " bomb-button--empty" : ""}`}
      onPointerDown={onPointerDown}
      disabled={inactive}
      aria-label={inactive ? "폭탄 없음" : `폭탄 사용, ${count}개 남음`}
    >
      <span className="bomb-button__ring" aria-hidden>
        <span className="bomb-button__icon">💣</span>
      </span>
      <span className="bomb-button__label">폭탄</span>
      <span className="bomb-button__count">×{count}</span>
      <span className="bomb-button__hint">×100 ATK</span>
    </button>
  );
}
