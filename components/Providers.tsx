"use client";

import { SessionProvider } from "next-auth/react";
import { PwaRegistrar } from "@/components/PwaRegistrar";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <PwaRegistrar />
      {children}
    </SessionProvider>
  );
}
