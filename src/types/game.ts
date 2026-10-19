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

export type QuestType = 'nearmiss' | 'combo' | 'dashkill' | 'gems' | 'fever' | 'boss';

export interface QuestDef {
  id: string;
  type: QuestType;
  target: number;
  reward: number;
  label: string;
}

export interface AchievementDef {
  id: string;
  title: string;
  desc: string;
  icon: string;
  rewardShards: number;
  isEligible: (save: SaveData) => boolean;
}

export interface SaveData {
  shards: number;
  bestEndless: number;
  bestTimed: number;
  bestHardcore: number;
  bestCombo: number;
  bestFeverInRun: number;
  totalRuns: number;
  totalNearMisses: number;
  totalBossKills: number;
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
  type: 'drone' | 'seeker' | 'spinner' | 'turret' | 'shot';
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  angle: number;
  spin?: number;
  speed?: number;
  life?: number;
  hp?: number;
  hitFlash?: number;
  fireTimer?: number;
  stopY?: number;
  shotsLeft?: number;
  color: string;
  grazed: boolean;
}

export interface LaserEntity {
  id: number;
  x: number;
  width: number;
  warnTime: number;
  fireTime: number;
  grazed: boolean;
}

export interface BossEntity {
  x: number;
  y: number;
  targetY: number;
  r: number;
  hp: number;
  maxHp: number;
  angle: number;
  t: number;
  attackTimer: number;
  attackIndex: number;
  hitFlash: number;
  timeLeft: number;
  level: number;
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
  spin: number;
}

export type PowerupKind = 'shield' | 'magnet' | 'slow' | 'bomb';

export interface PowerupEntity {
  id: number;
  kind: PowerupKind;
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
  vx: number;
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
  streak?: boolean;
}

export interface ShockwaveEntity {
  x: number;
  y: number;
  r: number;
  maxR: number;
  color: string;
  alpha: number;
  width?: number;
}

export interface FloatingTextEntity {
  x: number;
  y: number;
  vy: number;
  text: string;
  color: string;
  size: number;
  alpha: number;
  age: number;
}

export interface StarEntity {
  x: number;
  y: number;
  size: number;
  speed: number;
  alpha: number;
  layer: number;
}
