"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { planeLabel } from "@/lib/share";
import type { GamePlane, RankedScoreRecord } from "@/lib/scores";

type GlobalRankingBoardProps = {
  limit?: number;
  compact?: boolean;
  title?: string;
  refreshKey?: number;
  plane?: GamePlane;
};

type RankingResponse = {
  scores?: RankedScoreRecord[];
  totalPlayers?: number;
  cloudEnabled?: boolean;
  myRank?: number | null;
  myRecord?: RankedScoreRecord | null;
};

function rankMedal(rank: number): string | null {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return null;
}

export function GlobalRankingBoard({
  limit = 20,
  compact = false,
  title = "글로벌 랭킹",
  refreshKey = 0,
  plane,
}: GlobalRankingBoardProps) {
  const { data: session } = useSession();
  const [scores, setScores] = useState<RankedScoreRecord[]>([]);
  const [totalPlayers, setTotalPlayers] = useState(0);
  const [cloudEnabled, setCloudEnabled] = useState(false);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [myRecord, setMyRecord] = useState<RankedScoreRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const planeQuery = plane ? `&plane=${plane}` : "";
      const res = await fetch(`/api/scores?limit=${limit}${planeQuery}`, { cache: "no-store" });
      if (!res.ok) {
        setError("랭킹을 불러오지 못했습니다.");
        return;
      }
      const data = (await res.json()) as RankingResponse;
      setScores(data.scores ?? []);
      setTotalPlayers(data.totalPlayers ?? 0);
      setCloudEnabled(Boolean(data.cloudEnabled));
      setMyRank(data.myRank ?? null);
      setMyRecord(data.myRecord ?? null);
    } catch {
      setError("랭킹을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [limit, plane]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const highlightId = session?.user?.id;

  return (
    <section
      className={`global-ranking${compact ? " global-ranking--compact" : ""}`}
      aria-label={title}
    >
      <div className="global-ranking__header">
        <h2 className="global-ranking__title">{title}</h2>
        {cloudEnabled && totalPlayers > 0 && (
          <span className="global-ranking__meta">{totalPlayers.toLocaleString()}명 참여</span>
        )}
      </div>

      {!cloudEnabled && !loading && (
        <p className="global-ranking__hint">
          글로벌 랭킹 서버가 아직 연결되지 않았습니다. Google 로그인 후 로컬 최고 기록은
          저장됩니다.
        </p>
      )}

      {session?.user && cloudEnabled && myRank !== null && myRecord && (
        <div className="global-ranking__mine">
          <span className="global-ranking__mine-label">{plane ? "내 기종 순위" : "내 순위"}</span>
          <span className="global-ranking__mine-rank">#{myRank}</span>
          <span className="global-ranking__mine-score">{myRecord.score.toLocaleString()}점</span>
          <span className="global-ranking__mine-detail">
            St.{myRecord.stage} · {planeLabel(myRecord.plane)}
          </span>
        </div>
      )}

      {session?.user && cloudEnabled && myRank === null && !loading && (
        <p className="global-ranking__hint">아직 글로벌 랭킹 기록이 없습니다. 첫 판을 플레이해 보세요!</p>
      )}

      {!session?.user && cloudEnabled && !loading && (
        <p className="global-ranking__hint">Google 로그인하면 글로벌 랭킹에 기록할 수 있어요.</p>
      )}

      {loading && <p className="global-ranking__status">랭킹 불러오는 중…</p>}
      {error && <p className="global-ranking__status global-ranking__status--error">{error}</p>}

      {!loading && !error && cloudEnabled && scores.length > 0 && (
        <ol className="global-ranking__list">
          {scores.map((row) => {
            const medal = rankMedal(row.rank);
            const isMe = highlightId === row.userId;
            return (
              <li
                key={row.userId}
                className={`global-ranking__row${isMe ? " global-ranking__row--me" : ""}`}
              >
                <span className="global-ranking__rank">
                  {medal ?? `#${row.rank}`}
                </span>
                <div className="global-ranking__player">
                  {row.userImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      className="global-ranking__avatar"
                      src={row.userImage}
                      alt=""
                      width={compact ? 24 : 28}
                      height={compact ? 24 : 28}
                    />
                  ) : (
                    <span className="global-ranking__avatar global-ranking__avatar--fallback" aria-hidden>
                      ✈
                    </span>
                  )}
                  <div className="global-ranking__player-text">
                    <span className="global-ranking__name">{row.userName}</span>
                    {!compact && (
                      <span className="global-ranking__sub">
                        St.{row.stage} · {planeLabel(row.plane)}
                      </span>
                    )}
                  </div>
                </div>
                <span className="global-ranking__score">{row.score.toLocaleString()}</span>
              </li>
            );
          })}
        </ol>
      )}

      {!loading && !error && cloudEnabled && scores.length === 0 && (
        <p className="global-ranking__hint">아직 등록된 기록이 없습니다. 첫 1위에 도전해 보세요!</p>
      )}
    </section>
  );
}
