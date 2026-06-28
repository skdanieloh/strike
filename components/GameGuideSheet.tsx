"use client";

import { useEffect } from "react";
import { ItemLegendDock } from "@/components/ItemLegendDock";
import {
  ACTIVE_SKILL_COOLDOWN_SEC,
  ACTIVE_SKILL_DURATION_SEC,
  BOMB_ATTACK_MULT,
  LASER_SKILL_DPS_MULT,
  SPREAD_SKILL_DAMAGE_MULT,
} from "@/lib/combat";

type GameGuideSheetProps = {
  open: boolean;
  onClose: () => void;
};

function formatMult(n: number): string {
  return n.toLocaleString("ko-KR");
}

export function GameGuideSheet({ open, onClose }: GameGuideSheetProps) {
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

  return (
    <div className="app-bottom-sheet" role="presentation" onClick={onClose}>
      <div
        className="app-bottom-sheet__panel"
        role="dialog"
        aria-label="게임 가이드"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="app-bottom-sheet__handle" aria-hidden />

        <div className="app-bottom-sheet__header">
          <h2 className="app-bottom-sheet__title">게임 가이드</h2>
          <button
            type="button"
            className="app-bottom-sheet__close"
            onClick={onClose}
            aria-label="닫기"
          >
            ✕
          </button>
        </div>

        <div className="game-guide">
          <section className="game-guide__section">
            <h3 className="game-guide__heading">기체 &amp; 액티브 스킬</h3>
            <p className="game-guide__lead">
              Q 키(모바일 ⚡ 버튼)로 {ACTIVE_SKILL_DURATION_SEC}초간 발동 · 쿨다운{" "}
              {ACTIVE_SKILL_COOLDOWN_SEC}초
            </p>

            <article className="game-guide__skill game-guide__skill--spread">
              <div className="game-guide__skill-head">
                <span className="game-guide__skill-badge">Spread</span>
                <strong className="game-guide__skill-name">관통탄</strong>
              </div>
              <ul className="game-guide__list">
                <li>
                  일반 미사일 대비 <strong>×{formatMult(SPREAD_SKILL_DAMAGE_MULT)}</strong> 피해
                </li>
                <li>발사 방향 전방 관통 — 적을 뚫고 지나감</li>
                <li>발사 각도·속도 소폭 상승, 3방향 부채꼴 유지</li>
                <li>평소: 레벨↑ 넓고 촘촘한 미사일 · 아이템 M으로 +3발</li>
              </ul>
            </article>

            <article className="game-guide__skill game-guide__skill--laser">
              <div className="game-guide__skill-head">
                <span className="game-guide__skill-badge">Laser</span>
                <strong className="game-guide__skill-name">관통빔</strong>
              </div>
              <ul className="game-guide__list">
                <li>
                  일반 레이저 DPS 대비 <strong>×{formatMult(LASER_SKILL_DPS_MULT)}</strong> 지속
                  피해
                </li>
                <li>수직 직선 빔 — 경로상 모든 적·보스 동시 타격</li>
                <li>평소: 곡선 추적 빔 · 레벨↑ 두께·위력 증가</li>
              </ul>
            </article>
          </section>

          <section className="game-guide__section">
            <h3 className="game-guide__heading">폭탄</h3>
            <p className="game-guide__text">
              화면 내 적 전체에 공격력 ×
              <strong>{formatMult(BOMB_ATTACK_MULT)}</strong> 피해. B 키 또는 💣 버튼 · 시작{" "}
              {3}개 · 스테이지 드랍·보너스로 추가 획득.
            </p>
          </section>

          <section className="game-guide__section">
            <h3 className="game-guide__heading">드랍 아이템</h3>
            <ItemLegendDock />
          </section>

          <section className="game-guide__section">
            <h3 className="game-guide__heading">조작</h3>
            <ul className="game-guide__controls">
              <li>
                <span className="game-guide__key">PC</span>
                WASD 이동 · Q 스킬 · B 폭탄 · 1/2 기체 선택
              </li>
              <li>
                <span className="game-guide__key">모바일</span>
                조이스틱 · ⚡ 스킬 · 💣 폭탄
              </li>
            </ul>
          </section>

          <section className="game-guide__section">
            <h3 className="game-guide__heading">콤보 &amp; 스테이지 보너스</h3>
            <ul className="game-guide__list">
              <li>연속 격파 시 점수 배율 상승 (최대 ×3, 2.4초 내 다음 격파 유지)</li>
              <li>스테이지 클리어 보너스: 무피격 · 무분탄 · 90초 이내 클리어</li>
              <li>보너스 달성 시 추가 점수 + 폭탄 지급</li>
              <li>스테이지마다 10% 확률로 생명 +1 드랍</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
