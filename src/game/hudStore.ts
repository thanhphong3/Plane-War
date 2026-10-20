import { PerkId } from '../types/game';

/** Live numbers the HUD shows; published by the game loop a few times per second. */
export interface HudSnapshot {
  score: number;
  combo: number;
  comboTimer: number;
  shards: number;
  waveLevel: number;
  timedRemaining: number;
  feverEnergy: number;
  isFeverActive: boolean;
  shieldCount: number;
  magnetTimer: number;
  slowFieldTimer: number;
  empBombs: number;
  weaponLevel: number;
  dashCooldown: number;
  dashMaxCooldown: number;
  dashHint: boolean;
  bossHp: number;
  bossName: string;
  bossStatus: string;
  stageProgress: number;
  questProgress: number;
  /** Tactical Perks installed this run. */
  perks: PerkId[];
  /** Kinetic Capacitor charge 0..1, or -1 without that perk. */
  grazeCharge: number;
  /** Boss Rush: current boss number (1-based), -1 outside Boss Rush. */
  bossRush: number;
}

/**
 * Tiny external store so only the HUD re-renders on each sync,
 * instead of the whole game component tree.
 */
export function createHudStore(initial: HudSnapshot) {
  let snapshot = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => snapshot,
    set(next: HudSnapshot) {
      snapshot = next;
      listeners.forEach((l) => l());
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export type HudStore = ReturnType<typeof createHudStore>;
