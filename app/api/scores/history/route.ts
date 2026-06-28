import { auth } from "@/auth";
import { loadUserProfile, scoresStorageReady } from "@/lib/scores";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const cloudEnabled = scoresStorageReady();
  if (!cloudEnabled) {
    return NextResponse.json({
      cloudEnabled: false,
      profile: null,
    });
  }

  const profile = await loadUserProfile(session.user.id);

  return NextResponse.json({
    cloudEnabled: true,
    profile,
  });
}
