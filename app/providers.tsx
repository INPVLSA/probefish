"use client";

import { HotkeyProvider } from "@/lib/hotkeys";

export function Providers({ children }: { children: React.ReactNode }) {
  return <HotkeyProvider>{children}</HotkeyProvider>;
}
