"use client";

import { useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useHotkeyContext } from "@/lib/hotkeys";
import { Keyboard } from "lucide-react";

function formatShortcut(keys: string): string {
  const isMac =
    typeof navigator !== "undefined" && navigator.platform.includes("Mac");
  return keys
    .replace("mod", isMac ? "\u2318" : "Ctrl")
    .replace(/\+/g, " + ")
    .replace("enter", "\u21B5")
    .replace("/", "?");
}

export function HotkeyHelpOverlay() {
  const { isHelpOverlayOpen, closeHelpOverlay, getHotkeyDefinitions } =
    useHotkeyContext();

  const definitions = getHotkeyDefinitions();

  // Group by category
  const grouped = useMemo(() => {
    return definitions.reduce(
      (acc, def) => {
        if (!acc[def.category]) acc[def.category] = [];
        acc[def.category].push(def);
        return acc;
      },
      {} as Record<string, typeof definitions>
    );
  }, [definitions]);

  return (
    <Dialog
      open={isHelpOverlayOpen}
      onOpenChange={(open) => !open && closeHelpOverlay()}
    >
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            Keyboard Shortcuts
          </DialogTitle>
          <DialogDescription>
            Use these shortcuts to navigate and perform actions quickly
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {Object.entries(grouped).map(([category, items]) => (
              <div key={category}>
                <h3 className="font-medium text-sm mb-2">{category}</h3>
                <div className="space-y-1">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-muted-foreground">
                        {item.description}
                      </span>
                      <kbd className="bg-muted px-2 py-0.5 rounded text-xs font-mono ml-2 shrink-0">
                        {formatShortcut(item.keys)}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
