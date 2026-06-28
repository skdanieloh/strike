import { Redis } from "@upstash/redis";

export type ScoreRecord = {
  userId: string;
  userName: string;
  userImage?: string;
  score: number;
  stage: number;
  plane: "spread" | "laser";
  updatedAt: number;
};

export type RankedScoreRecord = ScoreRecord & { rank: number };

export type LeaderboardResult = {
  scores: RankedScoreRecord[];
  totalPlayers: number;
};

export type UserRankResult = {
  rank: number | null;
  record: RankedScoreRecord | null;
};

const LEGACY_KEY = "strike:leaderboard";
const SCORES_ZKEY = "strike:rank:z";
const META_PREFIX = "strike:rank:meta:";
const HISTORY_PREFIX = "strike:history:";
const MAX_ENTRIES = 100;
const MAX_HISTORY = 50;
const DEFAULT_LIMIT = 20;

export type GamePlane = "spread" | "laser";

export type GameHistoryEntry = {
  score: number;
  stage: number;
  plane: GamePlane;
  durationMs: number;
  playedAt: number;
  globalRank: number | null;
  planeRank: number | null;
};

export type UserProfileSummary = {
  globalRank: number | null;
  globalRecord: RankedScoreRecord | null;
  planeRanks: Record<
    GamePlane,
    { rank: number | null; record: RankedScoreRecord | null }
  >;
  history: GameHistoryEntry[];
};

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

function metaKey(userId: string): string {
  return `${META_PREFIX}${userId}`;
}

function planeZKey(plane: GamePlane): string {
  return `strike:rank:plane:${plane}:z`;
}

function planeMetaKey(plane: GamePlane, userId: string): string {
  return `strike:rank:plane:${plane}:meta:${userId}`;
}

function historyKey(userId: string): string {
  return `${HISTORY_PREFIX}${userId}`;
}

export function scoresStorageReady(): boolean {
  return getRedis() !== null;
}

function sortByScore(a: ScoreRecord, b: ScoreRecord): number {
  if (b.score !== a.score) return b.score - a.score;
  if (b.stage !== a.stage) return b.stage - a.stage;
  return a.updatedAt - b.updatedAt;
}

async function loadPlaneMeta(
  redis: Redis,
  plane: GamePlane,
  userId: string,
  score: number
): Promise<ScoreRecord | null> {
  const raw = await redis.get<ScoreRecord>(planeMetaKey(plane, userId));
  if (!raw || typeof raw !== "object") return null;
  return {
    userId,
    userName: raw.userName ?? "Pilot",
    userImage: raw.userImage,
    score,
    stage: raw.stage ?? 1,
    plane,
    updatedAt: raw.updatedAt ?? Date.now(),
  };
}

async function loadMeta(redis: Redis, userId: string, score: number): Promise<ScoreRecord | null> {
  const raw = await redis.get<ScoreRecord>(metaKey(userId));
  if (!raw || typeof raw !== "object") return null;
  return {
    userId,
    userName: raw.userName ?? "Pilot",
    userImage: raw.userImage,
    score,
    stage: raw.stage ?? 1,
    plane: raw.plane === "laser" ? "laser" : "spread",
    updatedAt: raw.updatedAt ?? Date.now(),
  };
}

async function migrateLegacyList(redis: Redis): Promise<void> {
  const existing = await redis.zcard(SCORES_ZKEY);
  if (existing > 0) return;

  const legacy = await redis.get<ScoreRecord[]>(LEGACY_KEY);
  if (!legacy || !Array.isArray(legacy) || legacy.length === 0) return;

  const sorted = [...legacy].sort(sortByScore).slice(0, MAX_ENTRIES);
  for (const row of sorted) {
    await redis.zadd(SCORES_ZKEY, { score: row.score, member: row.userId });
    await redis.set(metaKey(row.userId), {
      userName: row.userName,
      userImage: row.userImage,
      stage: row.stage,
      plane: row.plane,
      updatedAt: row.updatedAt,
    });
  }
}

