"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import {
  buildShareText,
  buildShareUrl,
  planeLabel,
  type SharePlane,
} from "@/lib/share";
import type { ScoreRecord } from "@/lib/scores";

type GameOverPanelProps = {
  score: number;
  stage: number;
  plane: SharePlane;
  onRestart: () => void;
};

export function GameOverPanel({ score, stage, plane, onRestart }: GameOverPanelProps) {
  const { data: session, update } = useSession();
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const [cloudStatus, setCloudStatus] = useState<string | null>(null);
  const [leaderboard, setLeaderboard] = useState<ScoreRecord[]>([]);
  const [cloudEnabled, setCloudEnabled] = useState(false);

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
        body: JSON.stringify({ score, stage, plane }),
      });
      const data = (await res.json()) as {
        saved?: boolean;
        cloudEnabled?: boolean;
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
      if (data.saved) {
        setCloudStatus("글로벌 랭킹에 기록했습니다!");
      } else {
        setCloudStatus("이전 최고 기록보다 낮아 저장하지 않았습니다.");
      }
    } catch {
        setCloudStatus("클라우드 저장을 불러오지 못했습니다.");
    }
  }, [session, score, stage, plane, update]);

  useEffect(() => {
    void persistScore();
  }, [persistScore]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/scores");
        if (!res.ok) return;
        const data = (await res.json()) as {
          scores?: ScoreRecord[];
          cloudEnabled?: boolean;
        };
        if (cancelled) return;
        setLeaderboard(data.scores ?? []);
        setCloudEnabled(Boolean(data.cloudEnabled));
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [score]);

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
        Stage {stage} · {planeLabel(plane)}
      </p>

      <div className="game-over-panel__actions">
        <button type="button" className="game-over-panel__btn game-over-panel__btn--primary" onClick={share}>
          결과 공유하기
        </button>
        <button type="button" className="game-over-panel__btn" onClick={onRestart}>
          다시 하기
        </button>
      </div>

      {shareStatus && <p className="game-over-panel__hint">{shareStatus}</p>}
      {session?.user && cloudStatus && (
        <p className="game-over-panel__hint">{cloudStatus}</p>
      )}
      {!session?.user && (
        <p className="game-over-panel__hint">
          Google 로그인하면 최고 기록이 저장되고 글로벌 랭킹에 올릴 수 있어요.
        </p>
      )}

      {cloudEnabled && leaderboard.length > 0 && (
        <div className="game-over-panel__leaderboard">
          <p className="game-over-panel__leaderboard-title">글로벌 TOP {leaderboard.length}</p>
          <ol>
            {leaderboard.map((row, i) => (
              <li key={row.userId}>
                <span>{i + 1}.</span>
                <span>{row.userName}</span>
                <span>{row.score.toLocaleString()}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
