import { auth } from "@/auth";
import { loadLeaderboard, scoresStorageReady, upsertScore } from "@/lib/scores";
import { NextResponse } from "next/server";

export async function GET() {
  const scores = await loadLeaderboard(10);
  return NextResponse.json({
    scores,
    cloudEnabled: scoresStorageReady(),
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

  const { score, stage, plane } = body as {
    score?: unknown;
    stage?: unknown;
    plane?: unknown;
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

  if (!scoresStorageReady()) {
    return NextResponse.json({
      saved: false,
      cloudEnabled: false,
      message: "클라우드 랭킹 저장소가 설정되지 않았습니다.",
    });
  }

  const saved = await upsertScore({
    userId: session.user.id,
    userName: session.user.name ?? "Pilot",
    userImage: session.user.image ?? undefined,
    score: Math.floor(score),
    stage: Math.floor(stage),
    plane,
    updatedAt: Date.now(),
  });

  return NextResponse.json({
    saved: Boolean(saved),
    cloudEnabled: true,
    score: saved,
  });
}
