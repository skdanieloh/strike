"use client";

import { useEffect } from "react";

export function PwaRegistrar() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register("/sw.js").catch(() => {
      /* 설치 프롬프트만 목적 — 등록 실패는 무시 */
    });
  }, []);

  return null;
}
