import { HotkeyDefinition } from "./types";

export const hotkeyDefinitions: HotkeyDefinition[] = [
  // General
  {
    id: "open-command-palette",
    keys: "mod+k",
    description: "Open command palette",
    scope: "global",
    category: "General",
  },
  {
    id: "show-help",
    keys: "mod+/",
    description: "Show keyboard shortcuts",
    scope: "global",
    category: "General",
  },
  {
    id: "save-item",
    keys: "mod+s",
    description: "Save current item",
    scope: "global",
    category: "General",
  },

  // Testing
  {
    id: "run-tests",
    keys: "mod+enter",
    description: "Run tests",
    scope: "test-suite",
    category: "Testing",
  },
  {
    id: "add-test-case",
    keys: "a",
    description: "Add new test case",
    scope: "test-suite",
    category: "Testing",
  },

  // Navigation (test suite tabs)
  {
    id: "nav-tab-1",
    keys: "mod+1",
    description: "Go to Test Cases tab",
    scope: "test-suite",
    category: "Navigation",
  },
  {
    id: "nav-tab-2",
    keys: "mod+2",
    description: "Go to Validation tab",
    scope: "test-suite",
    category: "Navigation",
  },
  {
    id: "nav-tab-3",
    keys: "mod+3",
    description: "Go to LLM Judge tab",
    scope: "test-suite",
    category: "Navigation",
  },
  {
    id: "nav-tab-4",
    keys: "mod+4",
    description: "Go to Settings tab",
    scope: "test-suite",
    category: "Navigation",
  },
  {
    id: "nav-tab-5",
    keys: "mod+5",
    description: "Go to History tab",
    scope: "test-suite",
    category: "Navigation",
  },
  {
    id: "nav-tab-6",
    keys: "mod+6",
    description: "Go to Compare tab",
    scope: "test-suite",
    category: "Navigation",
  },
];
