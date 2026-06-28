"use client";

import { LobbyInstallButton } from "@/components/LobbyInstallButton";
import { LobbyProfileButton } from "@/components/LobbyProfileButton";
import { LobbyRefreshButton } from "@/components/LobbyRefreshButton";
import { LobbyShareButton } from "@/components/LobbyShareButton";

type LobbyTopBarProps = {
  currentVersion: string;
  onOpenProfile: () => void;
};

export function LobbyTopBar({ currentVersion, onOpenProfile }: LobbyTopBarProps) {
  return (
    <div className="lobby-screen__top-bar">
      <LobbyProfileButton onOpenProfile={onOpenProfile} />
      <div className="lobby-screen__top-actions">
        <LobbyShareButton />
        <LobbyInstallButton />
        <LobbyRefreshButton currentVersion={currentVersion} />
      </div>
    </div>
  );
}
