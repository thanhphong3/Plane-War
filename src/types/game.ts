export type GameMode = 'endless' | 'timed' | 'hardcore' | 'campaign';
export type GameState = 'MENU' | 'PLAYING' | 'PAUSED' | 'GAMEOVER' | 'STORY' | 'LEVELCLEAR';

export type BossKind = 'sentinel' | 'gatekeeper' | 'twins' | 'furnace' | 'wraith' | 'singularity' | 'null';

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
  id: 'dashCd' | 'feverDur' | 'shardBonus' | 'shieldCap' | 'blaster' | 'fireRate' | 'targeting' | 'primer';
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
    blaster: number;
    fireRate: number;
    targeting: number;
    primer: number;
  };
  muted: boolean;
  bgmMuted: boolean;
  questIndex: number;
  questProgress: number;
  unlockedAchievements: string[];
  /** Index of the highest campaign sector unlocked (0-based). */
  campaignUnlocked: number;
  /** Best star rating (0-3) per campaign sector. */
  campaignStars: number[];
}

export interface HazardEntity {
  id: number;
  /** 'orb' is a heavy plasma core that can be deflected with a Dash. */
  type: 'drone' | 'seeker' | 'spinner' | 'turret' | 'shot' | 'orb';
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
  /** Downward acceleration (falling embers). */
  ay?: number;
  /** Ghost shots fade in and out of sight. */
  ghost?: boolean;
  /** Glitch shots teleport forward every time this timer runs out. */
  glitch?: number;
  /** Orb: seconds until it detonates on its own. */
  fuse?: number;
  /** Orb: deflected back towards the boss by the player. */
  reflected?: boolean;
}

export interface LaserEntity {
  id: number;
  /** Column centre for vertical lasers, row centre for horizontal ones. */
  x: number;
  width: number;
  warnTime: number;
  fireTime: number;
  grazed: boolean;
  orient?: 'v' | 'h';
}

/** A secondary body of a boss: twin, decoy, stabilizer node... */
export interface BossPart {
  x: number;
  y: number;
  tx: number;
  ty: number;
  r: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  timer: number;
  hitFlash: number;
  real?: boolean;
}

export interface BossEntity {
  kind: BossKind;
  name: string;
  color: string;
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
  /** Finished flying in; from here on the boss positions itself. */
  entered: boolean;
  phase: number;
  parts: BossPart[];
  /** Short live hint shown under the boss HP bar. */
  status: string;
  /** Free-form per-boss state (timers, meters, modes). */
  v: Record<string, number>;
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

export type PowerupKind = 'shield' | 'magnet' | 'slow' | 'bomb' | 'key' | 'power';

export interface PowerupEntity {
  id: number;
  kind: PowerupKind;
  color: string;
  label: string;
  x: number;
  y: number;
  vx?: number;
  vy: number;
  r: number;
  pulse: number;
  /** Seconds before it can be picked up (keys scattered by a boss). */
  armTime?: number;
}

export interface BulletEntity {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  /** Fired during Overdrive — the only fire that can pierce NULL's field. */
  fever?: boolean;
  /** Damage dealt on hit (defaults to 1). Scales with weapon level and Blaster Core. */
  damage?: number;
  /** Already slipped through a boss shield gap. */
  passed?: boolean;
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
