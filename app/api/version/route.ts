import { GAME_VERSION } from "@/lib/version";
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    { version: GAME_VERSION },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
        Pragma: "no-cache",
      },
    }
  );
}
