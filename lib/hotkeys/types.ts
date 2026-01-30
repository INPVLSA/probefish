export type HotkeyScope = "global" | "test-suite";

export interface HotkeyDefinition {
  id: string;
  keys: string;
  description: string;
  scope: HotkeyScope;
  category: string;
}

export interface HotkeyContextValue {
  // Action registration
  registerAction: (id: string, action: () => void | Promise<void>) => void;
  unregisterAction: (id: string) => void;

  // Scope management
  activeScopes: Set<HotkeyScope>;
  addScope: (scope: HotkeyScope) => void;
  removeScope: (scope: HotkeyScope) => void;

  // Command palette
  isCommandPaletteOpen: boolean;
  openCommandPalette: () => void;
  closeCommandPalette: () => void;

  // Help overlay
  isHelpOverlayOpen: boolean;
  openHelpOverlay: () => void;
  closeHelpOverlay: () => void;

  // Get definitions for UI
  getHotkeyDefinitions: () => HotkeyDefinition[];

  // Execute action by id
  executeAction: (id: string) => void;
}
