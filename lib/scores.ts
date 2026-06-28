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

const SCORES_KEY = "strike:leaderboard";
const MAX_ENTRIES = 100;

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

export function scoresStorageReady(): boolean {
  return getRedis() !== null;
}

export async function loadLeaderboard(limit = 10): Promise<ScoreRecord[]> {
  const redis = getRedis();
  if (!redis) return [];
  const raw = await redis.get<ScoreRecord[]>(SCORES_KEY);
  if (!raw || !Array.isArray(raw)) return [];
  return [...raw].sort((a, b) => b.score - a.score).slice(0, limit);
}

export async function upsertScore(entry: ScoreRecord): Promise<ScoreRecord | null> {
  const redis = getRedis();
  if (!redis) return null;

  const raw = await redis.get<ScoreRecord[]>(SCORES_KEY);
  const list = raw && Array.isArray(raw) ? raw : [];
  const prev = list.find((row) => row.userId === entry.userId);
  if (prev && prev.score >= entry.score) return prev;

  const next = list.filter((row) => row.userId !== entry.userId);
  next.push(entry);
  next.sort((a, b) => b.score - a.score);
  await redis.set(SCORES_KEY, next.slice(0, MAX_ENTRIES));
  return entry;
}