export async function loadLeaderboard(
  limit = DEFAULT_LIMIT,
  plane?: GamePlane
): Promise<LeaderboardResult> {
  const redis = getRedis();
  if (!redis) return { scores: [], totalPlayers: 0 };

  await migrateLegacyList(redis);

  const zkey = plane ? planeZKey(plane) : SCORES_ZKEY;
  const capped = Math.min(Math.max(1, limit), 50);
  const totalPlayers = (await redis.zcard(zkey)) ?? 0;
  const rows = await redis.zrange(zkey, 0, capped - 1, {
    rev: true,
    withScores: true,
  });

  const scores: RankedScoreRecord[] = [];
  if (!rows || !Array.isArray(rows)) {
    return { scores, totalPlayers };
  }

  for (let i = 0; i < rows.length; i += 2) {
    const userId = String(rows[i]);
    const score = Number(rows[i + 1]);
    if (!userId || !Number.isFinite(score)) continue;
    const meta = plane
      ? await loadPlaneMeta(redis, plane, userId, score)
      : await loadMeta(redis, userId, score);
    if (!meta) continue;
    scores.push({ ...meta, rank: scores.length + 1 });
  }

  return { scores, totalPlayers };
}

export async function getUserRank(userId: string): Promise<UserRankResult> {
  const redis = getRedis();
  if (!redis) return { rank: null, record: null };

  await migrateLegacyList(redis);

  const rankIndex = await redis.zrevrank(SCORES_ZKEY, userId);
  if (rankIndex === null || rankIndex === undefined) {
    return { rank: null, record: null };
  }

  const score = await redis.zscore(SCORES_ZKEY, userId);
  if (score === null || score === undefined) {
    return { rank: null, record: null };
  }

  const meta = await loadMeta(redis, userId, Number(score));
  if (!meta) return { rank: null, record: null };

  return {
    rank: rankIndex + 1,
    record: { ...meta, rank: rankIndex + 1 },
  };
}

export async function getUserPlaneRank(
  userId: string,
  plane: GamePlane
): Promise<UserRankResult> {
  const redis = getRedis();
  if (!redis) return { rank: null, record: null };

  const zkey = planeZKey(plane);
  const rankIndex = await redis.zrevrank(zkey, userId);
  if (rankIndex === null || rankIndex === undefined) {
    return { rank: null, record: null };
  }

  const score = await redis.zscore(zkey, userId);
  if (score === null || score === undefined) {
    return { rank: null, record: null };
  }

  const meta = await loadPlaneMeta(redis, plane, userId, Number(score));
  if (!meta) return { rank: null, record: null };

  return {
    rank: rankIndex + 1,
    record: { ...meta, rank: rankIndex + 1 },
  };
}

async function upsertPlaneScore(entry: ScoreRecord): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return false;

  const zkey = planeZKey(entry.plane);
  const current = await redis.zscore(zkey, entry.userId);
  if (current !== null && current !== undefined && entry.score <= Number(current)) {
    return false;
  }

  await redis.zadd(zkey, { score: entry.score, member: entry.userId });
  await redis.set(planeMetaKey(entry.plane, entry.userId), {
    userName: entry.userName,
    userImage: entry.userImage,
    stage: entry.stage,
    plane: entry.plane,
    updatedAt: entry.updatedAt,
  });

  const total = (await redis.zcard(zkey)) ?? 0;
  if (total > MAX_ENTRIES) {
    const tail = await redis.zrange(zkey, 0, total - MAX_ENTRIES - 1);
    if (tail && Array.isArray(tail)) {
      for (const userId of tail) {
        await redis.zrem(zkey, String(userId));
        await redis.del(planeMetaKey(entry.plane, String(userId)));
      }
    }
  }

  return true;
}

export async function appendUserHistory(
  userId: string,
  entry: GameHistoryEntry
): Promise<void> {
  const redis = getRedis();
  if (!redis) return;

  const key = historyKey(userId);
  await redis.lpush(key, JSON.stringify(entry));
  await redis.ltrim(key, 0, MAX_HISTORY - 1);
}

