import type { PlayerState } from "@/types/game.types";

const KEY = "lifeline-save-v1";

export interface SaveData {
  v: 1;
  player: PlayerState;
  rngState: number;
}

// Tiny external store so React can read "is there a save?" without setState-in-effect.
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
export const subscribeSave = (cb: () => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};
export const hasSaveSnapshot = () => loadGame() !== null;

export function saveGame(player: PlayerState, rngState: number) {
  try {
    const data: SaveData = { v: 1, player, rngState };
    localStorage.setItem(KEY, JSON.stringify(data));
    notify();
  } catch {
    /* storage may be unavailable (private mode / quota) */
  }
}

export function loadGame(): SaveData | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as SaveData;
    if (data.v !== 1 || typeof data.player?.age !== "number" || !Array.isArray(data.player.relatives)) return null;
    return data;
  } catch {
    return null;
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(KEY);
    notify();
  } catch {
    /* ignore */
  }
}
