"use client";

import { signIn, useSession } from "next-auth/react";

type LobbyProfileButtonProps = {
  onOpenProfile: () => void;
};

export function LobbyProfileButton({ onOpenProfile }: LobbyProfileButtonProps) {
  const { data: session, status } = useSession();
  const loading = status === "loading";

  if (loading) {
    return (
      <button
        type="button"
        className="lobby-screen__toolbar-btn lobby-screen__toolbar-btn--profile"
        disabled
        aria-label="로그인 확인 중"
      >
        <span className="lobby-screen__profile-fallback" aria-hidden>
          …
        </span>
      </button>
    );
  }

  if (!session?.user) {
    return (
      <button
        type="button"
        className="lobby-screen__toolbar-btn lobby-screen__toolbar-btn--profile"
        onClick={() => signIn("google")}
        aria-label="Google로 로그인"
        title="로그인"
      >
        <svg className="lobby-screen__toolbar-icon" viewBox="0 0 24 24" width="20" height="20" aria-hidden>
          <path
            fill="currentColor"
            d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"
          />
        </svg>
      </button>
    );
  }

  const { user } = session;

  return (
    <button
      type="button"
      className="lobby-screen__toolbar-btn lobby-screen__toolbar-btn--profile"
      onClick={onOpenProfile}
      aria-label={`${user.name ?? "Pilot"} 프로필`}
      title={user.name ?? "프로필"}
    >
      {user.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="lobby-screen__profile-avatar" src={user.image} alt="" width={32} height={32} />
      ) : (
        <span className="lobby-screen__profile-fallback" aria-hidden>
          ✈
        </span>
      )}
    </button>
  );
}
