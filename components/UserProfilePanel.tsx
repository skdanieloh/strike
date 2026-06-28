"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { formatPlayDuration, formatPlayedAt } from "@/lib/format";
import { planeLabel } from "@/lib/share";
import type { UserProfileSummary } from "@/lib/scores";

type UserProfilePanelProps = {
  open: boolean;
  onClose: () => void;
};

type ProfileResponse = {
  cloudEnabled?: boolean;
  profile?: UserProfileSummary | null;
};

function rankLabel(rank: number | null): string {
  return typeof rank === "number" ? `#${rank}` : "—";
}

export function UserProfilePanel({ open, onClose }: UserProfilePanelProps) {
  const { data: session } = useSession();
  const [profile, setProfile] = useState<UserProfileSummary | null>(null);
  const [cloudEnabled, setCloudEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session?.user) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/scores/history", { cache: "no-store" });
      if (!res.ok) {
        setError("기록을 불러오지 못했습니다.");
        return;
      }
      const data = (await res.json()) as ProfileResponse;
      setCloudEnabled(Boolean(data.cloudEnabled));
      setProfile(data.profile ?? null);
    } catch {
      setError("기록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [session?.user]);

  useEffect(() => {
    if (!open) return;
    void load();
  }, [open, load]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !session?.user) return null;

  const user = session.user;

  return (
    <div className="app-modal" role="presentation" onClick={onClose}>
      <div
        className="app-modal__panel"
        role="dialog"
        aria-label="내 프로필"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="app-modal__header">
          <div className="profile-panel__identity">
            {user.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="profile-panel__avatar" src={user.image} alt="" width={40} height={40} />
            ) : (
              <span className="profile-panel__avatar profile-panel__avatar--fallback" aria-hidden>
                ✈
              </span>
            )}
            <div>
              <h2 className="app-modal__title">{user.name ?? "Pilot"}</h2>
              <p className="profile-panel__subtitle">플레이 기록 · 랭킹</p>
            </div>
          </div>
          <button type="button" className="app-modal__close" onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </div>

        {!cloudEnabled && !loading && (
          <p className="profile-panel__hint">
            클라우드 기록 서버가 연결되지 않았습니다. 로컬 최고 기록만 표시됩니다.
          </p>
        )}

        {typeof user.bestScore === "number" && (
          <p className="profile-panel__local-best">
            세션 최고 기록 {user.bestScore.toLocaleString()}점
            {user.bestStage ? ` · St.${user.bestStage}` : ""}
            {user.bestPlane ? ` · ${planeLabel(user.bestPlane as "spread" | "laser")}` : ""}
          </p>
        )}

        {loading && <p className="profile-panel__status">기록 불러오는 중…</p>}
        {error && <p className="profile-panel__status profile-panel__status--error">{error}</p>}

        {profile && cloudEnabled && (
          <>
            <div className="profile-panel__rank-grid">
              <div className="profile-panel__rank-card">
                <span className="profile-panel__rank-label">글로벌</span>
                <strong className="profile-panel__rank-value">{rankLabel(profile.globalRank)}</strong>
                {profile.globalRecord && (
                  <span className="profile-panel__rank-detail">
                    {profile.globalRecord.score.toLocaleString()}점
                  </span>
                )}
              </div>
              <div className="profile-panel__rank-card">
                <span className="profile-panel__rank-label">Spread</span>
                <strong className="profile-panel__rank-value">
                  {rankLabel(profile.planeRanks.spread.rank)}
                </strong>
                {profile.planeRanks.spread.record && (
                  <span className="profile-panel__rank-detail">
                    {profile.planeRanks.spread.record.score.toLocaleString()}점
                  </span>
                )}
              </div>
              <div className="profile-panel__rank-card">
                <span className="profile-panel__rank-label">Laser</span>
                <strong className="profile-panel__rank-value">
                  {rankLabel(profile.planeRanks.laser.rank)}
                </strong>
                {profile.planeRanks.laser.record && (
                  <span className="profile-panel__rank-detail">
                    {profile.planeRanks.laser.record.score.toLocaleString()}점
                  </span>
                )}
              </div>
            </div>

            <section className="profile-panel__history" aria-label="플레이 히스토리">
              <h3 className="profile-panel__history-title">최근 플레이</h3>
              {profile.history.length === 0 ? (
                <p className="profile-panel__hint">아직 저장된 플레이 기록이 없습니다.</p>
              ) : (
                <ol className="profile-panel__history-list">
                  {profile.history.map((run) => (
                    <li key={run.playedAt} className="profile-panel__history-row">
                      <div className="profile-panel__history-main">
                        <span className="profile-panel__history-score">
                          {run.score.toLocaleString()}점
                        </span>
                        <span className="profile-panel__history-meta">
                          St.{run.stage} · {planeLabel(run.plane)} · {formatPlayDuration(run.durationMs)}
                        </span>
                      </div>
                      <div className="profile-panel__history-side">
                        <span className="profile-panel__history-time">{formatPlayedAt(run.playedAt)}</span>
                        <span className="profile-panel__history-ranks">
                          글로벌 {rankLabel(run.globalRank)} · 기종 {rankLabel(run.planeRank)}
                        </span>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
