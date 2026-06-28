"use client";

import { useEffect } from "react";
import { isInAppBrowser, isSafari } from "@/lib/pwa";

type IosInstallGuideSheetProps = {
  open: boolean;
  onClose: () => void;
};

const STEPS = [
  {
    title: "Safari에서 열기",
    body: "Chrome·카카오톡·인스타 등 앱 내 브라우저에서는 홈 화면 추가가 되지 않습니다. 주소창을 길게 눌러「Safari에서 열기」를 선택하거나, 링크를 Safari에 붙여넣어 주세요.",
  },
  {
    title: "공유 버튼 탭",
    body: "Safari 화면 하단 가운데(또는 상단)의 공유 아이콘(□↑)을 눌러 주세요.",
  },
  {
    title: "「홈 화면에 추가」선택",
    body: "아래로 스크롤해「홈 화면에 추가(Add to Home Screen)」항목을 찾아 탭합니다.",
  },
  {
    title: "「추가」로 완료",
    body: "이름이 Sky Strike인지 확인한 뒤 우측 상단「추가」를 누르면 홈 화면에 앱 아이콘이 생성됩니다.",
  },
] as const;

export function IosInstallGuideSheet({ open, onClose }: IosInstallGuideSheetProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const inApp = isInAppBrowser();
  const safari = isSafari();

  return (
    <div className="app-bottom-sheet" role="presentation" onClick={onClose}>
      <div
        className="app-bottom-sheet__panel"
        role="dialog"
        aria-label="iPhone 홈 화면에 추가 안내"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="app-bottom-sheet__handle" aria-hidden />

        <div className="app-bottom-sheet__header">
          <h2 className="app-bottom-sheet__title">iPhone에 앱 설치하기</h2>
          <button type="button" className="app-bottom-sheet__close" onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </div>

        <div className="install-guide">
          <p className="install-guide__lead">
            iPhone/iPad는 Safari의「홈 화면에 추가」로 앱처럼 설치할 수 있습니다. 아래 순서대로
            따라 해 주세요.
          </p>

          {(inApp || !safari) && (
            <p className="install-guide__warn" role="status">
              ⚠️ 지금 브라우저에서는 설치가 어렵습니다. 반드시 <strong>Safari</strong>에서 이
              페이지를 연 뒤 진행해 주세요.
            </p>
          )}

          <ol className="install-guide__steps">
            {STEPS.map((step, index) => (
              <li key={step.title} className="install-guide__step">
                <span className="install-guide__step-num" aria-hidden>
                  {index + 1}
                </span>
                <div className="install-guide__step-body">
                  <strong className="install-guide__step-title">{step.title}</strong>
                  <p className="install-guide__step-text">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>

          <p className="install-guide__tip">
            설치 후 홈 화면의 Sky Strike 아이콘을 누르면 전체 화면으로 게임이 실행됩니다.
          </p>
        </div>
      </div>
    </div>
  );
}