export async function loadUserHistory(
  userId: string,
  limit = 20
): Promise<GameHistoryEntry[]> {
  const redis = getRedis();
  if (!redis) return [];

  const capped = Math.min(Math.max(1, limit), MAX_HISTORY);
  const rows = await redis.lrange(historyKey(userId), 0, capped - 1);
  if (!rows || !Array.isArray(rows)) return [];

  const history: GameHistoryEntry[] = [];
  for (const raw of rows) {
    try {
      const parsed =
        typeof raw === "string" ? (JSON.parse(raw) as GameHistoryEntry) : (raw as GameHistoryEntry);
      if (
        typeof parsed.score === "number" &&
        typeof parsed.stage === "number" &&
        (parsed.plane === "spread" || parsed.plane === "laser") &&
        typeof parsed.playedAt === "number"
      ) {
        history.push({
          score: parsed.score,
          stage: parsed.stage,
          plane: parsed.plane,
          durationMs: parsed.durationMs ?? 0,
          playedAt: parsed.playedAt,
          globalRank: parsed.globalRank ?? null,
          planeRank: parsed.planeRank ?? null,
        });
      }
    } catch {
      /* skip malformed */
    }
  }
  return history;
}

export async function loadUserProfile(userId: string): Promise<UserProfileSummary> {
  const [global, spread, laser, history] = await Promise.all([
    getUserRank(userId),
    getUserPlaneRank(userId, "spread"),
    getUserPlaneRank(userId, "laser"),
    loadUserHistory(userId, 30),
  ]);

  return {
    globalRank: global.rank,
    globalRecord: global.record,
    planeRanks: {
      spread: { rank: spread.rank, record: spread.record },
      laser: { rank: laser.rank, record: laser.record },
    },
    history,
  };
}

export async function recordGameRun(entry: ScoreRecord & { durationMs: number }): Promise<{
  globalSaved: boolean;
  planeSaved: boolean;
  globalRank: number | null;
  planeRank: number | null;
  historyEntry: GameHistoryEntry | null;
}> {
  const redis = getRedis();
  if (!redis) {
    return {
      globalSaved: false,
      planeSaved: false,
      globalRank: null,
      planeRank: null,
      historyEntry: null,
    };
  }

  const globalResult = await upsertScore(entry);
  const planeSaved = await upsertPlaneScore(entry);

  const [global, plane] = await Promise.all([
    getUserRank(entry.userId),
    getUserPlaneRank(entry.userId, entry.plane),
  ]);

  const historyEntry: GameHistoryEntry = {
    score: entry.score,
    stage: entry.stage,
    plane: entry.plane,
    durationMs: entry.durationMs,
    playedAt: entry.updatedAt,
    globalRank: global.rank,
    planeRank: plane.rank,
  };

  await appendUserHistory(entry.userId, historyEntry);

  return {
    globalSaved: globalResult.saved,
    planeSaved,
    globalRank: global.rank,
    planeRank: plane.rank,
    historyEntry,
  };
}

export async function upsertScore(entry: ScoreRecord): Promise<{
  saved: boolean;
  record: RankedScoreRecord | null;
}> {
  const redis = getRedis();
  if (!redis) return { saved: false, record: null };

  await migrateLegacyList(redis);

  const current = await redis.zscore(SCORES_ZKEY, entry.userId);
  if (current !== null && current !== undefined && entry.score <= Number(current)) {
    const existing = await getUserRank(entry.userId);
    return { saved: false, record: existing.record };
  }

  await redis.zadd(SCORES_ZKEY, { score: entry.score, member: entry.userId });
  await redis.set(metaKey(entry.userId), {
    userName: entry.userName,
    userImage: entry.userImage,
    stage: entry.stage,
    plane: entry.plane,
    updatedAt: entry.updatedAt,
  });

  const total = (await redis.zcard(SCORES_ZKEY)) ?? 0;
  if (total > MAX_ENTRIES) {
    const tail = await redis.zrange(SCORES_ZKEY, 0, total - MAX_ENTRIES - 1);
    if (tail && Array.isArray(tail)) {
      for (const userId of tail) {
        await redis.zrem(SCORES_ZKEY, String(userId));
        await redis.del(metaKey(String(userId)));
      }
    }
  }

  const ranked = await getUserRank(entry.userId);
  return { saved: true, record: ranked.record };
}
