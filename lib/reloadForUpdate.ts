export async function fetchLatestVersion(): Promise<string | null> {
  try {
    const res = await fetch(`/api/version?_=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as { version?: unknown };
    return typeof data.version === "string" ? data.version : null;
  } catch {
    return null;
  }
}

/** 캐시·SW를 비우고 최신 배포본을 다시 불러옵니다. */
export async function reloadForLatestDeploy(): Promise<void> {
  if ("serviceWorker" in navigator) {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map((r) => r.unregister()));
  }

  if ("caches" in window) {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
  }

  const url = new URL(window.location.href);
  url.searchParams.set("_refresh", Date.now().toString());
  url.hash = "";
  window.location.replace(url.toString());
}
