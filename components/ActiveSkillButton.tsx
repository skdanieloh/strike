"use client";

import type { PointerEvent as ReactPointerEvent } from "react";
import type { SharePlane } from "@/lib/share";

type ActiveSkillButtonProps = {
  plane: SharePlane;
  ready: boolean;
  active: boolean;
  cooldownSec: number;
  onActivate: () => void;
};

export function ActiveSkillButton({
  plane,
  ready,
  active,
  cooldownSec,
  onActivate,
}: ActiveSkillButtonProps) {
  const isSpread = plane === "spread";
  const label = isSpread ? "관통탄" : "관통빔";
  const hint = isSpread ? "2.8초" : "2.8초";
  const disabled = active || !ready;

  const onPointerDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (disabled) return;
    onActivate();
  };

  return (
    <button
      type="button"
      className={`skill-button skill-button--${plane}${active ? " skill-button--active" : ""}${disabled ? " skill-button--cooldown" : ""}`}
      onPointerDown={onPointerDown}
      disabled={disabled}
      aria-label={
        active
          ? `${label} 발동 중`
          : ready
            ? `${label} 사용`
            : `${label} 쿨다운 ${cooldownSec}초`
      }
    >
      <span className="skill-button__ring" aria-hidden>
        <span className="skill-button__icon">{isSpread ? "⚡" : "✦"}</span>
      </span>
      <span className="skill-button__label">{label}</span>
      <span className="skill-button__count">
        {active ? "ON" : ready ? "READY" : `${cooldownSec}s`}
      </span>
      <span className="skill-button__hint">{hint}</span>
    </button>
  );
}
