import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sky Strike",
  description: "Simple 2D airplane shooter",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
