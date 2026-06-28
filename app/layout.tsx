import type { Metadata, Viewport } from "next";
import { Providers } from "@/components/Providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sky Strike",
  description: "2D airplane shooter — 점수를 공유하고 글로벌 랭킹에 도전하세요",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Sky Strike",
  },
  openGraph: {
    title: "Sky Strike",
    description: "2D airplane shooter",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0a0e14",
  /** 노치·홈 인디케이터 영역까지 배경 확장 (safe-area와 함께 사용) */
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
