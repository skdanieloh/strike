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
const MAX_ENTRIES = 100;
const DEFAULT_LIMIT = 20;

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

function metaKey(userId: string): string {
  return `${META_PREFIX}${userId}`;
}

export function scoresStorageReady(): boolean {
  return getRedis() !== null;
}

function sortByScore(a: ScoreRecord, b: ScoreRecord): number {
  if (b.score !== a.score) return b.score - a.score;
  if (b.stage !== a.stage) return b.stage - a.stage;
  return a.updatedAt - b.updatedAt;
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

export async function loadLeaderboard(limit = DEFAULT_LIMIT): Promise<LeaderboardResult> {
  const redis = getRedis();
  if (!redis) return { scores: [], totalPlayers: 0 };

  await migrateLegacyList(redis);

  const capped = Math.min(Math.max(1, limit), 50);
  const totalPlayers = (await redis.zcard(SCORES_ZKEY)) ?? 0;
  const rows = await redis.zrange(SCORES_ZKEY, 0, capped - 1, {
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
    const meta = await loadMeta(redis, userId, score);
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
