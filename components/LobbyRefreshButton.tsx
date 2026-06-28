"use client";

import { useCallback, useState } from "react";
import { fetchLatestVersion, reloadForLatestDeploy } from "@/lib/reloadForUpdate";

type LobbyRefreshButtonProps = {
  currentVersion: string;
};

export function LobbyRefreshButton({ currentVersion }: LobbyRefreshButtonProps) {
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  const onRefresh = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setHint(null);

    try {
      const latest = await fetchLatestVersion();
      if (latest && latest !== currentVersion) {
        setHint(`v${latest} 받는 중…`);
      } else {
        setHint("최신 확인 중…");
      }
      await reloadForLatestDeploy();
    } catch {
      setBusy(false);
      setHint("새로고침 실패");
      window.setTimeout(() => setHint(null), 1600);
    }
  }, [busy, currentVersion]);

  return (
    <div className="lobby-screen__toolbar-item">
      <button
        type="button"
        className={`lobby-screen__toolbar-btn${busy ? " lobby-screen__toolbar-btn--busy" : ""}`}
        onClick={() => void onRefresh()}
        disabled={busy}
        aria-label="최신 배포 버전 새로고침"
        title="최신 버전 새로고침"
      >
        <svg
          className="lobby-screen__toolbar-icon"
          viewBox="0 0 24 24"
          width="20"
          height="20"
          aria-hidden
        >
          <path
            fill="currentColor"
            d="M17.65 6.35A7.958 7.958 0 0 0 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08a5.99 5.99 0 0 1-5.65 4c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"
          />
        </svg>
      </button>
      {hint ? <span className="lobby-screen__toolbar-hint">{hint}</span> : null}
    </div>
  );
}
