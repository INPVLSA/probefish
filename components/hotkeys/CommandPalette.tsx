"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useHotkeyContext } from "@/lib/hotkeys";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface CommandItem {
  id: string;
  label: string;
  shortcut: string;
  category: string;
}

function formatShortcut(keys: string): string {
  const isMac =
    typeof navigator !== "undefined" && navigator.platform.includes("Mac");
  return keys
    .replace("mod", isMac ? "\u2318" : "Ctrl")
    .replace(/\+/g, " + ")
    .replace("enter", "\u21B5")
    .replace("/", "?");
}

export function CommandPalette() {
  const {
    isCommandPaletteOpen,
    closeCommandPalette,
    getHotkeyDefinitions,
    executeAction,
    activeScopes,
  } = useHotkeyContext();
  const [search, setSearch] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  // Build command list from hotkey definitions
  const commands = useMemo(() => {
    const definitions = getHotkeyDefinitions();
    return definitions
      .filter((def) => activeScopes.has(def.scope))
      .map((def) => ({
        id: def.id,
        label: def.description,
        shortcut: def.keys,
        category: def.category,
      }));
  }, [getHotkeyDefinitions, activeScopes]);

  // Filter commands based on search
  const filteredCommands = useMemo(() => {
    if (!search) return commands;
    const lower = search.toLowerCase();
    return commands.filter(
      (cmd) =>
        cmd.label.toLowerCase().includes(lower) ||
        cmd.category.toLowerCase().includes(lower)
    );
  }, [commands, search]);

  // Reset state when opening/closing
  useEffect(() => {
    if (isCommandPaletteOpen) {
      setSearch("");
      setSelectedIndex(0);
    }
  }, [isCommandPaletteOpen]);

  // Reset selection when filtered commands change
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredCommands.length]);

  const handleSelect = useCallback(
    (cmd: CommandItem) => {
      closeCommandPalette();
      executeAction(cmd.id);
    },
    [closeCommandPalette, executeAction]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) =>
          i < filteredCommands.length - 1 ? i + 1 : 0
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) =>
          i > 0 ? i - 1 : filteredCommands.length - 1
        );
      } else if (e.key === "Enter" && filteredCommands[selectedIndex]) {
        e.preventDefault();
        handleSelect(filteredCommands[selectedIndex]);
      }
    },
    [filteredCommands, selectedIndex, handleSelect]
  );

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const selectedEl = listRef.current.querySelector(
        `[data-index="${selectedIndex}"]`
      );
      selectedEl?.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  // Group commands by category
  const groupedCommands = useMemo(() => {
    const groups: Record<string, CommandItem[]> = {};
    filteredCommands.forEach((cmd) => {
      if (!groups[cmd.category]) groups[cmd.category] = [];
      groups[cmd.category].push(cmd);
    });
    return groups;
  }, [filteredCommands]);

  // Get flat index for a command
  const getFlatIndex = (cmd: CommandItem) => filteredCommands.indexOf(cmd);

  return (
    <Dialog
      open={isCommandPaletteOpen}
      onOpenChange={(open) => !open && closeCommandPalette()}
    >
      <DialogContent
        className="max-w-lg p-0 overflow-hidden gap-0"
        showCloseButton={false}
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center border-b px-3">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Type a command or search..."
            className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
            autoFocus
          />
        </div>
        <div ref={listRef} className="max-h-[300px] overflow-y-auto p-2">
          {filteredCommands.length === 0 ? (
            <div className="px-2 py-4 text-center text-sm text-muted-foreground">
              No commands found
            </div>
          ) : (
            Object.entries(groupedCommands).map(([category, items]) => (
              <div key={category} className="mb-2">
                <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
                  {category}
                </div>
                {items.map((cmd) => {
                  const flatIndex = getFlatIndex(cmd);
                  return (
                    <button
                      key={cmd.id}
                      data-index={flatIndex}
                      onClick={() => handleSelect(cmd)}
                      className={cn(
                        "w-full flex items-center justify-between px-2 py-1.5 rounded-md text-sm transition-colors",
                        flatIndex === selectedIndex
                          ? "bg-accent text-accent-foreground"
                          : "hover:bg-muted"
                      )}
                    >
                      <span>{cmd.label}</span>
                      <kbd className="text-xs bg-muted-foreground/10 px-1.5 py-0.5 rounded font-mono">
                        {formatShortcut(cmd.shortcut)}
                      </kbd>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
