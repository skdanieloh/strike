"use client";

import { useCallback, useEffect, useState } from "react";
import {
  isAndroid,
  isIOS,
  isStandaloneMode,
  type BeforeInstallPromptEvent,
} from "@/lib/pwa";

export type InstallResult =
  | { status: "accepted" }
  | { status: "dismissed" }
  | { status: "ios-guide" }
  | { status: "unavailable"; message: string };

export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    setIsStandalone(isStandaloneMode());

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    const onDisplayMode = () => {
      setIsStandalone(isStandaloneMode());
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.matchMedia("(display-mode: standalone)").addEventListener("change", onDisplayMode);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.matchMedia("(display-mode: standalone)").removeEventListener("change", onDisplayMode);
    };
  }, []);

  const install = useCallback(async (): Promise<InstallResult> => {
    if (isStandaloneMode()) {
      return { status: "unavailable", message: "이미 앱으로 실행 중입니다." };
    }

    if (isIOS()) {
      return { status: "ios-guide" };
    }

    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      return outcome === "accepted" ? { status: "accepted" } : { status: "dismissed" };
    }

    if (isAndroid()) {
      return {
        status: "unavailable",
        message: "설치 창을 불러오는 중입니다. 잠시 후 다시 눌러 주세요.",
      };
    }

    return { status: "unavailable", message: "이 기기에서는 앱 설치를 지원하지 않습니다." };
  }, [deferredPrompt]);

  return {
    install,
    isStandalone,
    canAndroidPrompt: Boolean(deferredPrompt),
  };
}
