import { Suspense } from "react";
import { SharedResultBanner } from "@/components/SharedResultBanner";

export function SharedResultBannerLoader() {
  return (
    <Suspense fallback={null}>
      <SharedResultBanner />
    </Suspense>
  );
}
