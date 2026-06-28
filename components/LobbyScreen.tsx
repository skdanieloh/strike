"use client";

import { useState } from "react";
import { GameGuideSheet } from "@/components/GameGuideSheet";
import { LobbyTopBar } from "@/components/LobbyTopBar";
import { RankingModal } from "@/components/RankingModal";
import { SharedResultBannerLoader } from "@/components/SharedResultBannerLoader";
import { UserProfilePanel } from "@/components/UserProfilePanel";
import type { SharePlane } from "@/lib/share";
import { PlaneWeaponPreview } from "@/components/PlaneWeaponPreview";
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
  const [rankingOpen, setRankingOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);

  return (
    <div className="lobby-screen" aria-label="게임 로비">
      <LobbyTopBar currentVersion={version} onOpenProfile={() => setProfileOpen(true)} />
      <header className="lobby-screen__hero">
        <p className="lobby-screen__eyebrow">2D 슈팅</p>
        <h1 className="lobby-screen__title">Sky Strike</h1>
        <p className="lobby-screen__tagline">기체를 고르고, 스테이지를 돌파하세요</p>
      </header>

      <SharedResultBannerLoader />

      <div className="lobby-screen__quick-actions">
        <button
          type="button"
          className="lobby-screen__action-btn lobby-screen__action-btn--primary"
          onClick={() => setRankingOpen(true)}
        >
          🏆 랭킹
        </button>
        <button
          type="button"
          className="lobby-screen__action-btn"
          onClick={() => setGuideOpen(true)}
        >
          📖 가이드
        </button>
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
              <div className="lobby-plane__preview">
                <span className="lobby-plane__preview-label">발사 형상</span>
                <PlaneWeaponPreview plane={plane.id} />
              </div>
              <span className="lobby-plane__cta">출격하기 →</span>
            </button>
          ))}
        </div>
      </section>

      <footer className="lobby-screen__footer">
        <p className="lobby-screen__version">v{version}</p>
      </footer>

      <RankingModal open={rankingOpen} onClose={() => setRankingOpen(false)} />
      <GameGuideSheet open={guideOpen} onClose={() => setGuideOpen(false)} />
      <UserProfilePanel open={profileOpen} onClose={() => setProfileOpen(false)} />
    </div>
  );
}
