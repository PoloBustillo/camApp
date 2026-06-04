"use client";

import { useEffect } from "react";

export type ShortcutAction =
  | "grid-1x1"
  | "grid-2x2"
  | "grid-3x3"
  | "grid-4x4"
  | "fullscreen"
  | "help"
  | "escape";

interface UseKeyboardShortcutsOptions {
  onAction: (action: ShortcutAction) => void;
  /** Set false to disable (e.g., when modal is open) */
  enabled?: boolean;
}

const KEY_MAP: Record<string, ShortcutAction> = {
  "1": "grid-1x1",
  "4": "grid-2x2",
  "9": "grid-3x3",
  "0": "grid-4x4",
  f: "fullscreen",
  F: "fullscreen",
  "?": "help",
  Escape: "escape",
};

export function useKeyboardShortcuts({
  onAction,
  enabled = true,
}: UseKeyboardShortcutsOptions) {
  useEffect(() => {
    if (!enabled) return;

    function handler(e: KeyboardEvent) {
      // Don't fire when typing in inputs
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      const action = KEY_MAP[e.key];
      if (action) {
        if (action !== "escape") e.preventDefault();
        onAction(action);
      }
    }

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [enabled, onAction]);
}
