"use client";

import { useCallback, useState } from "react";
import { IosInstallGuideSheet } from "@/components/IosInstallGuideSheet";
import { usePwaInstall } from "@/hooks/usePwaInstall";
import { shouldOfferInstall } from "@/lib/pwa";

export function LobbyInstallButton() {
  const { install, isStandalone, canAndroidPrompt } = usePwaInstall();
  const [iosGuideOpen, setIosGuideOpen] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  const visible = shouldOfferInstall(isStandalone, canAndroidPrompt);

  const showHint = (message: string) => {
    setHint(message);
    window.setTimeout(() => setHint(null), 2200);
  };

  const onInstall = useCallback(async () => {
    const result = await install();

    switch (result.status) {
      case "ios-guide":
        setIosGuideOpen(true);
        break;
      case "accepted":
        showHint("앱이 설치되었습니다!");
        break;
      case "dismissed":
        showHint("설치를 취소했습니다.");
        break;
      case "unavailable":
        showHint(result.message);
        break;
    }
  }, [install]);

  if (!visible) return null;

  return (
    <>
      <div className="lobby-screen__toolbar-item">
        <button
          type="button"
          className="lobby-screen__toolbar-btn"
          onClick={() => void onInstall()}
          aria-label="앱 설치"
          title="앱 설치"
        >
          <svg className="lobby-screen__toolbar-icon" viewBox="0 0 24 24" width="20" height="20" aria-hidden>
            <path
              fill="currentColor"
              d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"
            />
          </svg>
        </button>
        {hint ? <span className="lobby-screen__toolbar-hint">{hint}</span> : null}
      </div>

      <IosInstallGuideSheet open={iosGuideOpen} onClose={() => setIosGuideOpen(false)} />
    </>
  );
}
