"use client";

/**
 * Global visibility change manager.
 *
 * Instead of N useCameraStream hooks each registering their own
 * document.addEventListener("visibilitychange"), we use a single
 * listener that dispatches to all registered callbacks.
 *
 * This prevents N simultaneous reconnect attempts when the user
 * switches tabs or returns from background on mobile.
 */

const listeners = new Map<string, () => void>();
let registered = false;

function handleVisibility() {
  if (document.hidden) return;
  listeners.forEach((cb) => cb());
}

export function onVisibleOnce(id: string, cb: () => void) {
  listeners.set(id, cb);
  if (!registered) {
    document.addEventListener("visibilitychange", handleVisibility);
    registered = true;
  }
}

export function removeVisibleListener(id: string) {
  listeners.delete(id);
  if (listeners.size === 0 && registered) {
    document.removeEventListener("visibilitychange", handleVisibility);
    registered = false;
  }
}
