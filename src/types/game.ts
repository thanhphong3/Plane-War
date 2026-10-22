export type GameMode = 'endless' | 'timed' | 'hardcore' | 'campaign' | 'bossrush' | 'daily';
export type GameState = 'MENU' | 'PLAYING' | 'PAUSED' | 'GAMEOVER' | 'STORY' | 'LEVELCLEAR' | 'PERK_SELECT' | 'REVIVE';

/** Mid-run Tactical Perks (Endless / Hardcore / Boss Rush / Daily). */
export type PerkId =
  | 'chain_dash'
  | 'graze_shield'
  | 'ricochet'
  | 'dash_decoy'
  | 'overdrive_nova'
  | 'combo_missiles'
  | 'shard_frenzy'
  | 'berserk_barrel'
  // Gambits: a big upside with a real drawback (one level only)
  | 'glass_cannon'
  | 'bullet_hell'
  | 'overclock_dash'
  // One-shot rewards offered once every perk is maxed out
  | 'reward_shield'
  | 'reward_power'
  | 'reward_emp';

export interface PerkDef {
  id: PerkId;
  name: string;
  desc: string;
  /** What the next level adds (shown on cards for owned perks). */
  upgrade?: string;
  icon: string;
  color: string;
  maxLevel: number;
  /** Risk/reward perk with a drawback. */
  gambit?: boolean;
  /** Instant pickup instead of a lasting perk. */
  reward?: boolean;
}

/** Daily Challenge rule twists. */
export type DailyModifierId =
  | 'fast_bullets'
  | 'laser_storm'
  | 'elite_surge'
  | 'shard_rain'
  | 'dash_overcharge'
  | 'early_boss'
  | 'max_power'
  | 'swarm';

export interface DailyModifierDef {
  id: DailyModifierId;
  name: string;
  desc: string;
  color: string;
}

/** Player options (accessibility, audio, controls). */
export interface GameSettings {
  /** Tone full-screen flashes down and stop warning blinks. */
  reduceFlash: boolean;
  /** Screen shake strength, 0..1. */
  shake: number;
  /** Drag steering multiplier. */
  sensitivity: number;
  sfxVolume: number;
  musicVolume: number;
  haptics: boolean;
}

export type BossKind =
  | 'sentinel'
  | 'gatekeeper'
  | 'twins'
  | 'furnace'
  | 'wraith'
  | 'singularity'
  | 'null'
  | 'mimic'
  | 'dynamo'
  | 'chronos'
  | 'hydra'
  | 'leviathan'
  | 'beacon'
  | 'cipher'
  | 'metronome'
  | 'marionette'
  | 'fractal'
  | 'blight'
  | 'deadeye'
  | 'siege'
  | 'breaker'
  | 'architect';

export interface ShipDef {
  id: string;
  name: string;
  desc: string;
  color: string;
  secondary: string;
  cost: number;
  perk: string;
  /** Signature auto-blaster, shown in the hangar. */
  weapon: string;
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

export type QuestType =
  | 'nearmiss'
  | 'combo'
  | 'dashkill'
  | 'gems'
  | 'fever'
  | 'boss'
  | 'elite'
  | 'score'
  | 'wave'
  | 'graze'
  | 'perk'
  | 'daily';

export interface QuestDef {
  id: string;
  type: QuestType;
  target: number;
  reward: number;
  label: string;
  /** Best-in-one-run goal (combo, score, wave) instead of a running total. */
  absolute?: boolean;
}

/** Today's three missions. */
export interface DailyQuestState {
  /** Local date key, YYYY-MM-DD. */
  date: string;
  ids: string[];
  progress: number[];
  done: boolean[];
  /** All three finished and the bonus paid out. */
  bonusPaid: boolean;
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
  /** Best Boss Rush score. */
  bestBossRush: number;
  /** Fastest full Boss Rush clear in seconds (0 = never cleared). */
  bestBossRushTime: number;
  /** Roster size the fastest time was set with (a longer roster resets it). */
  bossRushRoster: number;
  bestCombo: number;
  bestFeverInRun: number;
  totalRuns: number;
  totalNearMisses: number;
  totalBossKills: number;
  /** Lifetime enemies smashed or Plasma Cores parried with a Dash; drives in-run Dash coaching. */
  totalDashSmashes: number;
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
  /** Legacy single-quest cursor (pre daily missions), kept so old saves load. */
  questIndex: number;
  questProgress: number;
  dailyQuests: DailyQuestState;
  unlockedAchievements: string[];
  /** Index of the highest campaign sector unlocked (0-based). */
  campaignUnlocked: number;
  /** Best star rating (0-3) per campaign sector. */
  campaignStars: number[];
  /** Daily Challenge: today's best, and the play streak. */
  daily: {
    date: string;
    best: number;
    attempts: number;
    /** First run of the day already paid its bonus. */
    rewarded: boolean;
    streak: number;
    /** Date of the last day a Daily Challenge was played. */
    lastPlayed: string;
    bestStreak: number;
  };
  /** Ship Mastery XP per ship id. */
  shipXp: Record<string, number>;
  /** Equipped skin index per ship id (0 = factory paint). */
  shipSkin: Record<string, number>;
  settings: GameSettings;
  /** Lifetime elite enemies destroyed. */
  totalElites: number;
  /** Times a run was continued with a revive. */
  totalRevives: number;
}

export interface HazardEntity {
  id: number;
  /**
   * 'orb' is a heavy plasma core that can be deflected with a Dash.
   * 'splitter' bursts into two drones when shot, 'sniper' telegraphs a fast aimed shot,
   * 'kamikaze' locks on and lunges in a straight line.
   */
  type: 'drone' | 'seeker' | 'spinner' | 'turret' | 'shot' | 'orb' | 'splitter' | 'sniper' | 'kamikaze';
  /** Armoured gold variant: several hits, always drops loot. */
  elite?: boolean;
  /** Starting HP, for the pip display. */
  maxHp?: number;
  /** Sniper / kamikaze: seconds left of the aim telegraph. */
  aimTimer?: number;
  /** Kamikaze: committed to its lunge. */
  lunging?: boolean;
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
  /** Polarity shot (DYNAMO): 1 = blue, -1 = red. */
  pol?: number;
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
  /** Free angle (anchor / heading) for bosses whose parts need one. */
  a?: number;
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
  /** Visual / behaviour family. Undefined renders as plain plasma. */
  kind?: 'plasma' | 'homing' | 'fireball' | 'rail' | 'drone' | 'missile';
  /** Enemies this bullet can still pass through after a hit. */
  pierce?: number;
  /** Explodes on impact, hurting enemies within this radius. */
  splashRadius?: number;
  /** Ids of enemies already pierced, so one target is never hit twice. */
  hitIds?: number[];
  /** Homing: max turn speed in rad/s. */
  turnRate?: number;
  /** Seconds left before a homing round fizzles. */
  life?: number;
  /** Prism Bounce perk: wall ricochets used so far. */
  bounces?: number;
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
