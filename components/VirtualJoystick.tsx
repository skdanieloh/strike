"use client";

import { useCallback, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

const BASE_SIZE = 112;
const KNOB_SIZE = 44;
const MAX_OFFSET = (BASE_SIZE - KNOB_SIZE) / 2;
/** 중심 근처 미세 dead zone (0~1) */
const JOYSTICK_DEAD = 0.14;

type VirtualJoystickProps = {
  onMove: (mx: number, my: number) => void;
  onEnd: () => void;
};

function vectorFromOffset(offsetX: number, offsetY: number): { mx: number; my: number } {
  const dist = Math.hypot(offsetX, offsetY);
  if (dist <= MAX_OFFSET * JOYSTICK_DEAD) {
    return { mx: 0, my: 0 };
  }
  const clamped = Math.min(dist, MAX_OFFSET);
  const t = (clamped - MAX_OFFSET * JOYSTICK_DEAD) / (MAX_OFFSET - MAX_OFFSET * JOYSTICK_DEAD);
  return { mx: (offsetX / dist) * t, my: (offsetY / dist) * t };
}

export function VirtualJoystick({ onMove, onEnd }: VirtualJoystickProps) {
  const zoneRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef<HTMLDivElement>(null);
  const pointerIdRef = useRef<number | null>(null);
  const [knobOffset, setKnobOffset] = useState({ x: 0, y: 0 });
  const [engaged, setEngaged] = useState(false);

  const reset = useCallback(() => {
    pointerIdRef.current = null;
    setKnobOffset({ x: 0, y: 0 });
    setEngaged(false);
    onEnd();
  }, [onEnd]);

  const applyOffset = useCallback(
    (offsetX: number, offsetY: number) => {
      const dist = Math.hypot(offsetX, offsetY);
      if (dist > MAX_OFFSET) {
        offsetX = (offsetX / dist) * MAX_OFFSET;
        offsetY = (offsetY / dist) * MAX_OFFSET;
      }
      setKnobOffset({ x: offsetX, y: offsetY });
      const { mx, my } = vectorFromOffset(offsetX, offsetY);
      onMove(mx, my);
    },
    [onMove]
  );

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== null) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    pointerIdRef.current = e.pointerId;
    setEngaged(true);

    const base = baseRef.current;
    if (!base) return;
    const rect = base.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    applyOffset(e.clientX - cx, e.clientY - cy);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== e.pointerId) return;
    e.preventDefault();

    const base = baseRef.current;
    if (!base) return;
    const rect = base.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    applyOffset(e.clientX - cx, e.clientY - cy);
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== e.pointerId) return;
    e.preventDefault();
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    reset();
  };

  return (
    <div
      ref={zoneRef}
      className="virtual-joystick"
      aria-label="이동 조이스틱"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onLostPointerCapture={reset}
    >
      <div
        ref={baseRef}
        className={`virtual-joystick__base${engaged ? " virtual-joystick__base--active" : ""}`}
        aria-hidden
      >
        <div
          className="virtual-joystick__knob"
          style={{ transform: `translate(calc(-50% + ${knobOffset.x}px), calc(-50% + ${knobOffset.y}px))` }}
        />
      </div>
    </div>
  );
}
