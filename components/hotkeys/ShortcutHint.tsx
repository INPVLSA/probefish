"use client";

import { cn } from "@/lib/utils";

function formatShortcut(keys: string): string {
  const isMac =
    typeof navigator !== "undefined" && navigator.platform.includes("Mac");
  return keys
    .replace("mod", isMac ? "\u2318" : "Ctrl")
    .replace(/\+/g, "")
    .replace("enter", "\u21B5")
    .replace("/", "?")
    .toUpperCase();
}

interface ShortcutHintProps {
  keys: string;
  className?: string;
  absolute?: boolean;
}

export function ShortcutHint({ keys, className, absolute }: ShortcutHintProps) {
  return (
    <kbd
      className={cn(
        "text-[10px] font-mono text-gray-800 dark:text-white bg-white dark:bg-gray-800 px-1 py-0.5 rounded",
        absolute ? "absolute right-3 top-1/2 -translate-y-1/2" : "ml-2",
        className
      )}
    >
      {formatShortcut(keys)}
    </kbd>
  );
}
