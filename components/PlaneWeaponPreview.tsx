"use client";

import { useEffect, useRef } from "react";
import type { SharePlane } from "@/lib/share";

type PlaneWeaponPreviewProps = {
  plane: SharePlane;
};

function drawMiniShip(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string
): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - 7);
  ctx.lineTo(x + 6, y + 5);
  ctx.lineTo(x - 6, y + 5);
  ctx.closePath();
  ctx.fill();
}

function drawSpreadPreview(
  ctx: CanvasRenderingContext2D,
  shipX: number,
  shipY: number
): void {
  const halfSpread = 0.32;
  const baseAngle = -Math.PI / 2;
  const bulletW = 5;
  const bulletH = 11;
  const dist = 38;

  ctx.fillStyle = "#93c5fd";
  for (let i = 0; i < 3; i++) {
    const t = i / 2;
    const angle = baseAngle + (t * 2 - 1) * halfSpread;
    const cx = shipX + Math.cos(angle) * dist;
    const cy = shipY + Math.sin(angle) * dist;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle + Math.PI / 2);
    ctx.fillRect(-bulletW / 2, -bulletH / 2, bulletW, bulletH);
    ctx.restore();
  }

  ctx.fillStyle = "rgba(147, 197, 253, 0.35)";
  for (let i = 0; i < 3; i++) {
    const t = i / 2;
    const angle = baseAngle + (t * 2 - 1) * halfSpread;
    const cx = shipX + Math.cos(angle) * (dist * 0.55);
    const cy = shipY + Math.sin(angle) * (dist * 0.55);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle + Math.PI / 2);
    ctx.fillRect(-bulletW / 2, -bulletH / 2, bulletW, bulletH);
    ctx.restore();
  }
}

function drawLaserPreview(
  ctx: CanvasRenderingContext2D,
  shipX: number,
  shipY: number,
  w: number,
  h: number
): void {
  const sx = shipX;
  const sy = shipY - 4;
  const ex = w * 0.72;
  const ey = 14;
  const cx = (sx + ex) / 2 + 18;
  const cy = (sy + ey) / 2 - 6;
  const thickness = 4;

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.strokeStyle = "rgba(192, 132, 252, 0.25)";
  ctx.lineWidth = thickness * 2.4;
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.quadraticCurveTo(cx, cy, ex, ey);
  ctx.stroke();

  ctx.strokeStyle = "rgba(224, 231, 255, 0.85)";
  ctx.lineWidth = thickness;
  ctx.shadowColor = "#c084fc";
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.quadraticCurveTo(cx, cy, ex, ey);
  ctx.stroke();

  ctx.restore();

  ctx.fillStyle = "rgba(251, 146, 60, 0.85)";
  ctx.beginPath();
  ctx.arc(ex, ey, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(254, 215, 170, 0.9)";
  ctx.lineWidth = 1;
  ctx.stroke();
}

function paintPreview(
  ctx: CanvasRenderingContext2D,
  plane: SharePlane,
  w: number,
  h: number
): void {
  ctx.clearRect(0, 0, w, h);

  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, "rgba(15, 23, 42, 0.15)");
  grad.addColorStop(1, "rgba(2, 6, 23, 0.55)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  const shipX = w / 2;
  const shipY = h - 12;

  if (plane === "spread") {
    drawSpreadPreview(ctx, shipX, shipY);
    drawMiniShip(ctx, shipX, shipY, "#38bdf8");
  } else {
    drawLaserPreview(ctx, shipX, shipY, w, h);
    drawMiniShip(ctx, shipX, shipY, "#c084fc");
  }
}

export function PlaneWeaponPreview({ plane }: PlaneWeaponPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    paintPreview(ctx, plane, canvas.width, canvas.height);
  }, [plane]);

  return (
    <canvas
      ref={canvasRef}
      className="lobby-plane__preview-canvas"
      width={168}
      height={76}
      aria-hidden
    />
  );
}
