export type GameMode = 'endless' | 'timed' | 'hardcore';
export type GameState = 'MENU' | 'PLAYING' | 'PAUSED' | 'GAMEOVER';

export interface ShipDef {
  id: string;
  name: string;
  desc: string;
  color: string;
  secondary: string;
  cost: number;
  perk: string;
  icon: string;
  stats: {
    speed: number;
    dashCd: number;
    grazeRadius: number;
    bonusShield?: boolean;
    magnetRange?: number;
    shardMultiplier?: number;
  };
}

export interface UpgradeDef {
  id: 'dashCd' | 'feverDur' | 'shardBonus' | 'shieldCap';
  name: string;
  desc: string;
  baseCost: number;
  maxLevel: number;
  icon: string;
}

export interface QuestDef {
  id: string;
  type: 'nearmiss' | 'combo' | 'dashkill' | 'gems' | 'fever';
  target: number;
  reward: number;
  label: string;
}

export interface AchievementDef {
  id: string;
  title: string;
  desc: string;
  icon: string;
  unlocked: boolean;
  rewardShards: number;
}

export interface SaveData {
  shards: number;
  bestEndless: number;
  bestTimed: number;
  bestHardcore: number;
  bestCombo: number;
  totalRuns: number;
  totalNearMisses: number;
  selectedShip: string;
  unlockedShips: string[];
  upgrades: {
    dashCd: number;
    feverDur: number;
    shardBonus: number;
    shieldCap: number;
  };
  muted: boolean;
  bgmMuted: boolean;
  questIndex: number;
  questProgress: number;
  unlockedAchievements: string[];
}

export interface HazardEntity {
  id: number;
  type: 'drone' | 'seeker' | 'spinner' | 'wave_splitter';
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  angle: number;
  spin?: number;
  speed?: number;
  life?: number;
  color: string;
  grazed: boolean;
}

export interface GemEntity {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  val: number;
  magnetized: boolean;
}

export interface PowerupEntity {
  id: number;
  kind: 'shield' | 'magnet' | 'slow' | 'bomb';
  icon: string;
  color: string;
  label: string;
  x: number;
  y: number;
  vy: number;
  r: number;
  pulse: number;
}

export interface BulletEntity {
  id: number;
  x: number;
  y: number;
  vy: number;
  color: string;
}

export interface ParticleEntity {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  color: string;
  alpha: number;
  decay: number;
}

export interface ShockwaveEntity {
  x: number;
  y: number;
  r: number;
  maxR: number;
  color: string;
  alpha: number;
}

export interface FloatingTextEntity {
  x: number;
  y: number;
  vy: number;
  text: string;
  color: string;
  size: number;
  alpha: number;
}

export interface StarEntity {
  x: number;
  y: number;
  size: number;
  speed: number;
  alpha: number;
}
