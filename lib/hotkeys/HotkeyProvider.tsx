"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  ReactNode,
  useEffect,
} from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { HotkeyContextValue, HotkeyScope, HotkeyDefinition } from "./types";
import { hotkeyDefinitions } from "./hotkey-definitions";
import { CommandPalette } from "@/components/hotkeys/CommandPalette";
import { HotkeyHelpOverlay } from "@/components/hotkeys/HotkeyHelpOverlay";

const HotkeyContext = createContext<HotkeyContextValue | null>(null);

export function useHotkeyContext() {
  const ctx = useContext(HotkeyContext);
  if (!ctx) {
    throw new Error("useHotkeyContext must be used within HotkeyProvider");
  }
  return ctx;
}

// Check if event target is inside Monaco Editor
function isInsideMonaco(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  return !!target.closest(".monaco-editor");
}

interface HotkeyProviderProps {
  children: ReactNode;
}

export function HotkeyProvider({ children }: HotkeyProviderProps) {
  const [activeScopes, setActiveScopes] = useState<Set<HotkeyScope>>(
    () => new Set(["global"])
  );
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isHelpOverlayOpen, setIsHelpOverlayOpen] = useState(false);

  // Store registered actions
  const actionsRef = useRef<Map<string, () => void | Promise<void>>>(new Map());

  const registerAction = useCallback(
    (id: string, action: () => void | Promise<void>) => {
      actionsRef.current.set(id, action);
    },
    []
  );

  const unregisterAction = useCallback((id: string) => {
    actionsRef.current.delete(id);
  }, []);

  const addScope = useCallback((scope: HotkeyScope) => {
    setActiveScopes((prev) => new Set([...prev, scope]));
  }, []);

  const removeScope = useCallback((scope: HotkeyScope) => {
    setActiveScopes((prev) => {
      const next = new Set(prev);
      next.delete(scope);
      return next;
    });
  }, []);

  const openCommandPalette = useCallback(() => setIsCommandPaletteOpen(true), []);
  const closeCommandPalette = useCallback(() => setIsCommandPaletteOpen(false), []);
  const openHelpOverlay = useCallback(() => setIsHelpOverlayOpen(true), []);
  const closeHelpOverlay = useCallback(() => setIsHelpOverlayOpen(false), []);

  const getHotkeyDefinitions = useCallback(() => hotkeyDefinitions, []);

  const executeAction = useCallback((id: string) => {
    const action = actionsRef.current.get(id);
    if (action) {
      action();
    }
  }, []);

  // Check if a hotkey's scope is currently active
  const isScopeActive = useCallback(
    (scope: HotkeyScope) => activeScopes.has(scope),
    [activeScopes]
  );

  // Common hotkey options
  const hotkeyOptions = {
    enableOnFormTags: false,
    enableOnContentEditable: false,
    preventDefault: true,
  };

  // Global hotkeys - always active
  useHotkeys(
    "mod+k",
    (e) => {
      if (isInsideMonaco(e.target)) return;
      openCommandPalette();
    },
    hotkeyOptions
  );

  useHotkeys(
    "mod+/",
    (e) => {
      if (isInsideMonaco(e.target)) return;
      openHelpOverlay();
    },
    hotkeyOptions
  );

  useHotkeys(
    "mod+s",
    (e) => {
      if (isInsideMonaco(e.target)) return;
      executeAction("save-item");
    },
    hotkeyOptions
  );

  // Test suite scoped hotkeys
  useHotkeys(
    "mod+enter",
    (e) => {
      if (isInsideMonaco(e.target)) return;
      if (!isScopeActive("test-suite")) return;
      executeAction("run-tests");
    },
    { ...hotkeyOptions, enableOnFormTags: true }
  );

  // Tab navigation (mod+1 through mod+6)
  useHotkeys(
    "mod+1",
    (e) => {
      if (isInsideMonaco(e.target)) return;
      if (!isScopeActive("test-suite")) return;
      executeAction("nav-tab-1");
    },
    hotkeyOptions
  );

  useHotkeys(
    "mod+2",
    (e) => {
      if (isInsideMonaco(e.target)) return;
      if (!isScopeActive("test-suite")) return;
      executeAction("nav-tab-2");
    },
    hotkeyOptions
  );

  useHotkeys(
    "mod+3",
    (e) => {
      if (isInsideMonaco(e.target)) return;
      if (!isScopeActive("test-suite")) return;
      executeAction("nav-tab-3");
    },
    hotkeyOptions
  );

  useHotkeys(
    "mod+4",
    (e) => {
      if (isInsideMonaco(e.target)) return;
      if (!isScopeActive("test-suite")) return;
      executeAction("nav-tab-4");
    },
    hotkeyOptions
  );

  useHotkeys(
    "mod+5",
    (e) => {
      if (isInsideMonaco(e.target)) return;
      if (!isScopeActive("test-suite")) return;
      executeAction("nav-tab-5");
    },
    hotkeyOptions
  );

  useHotkeys(
    "mod+6",
    (e) => {
      if (isInsideMonaco(e.target)) return;
      if (!isScopeActive("test-suite")) return;
      executeAction("nav-tab-6");
    },
    hotkeyOptions
  );

  const value: HotkeyContextValue = {
    registerAction,
    unregisterAction,
    activeScopes,
    addScope,
    removeScope,
    isCommandPaletteOpen,
    openCommandPalette,
    closeCommandPalette,
    isHelpOverlayOpen,
    openHelpOverlay,
    closeHelpOverlay,
    getHotkeyDefinitions,
    executeAction,
  };

  return (
    <HotkeyContext.Provider value={value}>
      {children}
      <CommandPalette />
      <HotkeyHelpOverlay />
    </HotkeyContext.Provider>
  );
}
