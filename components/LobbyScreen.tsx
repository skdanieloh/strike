"use client";

import { AuthBar } from "@/components/AuthBar";
import { SharedResultBannerLoader } from "@/components/SharedResultBannerLoader";
import type { SharePlane } from "@/lib/share";
import { planeLabel } from "@/lib/share";

type LobbyScreenProps = {
  version: string;
  onSelectPlane: (plane: SharePlane) => void;
};

const PLANES: {
  id: SharePlane;
  title: string;
  accent: "spread" | "laser";
  lines: string[];
  keyLabel: string;
}[] = [
  {
    id: "spread",
    title: "Spread",
    accent: "spread",
    lines: ["3방향 부채꼴 미사일", "레벨↑ 넓고 촘촘하게", "아이템: +3발"],
    keyLabel: "키 1",
  },
  {
    id: "laser",
    title: "Laser",
    accent: "laser",
    lines: ["곡선 추적 빔", "적·보스 관통", "레벨↑ 두껍고 강하게"],
    keyLabel: "키 2",
  },
];

export function LobbyScreen({ version, onSelectPlane }: LobbyScreenProps) {
  return (
    <div className="lobby-screen" aria-label="게임 로비">
      <header className="lobby-screen__hero">
        <p className="lobby-screen__eyebrow">2D 슈팅</p>
        <h1 className="lobby-screen__title">Sky Strike</h1>
        <p className="lobby-screen__tagline">기체를 고르고, 스테이지를 돌파하세요</p>
      </header>

      <SharedResultBannerLoader />

      <div className="lobby-screen__auth">
        <AuthBar />
      </div>

      <section className="lobby-screen__planes" aria-labelledby="lobby-planes-heading">
        <h2 id="lobby-planes-heading" className="lobby-screen__section-title">
          기체 선택
        </h2>
        <p className="lobby-screen__section-hint">카드를 탭하거나 키 1 · 2 로 바로 출격</p>
        <div className="lobby-screen__plane-grid">
          {PLANES.map((plane) => (
            <button
              key={plane.id}
              type="button"
              className={`lobby-plane lobby-plane--${plane.accent}`}
              onClick={() => onSelectPlane(plane.id)}
            >
              <span className="lobby-plane__badge">{plane.keyLabel}</span>
              <span className="lobby-plane__title">{plane.title}</span>
              <span className="lobby-plane__subtitle">{planeLabel(plane.id)}</span>
              <ul className="lobby-plane__features">
                {plane.lines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              <span className="lobby-plane__cta">출격하기 →</span>
            </button>
          ))}
        </div>
      </section>

      <section className="lobby-screen__controls" aria-label="조작 안내">
        <h2 className="lobby-screen__section-title lobby-screen__section-title--sm">조작</h2>
        <ul className="lobby-screen__control-list">
          <li>
            <span className="lobby-screen__control-key">PC</span>
            WASD · 방향키 · 하단 키패드
          </li>
          <li>
            <span className="lobby-screen__control-key">모바일</span>
            화면 드래그 · 하단 키패드
          </li>
          <li>
            <span className="lobby-screen__control-key">공통</span>
            자동 발사 · Lv10 보스 · 아이템 픽업
          </li>
        </ul>
      </section>

      <footer className="lobby-screen__footer">
        <p className="lobby-screen__version">v{version}</p>
      </footer>
    </div>
  );
}
