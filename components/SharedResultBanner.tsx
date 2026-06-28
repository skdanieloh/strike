"use client";

import { useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { parseShareFromSearch, planeLabel } from "@/lib/share";

export function SharedResultBanner() {
  const searchParams = useSearchParams();
  const shared = useMemo(() => {
    const params = new URLSearchParams(searchParams.toString());
    return parseShareFromSearch(params);
  }, [searchParams]);

  if (!shared) return null;

  const who = shared.name ? `${shared.name}님이` : "누군가";

  return (
    <aside className="shared-result" aria-live="polite">
      <p className="shared-result__title">공유된 기록</p>
      <p className="shared-result__body">
        {who} Sky Strike에서{" "}
        <strong>{shared.score.toLocaleString()}점</strong>을 달성했어요!
      </p>
      <p className="shared-result__meta">
        Stage {shared.stage} · {planeLabel(shared.plane)}
      </p>
    </aside>
  );
}
