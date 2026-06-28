"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { GlobalRankingBoard } from "@/components/GlobalRankingBoard";
import { formatPlayDuration } from "@/lib/format";
import {
  buildShareText,
  buildShareUrl,
  planeLabel,
  type SharePlane,
} from "@/lib/share";

type GameOverPanelProps = {
  score: number;
  stage: number;
  plane: SharePlane;
  durationMs: number;
  onRestart: () => void;
  onGoHome: () => void;
};

export function GameOverPanel({
  score,
  stage,
  plane,
  durationMs,
  onRestart,
  onGoHome,
}: GameOverPanelProps) {
  const { data: session, update } = useSession();
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const [cloudStatus, setCloudStatus] = useState<string | null>(null);
  const [rankRefreshKey, setRankRefreshKey] = useState(0);

  const sharePayload = {
    score,
    stage,
    plane,
    name: session?.user?.name ?? undefined,
  };

  const persistScore = useCallback(async () => {
    if (!session?.user) return;

    const prevBest = session.user.bestScore ?? 0;
    if (score > prevBest) {
      await update({
        bestScore: score,
        bestStage: stage,
        bestPlane: plane,
      });
    }

    try {
      const res = await fetch("/api/scores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ score, stage, plane, durationMs }),
      });
      const data = (await res.json()) as {
        saved?: boolean;
        planeSaved?: boolean;
        historySaved?: boolean;
        cloudEnabled?: boolean;
        rank?: number | null;
        planeRank?: number | null;
        message?: string;
      };
      if (!res.ok) {
        setCloudStatus("클라우드 저장에 실패했습니다.");
        return;
      }
      if (data.cloudEnabled === false) {
        setCloudStatus("로그인 기록은 저장됐어요. 글로벌 랭킹은 서버 설정 후 이용 가능합니다.");
        return;
      }
      if (data.historySaved) {
        const globalText =
          typeof data.rank === "number" ? `글로벌 #${data.rank}` : "글로벌 기록 없음";
        const planeText =
          typeof data.planeRank === "number" ? `${planeLabel(plane)} #${data.planeRank}` : "";
        const savedNote =
          data.saved || data.planeSaved
            ? " · 최고 기록 갱신!"
            : " · 플레이 기록 저장됨";
        setCloudStatus(`${globalText}${planeText ? ` · ${planeText}` : ""}${savedNote}`);
        setRankRefreshKey((k) => k + 1);
        return;
      }
      setCloudStatus("플레이 기록을 저장하지 못했습니다.");
    } catch {
      setCloudStatus("클라우드 저장을 불러오지 못했습니다.");
    }
  }, [session, score, stage, plane, durationMs, update]);

  useEffect(() => {
    void persistScore();
  }, [persistScore]);

  const share = async () => {
    const url = buildShareUrl(sharePayload);
    const text = buildShareText(sharePayload);

    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: "Sky Strike", text, url });
        setShareStatus("공유했습니다!");
        return;
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
    }

    try {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      setShareStatus("링크를 복사했습니다!");
    } catch {
      setShareStatus("공유에 실패했습니다. 다시 시도해 주세요.");
    }
  };

  return (
    <div className="game-over-panel" role="dialog" aria-label="게임 결과">
      <p className="game-over-panel__score">{score.toLocaleString()}점</p>
      <p className="game-over-panel__meta">
        Stage {stage} · {planeLabel(plane)} · {formatPlayDuration(durationMs)}
      </p>

      <div className="game-over-panel__actions">
        <button type="button" className="game-over-panel__btn game-over-panel__btn--primary" onClick={share}>
          결과 공유하기
        </button>
        <button type="button" className="game-over-panel__btn" onClick={onRestart}>
          다시 하기
        </button>
        <button type="button" className="game-over-panel__btn game-over-panel__btn--ghost" onClick={onGoHome}>
          홈으로 나가기
        </button>
      </div>

      {shareStatus && <p className="game-over-panel__hint">{shareStatus}</p>}
      {session?.user && cloudStatus && (
        <p className="game-over-panel__hint">{cloudStatus}</p>
      )}
      {!session?.user && (
        <p className="game-over-panel__hint">
          Google 로그인하면 플레이 기록·랭킹이 저장됩니다.
        </p>
      )}

      <GlobalRankingBoard limit={10} compact title="글로벌 TOP 10" refreshKey={rankRefreshKey} />
    </div>
  );
}
