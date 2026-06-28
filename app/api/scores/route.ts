import { auth } from "@/auth";
import {
  getUserPlaneRank,
  getUserRank,
  loadLeaderboard,
  recordGameRun,
  scoresStorageReady,
  type GamePlane,
} from "@/lib/scores";
import { NextResponse } from "next/server";

function parseLimit(raw: string | null): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 20;
  return Math.min(50, Math.max(1, Math.floor(n)));
}

function parsePlane(raw: string | null): GamePlane | undefined {
  if (raw === "spread" || raw === "laser") return raw;
  return undefined;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const limit = parseLimit(searchParams.get("limit"));
  const plane = parsePlane(searchParams.get("plane"));
  const session = await auth();

  const { scores, totalPlayers } = await loadLeaderboard(limit, plane);
  const cloudEnabled = scoresStorageReady();

  let myRank: number | null = null;
  let myRecord = null;

  if (session?.user?.id && cloudEnabled) {
    const mine = plane
      ? await getUserPlaneRank(session.user.id, plane)
      : await getUserRank(session.user.id);
    myRank = mine.rank;
    myRecord = mine.record;
  }

  return NextResponse.json({
    scores,
    totalPlayers,
    cloudEnabled,
    myRank,
    myRecord,
    plane: plane ?? null,
  });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const { score, stage, plane, durationMs } = body as {
    score?: unknown;
    stage?: unknown;
    plane?: unknown;
    durationMs?: unknown;
  };

  if (typeof score !== "number" || !Number.isFinite(score) || score < 0) {
    return NextResponse.json({ error: "invalid_score" }, { status: 400 });
  }
  if (typeof stage !== "number" || !Number.isFinite(stage) || stage < 1) {
    return NextResponse.json({ error: "invalid_stage" }, { status: 400 });
  }
  if (plane !== "spread" && plane !== "laser") {
    return NextResponse.json({ error: "invalid_plane" }, { status: 400 });
  }

  const playDuration =
    typeof durationMs === "number" && Number.isFinite(durationMs) && durationMs >= 0
      ? Math.floor(durationMs)
      : 0;

  if (!scoresStorageReady()) {
    return NextResponse.json({
      saved: false,
      cloudEnabled: false,
      message: "클라우드 랭킹 저장소가 설정되지 않았습니다.",
    });
  }

  const result = await recordGameRun({
    userId: session.user.id,
    userName: session.user.name ?? "Pilot",
    userImage: session.user.image ?? undefined,
    score: Math.floor(score),
    stage: Math.floor(stage),
    plane,
    updatedAt: Date.now(),
    durationMs: playDuration,
  });

  return NextResponse.json({
    saved: result.globalSaved,
    planeSaved: result.planeSaved,
    historySaved: Boolean(result.historyEntry),
    cloudEnabled: true,
    rank: result.globalRank,
    planeRank: result.planeRank,
    record: result.globalRank
      ? {
          rank: result.globalRank,
          score: Math.floor(score),
          stage: Math.floor(stage),
          plane,
        }
      : null,
  });
}
