"use client";

import { signIn, signOut, useSession } from "next-auth/react";

type AuthBarProps = {
  compact?: boolean;
  onOpenProfile?: () => void;
};

export function AuthBar({ compact = false, onOpenProfile }: AuthBarProps) {
  const { data: session, status } = useSession();
  const loading = status === "loading";

  if (loading) {
    return (
      <div className={`auth-bar${compact ? " auth-bar--compact" : ""}`}>
        <span className="auth-bar__status">로그인 확인 중…</span>
      </div>
    );
  }

  if (!session?.user) {
    return (
      <div className={`auth-bar${compact ? " auth-bar--compact" : ""}`}>
        <button
          type="button"
          className="auth-bar__google"
          onClick={() => signIn("google")}
        >
          <GoogleIcon />
          {compact ? "로그인" : "Google로 로그인"}
        </button>
      </div>
    );
  }

  const { user } = session;
  return (
    <div className={`auth-bar${compact ? " auth-bar--compact" : ""}`}>
      <button
        type="button"
        className="auth-bar__profile auth-bar__profile--button"
        onClick={onOpenProfile}
        aria-label="프로필 및 플레이 기록 보기"
      >
        {user.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className="auth-bar__avatar"
            src={user.image}
            alt=""
            width={28}
            height={28}
          />
        ) : (
          <span className="auth-bar__avatar auth-bar__avatar--fallback" aria-hidden>
            ✈
          </span>
        )}
        {!compact && (
          <>
            <span className="auth-bar__name">{user.name ?? "Pilot"}</span>
            {typeof user.bestScore === "number" && (
              <span className="auth-bar__best">최고 {user.bestScore.toLocaleString()}점</span>
            )}
          </>
        )}
      </button>
      {!compact && (
        <button type="button" className="auth-bar__logout" onClick={() => signOut()}>
          로그아웃
        </button>
      )}
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303C33.654 32.657 29.083 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C33.64 6.053 29.082 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
      />
      <path
        fill="#FF3D00"
        d="M6.306 14.691l6.571 4.819C14.655 16.108 18.961 13 24 13c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C33.64 6.053 29.082 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
      />
    </svg>
  );
}
