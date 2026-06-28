export type SharePlane = "spread" | "laser";

export type SharePayload = {
  score: number;
  stage: number;
  plane: SharePlane;
  name?: string;
};

const PLANE_LABEL: Record<SharePlane, string> = {
  spread: "스프레드",
  laser: "레이저",
};

export function planeLabel(plane: SharePlane): string {
  return PLANE_LABEL[plane];
}

export function buildShareText(payload: SharePayload): string {
  const who = payload.name ? `${payload.name}님이` : "나는";
  return `${who} Sky Strike에서 ${payload.score.toLocaleString()}점 달성! (Stage ${payload.stage} · ${planeLabel(payload.plane)})`;
}

export function buildShareUrl(payload: SharePayload, origin?: string): string {
  const base =
    origin ??
    (typeof window !== "undefined" ? window.location.origin : "https://strike-rosy.vercel.app");
  const params = new URLSearchParams({
    s: String(payload.score),
    st: String(payload.stage),
    p: payload.plane,
  });
  if (payload.name) params.set("n", payload.name.slice(0, 32));
  return `${base}/?${params.toString()}`;
}

export function parseShareFromSearch(
  search: string | URLSearchParams
): SharePayload | null {
  const params =
    typeof search === "string" ? new URLSearchParams(search) : search;
  const score = Number(params.get("s"));
  const stage = Number(params.get("st"));
  const plane = params.get("p");
  if (!Number.isFinite(score) || score < 0) return null;
  if (!Number.isFinite(stage) || stage < 1) return null;
  if (plane !== "spread" && plane !== "laser") return null;
  const name = params.get("n")?.trim();
  return {
    score: Math.floor(score),
    stage: Math.floor(stage),
    plane,
    name: name || undefined,
  };
}
