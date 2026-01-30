"use client";

import { cn } from "@/lib/utils";
import { Command } from "lucide-react";

function formatShortcut(keys: string): { hasMod: boolean; rest: string } {
  const isMac =
    typeof navigator !== "undefined" && navigator.platform.includes("Mac");
  const hasMod = keys.includes("mod");
  const rest = keys
    .replace("mod", "")
    .replace(/\+/g, "")
    .replace("enter", "\u21B5")
    .replace("/", "?")
    .toUpperCase();
  return { hasMod: hasMod && isMac, rest };
}

interface ShortcutHintProps {
  keys: string;
  className?: string;
  absolute?: boolean;
}

export function ShortcutHint({ keys, className, absolute }: ShortcutHintProps) {
  const { hasMod, rest } = formatShortcut(keys);
  return (
    <kbd
      className={cn(
        "text-[10px] font-mono text-gray-800 dark:text-white bg-white dark:bg-gray-800 px-1 py-0.5 rounded inline-flex items-center gap-0.5",
        absolute ? "absolute right-3 top-1/2 -translate-y-1/2" : "ml-2",
        className
      )}
    >
      {hasMod && <Command className="!h-[9px] !w-[9px] shrink-0 -mt-px" style={{ height: 9, width: 9 }} />}
      {!hasMod && keys.includes("mod") && "Ctrl"}
      {rest}
    </kbd>
  );
}
