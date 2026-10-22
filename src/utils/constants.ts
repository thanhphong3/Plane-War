import {
  AchievementDef,
  BossKind,
  DailyModifierDef,
  GameSettings,
  PerkDef,
  QuestDef,
  SaveData,
  ShipDef,
  UpgradeDef,
} from '../types/game';
import { LEVELS } from '../game/campaign';

export const STORAGE_KEY = 'neon_blitz_save_v2';

export const SHIPS: ShipDef[] = [
  {
    id: 'striker',
    name: 'Striker',
    desc: 'Perfectly balanced, silky smooth and easy to handle. Great for new pilots.',
    color: '#22d3ee',
    secondary: '#0e7490',
    cost: 0,
    perk: 'Balanced',
    weapon: 'Rapid Plasma — every 4th volley adds a piercing bolt',
    stats: {
      speed: 1.0,
      dashCd: 1.0,
      grazeRadius: 28,
      shardMultiplier: 1.0,
    },
  },
  {
    id: 'phantom',
    name: 'Phantom',
    desc: '+35% near-miss radius, 10% faster handling and 18% faster Dash cooldown.',
    color: '#e879f9',
    secondary: '#86198f',
    cost: 140,
    perk: '+35% Graze Zone',
    weapon: 'Homing Needles — violet darts that hunt the nearest target',
    stats: {
      speed: 1.1,
      dashCd: 0.82,
      grazeRadius: 38,
      shardMultiplier: 1.0,
    },
  },
  {
    id: 'phoenix',
    name: 'Phoenix',
    desc: 'Starts every run with a free Energy Shield to absorb one hit.',
    color: '#fb7185',
    secondary: '#9f1239',
    cost: 320,
    perk: '+1 Starting Shield',
    weapon: 'Solar Fireballs — heavy rounds that explode on impact',
    stats: {
      speed: 1.0,
      dashCd: 0.95,
      grazeRadius: 30,
      bonusShield: true,
      shardMultiplier: 1.0,
    },
  },
  {
    id: 'vortex',
    name: 'Quantum',
    desc: 'Pulls shards from far away (+80% magnet range) and earns +15% shards.',
    color: '#34d399',
    secondary: '#047857',
    cost: 580,
    perk: 'Long-Range Magnet',
    weapon: 'Phase Railgun — hypersonic rails that pierce 2 enemies',
    stats: {
      speed: 1.05,
      dashCd: 0.9,
      grazeRadius: 32,
      magnetRange: 165,
      shardMultiplier: 1.15,
    },
  },
  {
    id: 'sovereign',
    name: 'Sovereign',
    desc: 'Earns x1.5 shards and launches with 2 EMP Bombs. The ultimate flagship.',
    color: '#fbbf24',
    secondary: '#b45309',
    cost: 950,
    perk: 'x1.5 Shards & +1 EMP',
    weapon: 'Twin Wingman Drones — two escorts add covering fire',
    stats: {
      speed: 1.15,
      dashCd: 0.85,
      grazeRadius: 34,
      shardMultiplier: 1.5,
    },
  },
];

export const UPGRADES: UpgradeDef[] = [
  {
    id: 'dashCd',
    name: 'Dash Thrusters',
    desc: 'Reduces Dash cooldown (-10% per level)',
    baseCost: 75,
    maxLevel: 5,
    icon: 'zap',
  },
  {
    id: 'feverDur',
    name: 'Overdrive Reactor',
    desc: 'Extends Overdrive invincibility (+1.2s per level)',
    baseCost: 95,
    maxLevel: 5,
    icon: 'flame',
  },
  {
    id: 'shardBonus',
    name: 'Shard Harvester',
    desc: 'Earn more Neon Shards during runs (+20% per level)',
    baseCost: 110,
    maxLevel: 5,
    icon: 'gem',
  },
  {
    id: 'shieldCap',
    name: 'Shield Reinforcement',
    desc: 'Longer invincibility after a shield breaks (+0.4s per level)',
    baseCost: 130,
    maxLevel: 5,
    icon: 'shield',
  },
  {
    id: 'blaster',
    name: 'Blaster Core',
    desc: 'Every bullet hits harder (+12% damage per level)',
    baseCost: 120,
    maxLevel: 5,
    icon: 'crosshair',
  },
  {
    id: 'fireRate',
    name: 'Rapid Cycler',
    desc: 'Auto-blaster fires faster (+8% fire rate per level)',
    baseCost: 140,
    maxLevel: 5,
    icon: 'gauge',
  },
  {
    id: 'targeting',
    name: 'Targeting AI',
    desc: 'Auto-blaster reaches full fire rate at a lower combo (x5 → x1)',
    baseCost: 100,
    maxLevel: 4,
    icon: 'target',
  },
  {
    id: 'primer',
    name: 'Weapon Primer',
    desc: 'Start every run with +1 Weapon Power level',
    baseCost: 220,
    maxLevel: 2,
    icon: 'chevrons',
  },
];

/**
 * Mid-run Tactical Perks: pick 1 of 3 at wave milestones and after each boss (Endless, Hardcore,
 * Boss Rush, Daily). Picking a perk you own levels it up, to `maxLevel`.
 */
export const PERKS: PerkDef[] = [
  {
    id: 'chain_dash',
    name: 'Static Aftershock',
    desc: 'When a Dash ends, lightning arcs into up to 3 nearby enemies.',
    upgrade: '+2 targets, +1 damage, longer reach',
    icon: 'zap',
    color: '#67e8f9',
    maxLevel: 3,
  },
  {
    id: 'graze_shield',
    name: 'Kinetic Capacitor',
    desc: 'Every 18 grazes charge +1 Energy Shield (max 3).',
    upgrade: 'Needs 4 fewer grazes per shield',
    icon: 'shield',
    color: '#38bdf8',
    maxLevel: 3,
  },
  {
    id: 'ricochet',
    name: 'Prism Bounce',
    desc: 'Your bullets bounce off the left and right edges once.',
    upgrade: '+1 extra bounce per bullet',
    icon: 'bounce',
    color: '#a78bfa',
    maxLevel: 3,
  },
  {
    id: 'dash_decoy',
    name: 'Holo Echo',
    desc: 'Dashing leaves a hologram that lures enemy fire for 2.5s, then explodes.',
    upgrade: 'Lasts longer, bigger blast',
    icon: 'ghost',
    color: '#e879f9',
    maxLevel: 3,
  },
  {
    id: 'overdrive_nova',
    name: 'Supernova Core',
    desc: 'Starting and ending Overdrive wipes every enemy bullet off the screen.',
    upgrade: '+1.5s Overdrive duration',
    icon: 'sun',
    color: '#fbbf24',
    maxLevel: 3,
  },
  {
    id: 'combo_missiles',
    name: 'Swarm Protocol',
    desc: 'At x10 combo or higher, launch 2 homing missiles every 1.8s.',
    upgrade: 'Kicks in 2 combo earlier, fires faster',
    icon: 'rocket',
    color: '#fb923c',
    maxLevel: 3,
  },
  {
    id: 'shard_frenzy',
    name: 'Greed Overclock',
    desc: 'Each shard refunds 0.15s of Dash cooldown and scores +25%.',
    upgrade: 'Bigger refund and score bonus',
    icon: 'gem',
    color: '#fde047',
    maxLevel: 3,
  },
  {
    id: 'berserk_barrel',
    name: 'Overcharge Barrel',
    desc: '+35% fire rate and +25% bullet damage while you have no shield.',
    upgrade: '+15% fire rate, +10% damage',
    icon: 'flame',
    color: '#f43f5e',
    maxLevel: 3,
  },
  {
    id: 'glass_cannon',
    name: 'Glass Cannon',
    desc: '+60% bullet damage. You can never hold more than 1 shield.',
    icon: 'crosshair',
    color: '#f97316',
    maxLevel: 1,
    gambit: true,
  },
  {
    id: 'bullet_hell',
    name: 'Bullet Hell',
    desc: 'x1.5 score and +30% shards, but enemy bullets fly 25% faster.',
    icon: 'skull',
    color: '#ef4444',
    maxLevel: 1,
    gambit: true,
  },
  {
    id: 'overclock_dash',
    name: 'Overclocked Thrusters',
    desc: 'Dash recharges 40% faster, but Overdrive charges 30% slower.',
    icon: 'gauge',
    color: '#22d3ee',
    maxLevel: 1,
    gambit: true,
  },
];

/** Offered in place of perks once every perk is maxed out. */
export const PERK_REWARDS: PerkDef[] = [
  { id: 'reward_shield', name: 'Shield Cell', desc: '+1 Energy Shield right now.', icon: 'shield', color: '#38bdf8', maxLevel: 1, reward: true },
  { id: 'reward_power', name: 'Weapon Cache', desc: '+1 Weapon Power (big score bonus if maxed).', icon: 'chevrons', color: '#fb923c', maxLevel: 1, reward: true },
  { id: 'reward_emp', name: 'EMP Crate', desc: '+2 EMP Bombs.', icon: 'bomb', color: '#fbbf24', maxLevel: 1, reward: true },
];

/** Per-level numbers for each scaling perk (index = level - 1). */
export const PERK_TUNING = {
  chain_dash: { targets: [3, 5, 7], dmg: [4, 5, 6], range: [280, 320, 360] },
  graze_shield: { grazes: [18, 14, 10] },
  ricochet: { bounces: [1, 2, 3] },
  dash_decoy: { life: [2.5, 3.2, 4], radius: [130, 160, 190] },
  overdrive_nova: { extra: [0, 1.5, 3] },
  combo_missiles: { combo: [10, 8, 6], interval: [1.8, 1.5, 1.2] },
  shard_frenzy: { refund: [0.15, 0.22, 0.3], score: [0.25, 0.4, 0.55] },
  berserk_barrel: { rate: [0.35, 0.5, 0.65], dmg: [0.25, 0.35, 0.45] },
};

/** Boss Rush gauntlet, easiest to hardest. Endless cycles through the same list. */
export const BOSS_RUSH_ORDER: BossKind[] = ['sentinel', 'gatekeeper', 'twins', 'furnace', 'wraith', 'singularity', 'null'];

/** Combo milestones that pay out a bonus (see bumpCombo). */
export const COMBO_MILESTONES = [10, 20, 30];

/** Shards paid for a revive grow with the wave (one revive per run). */
export const reviveCost = (wave: number) => Math.min(200, 40 + wave * 15);

// ---------------------------------------------------------------------------
// Daily Challenge
// ---------------------------------------------------------------------------
export const DAILY_MODIFIERS: DailyModifierDef[] = [
  { id: 'fast_bullets', name: 'Hot Lead', desc: 'Enemy bullets fly 30% faster.', color: '#f43f5e' },
  { id: 'laser_storm', name: 'Laser Storm', desc: 'Lasers fire twice as often.', color: '#fb7185' },
  { id: 'elite_surge', name: 'Elite Surge', desc: 'Elite enemies show up three times as often.', color: '#facc15' },
  { id: 'shard_rain', name: 'Shard Rain', desc: 'Twice the shards, but half the magnet range.', color: '#fde047' },
  { id: 'dash_overcharge', name: 'Dash Overcharge', desc: 'Dash recharges twice as fast.', color: '#22d3ee' },
  { id: 'early_boss', name: 'Early Warning', desc: 'Bosses arrive every 35 seconds.', color: '#e879f9' },
  { id: 'max_power', name: 'Loaded', desc: 'Start at Weapon Power 4, but no Power pickups drop.', color: '#fb923c' },
  { id: 'swarm', name: 'Swarm', desc: 'Enemies spawn 35% more often.', color: '#a78bfa' },
];

/** Extra shards for the first Daily run of the day, growing with the streak (capped at 7 days). */
export const dailyBonus = (streak: number, wave: number) => 40 + Math.min(7, streak) * 10 + Math.min(10, wave) * 5;

// ---------------------------------------------------------------------------
// Ship Mastery & paint jobs
// ---------------------------------------------------------------------------
/** XP needed to reach each Mastery level (index = level). */
export const MASTERY_XP = [0, 300, 800, 1600, 2800, 4500];
export const MAX_MASTERY = MASTERY_XP.length - 1;

export function masteryLevel(xp: number): number {
  let lvl = 0;
  while (lvl < MAX_MASTERY && xp >= MASTERY_XP[lvl + 1]) lvl++;
  return lvl;
}

/** What each Mastery level unlocks (index = level - 1). */
export const MASTERY_REWARDS = ['+5% shards', 'Alt paint job', '+1 starting EMP', '+10% shards', '+1 Weapon Power & Prism paint'];

/** Shard multiplier from a ship's Mastery level. */
export const masteryShardMult = (lvl: number) => 1 + (lvl >= 4 ? 0.1 : lvl >= 1 ? 0.05 : 0);

export interface ShipSkin {
  name: string;
  color: string;
  secondary: string;
  /** Mastery level that unlocks it. */
  level: number;
}

/** Index 0 is the factory paint (the ship's own colours). */
export const SHIP_SKINS: Record<string, ShipSkin[]> = {
  striker: [
    { name: 'Factory', color: '#22d3ee', secondary: '#0e7490', level: 0 },
    { name: 'Ember', color: '#fb923c', secondary: '#9a3412', level: 2 },
    { name: 'Prism', color: '#f0abfc', secondary: '#6d28d9', level: 5 },
  ],
  phantom: [
    { name: 'Factory', color: '#e879f9', secondary: '#86198f', level: 0 },
    { name: 'Frost', color: '#93c5fd', secondary: '#1e3a8a', level: 2 },
    { name: 'Prism', color: '#fde047', secondary: '#a16207', level: 5 },
  ],
  phoenix: [
    { name: 'Factory', color: '#fb7185', secondary: '#9f1239', level: 0 },
    { name: 'Azure', color: '#60a5fa', secondary: '#1e40af', level: 2 },
    { name: 'Prism', color: '#c4b5fd', secondary: '#4c1d95', level: 5 },
  ],
  vortex: [
    { name: 'Factory', color: '#34d399', secondary: '#047857', level: 0 },
    { name: 'Toxic', color: '#bef264', secondary: '#3f6212', level: 2 },
    { name: 'Prism', color: '#f472b6', secondary: '#831843', level: 5 },
  ],
  sovereign: [
    { name: 'Factory', color: '#fbbf24', secondary: '#b45309', level: 0 },
    { name: 'Obsidian', color: '#e2e8f0', secondary: '#334155', level: 2 },
    { name: 'Prism', color: '#5eead4', secondary: '#115e59', level: 5 },
  ],
};

/** The ship wearing its equipped paint job (falls back to factory paint if it isn't unlocked). */
export function paintedShip(ship: ShipDef, save: SaveData): ShipDef {
  const idx = save.shipSkin[ship.id] || 0;
  const skin = SHIP_SKINS[ship.id]?.[idx];
  if (!idx || !skin || masteryLevel(save.shipXp[ship.id] || 0) < skin.level) return ship;
  return { ...ship, color: skin.color, secondary: skin.secondary };
}

/** Mastery XP a run earns for the ship that flew it. */
export const runMasteryXp = (score: number, bossKills: number) => Math.round(score / 25) + bossKills * 40;

/** Highest in-run Weapon Power level (collected from POWER pickups). */
export const MAX_WEAPON_LEVEL = 5;

/** Daily mission pool: three with different types are rolled each day. */
export const QUESTS: QuestDef[] = [
  { id: 'q1', type: 'nearmiss', target: 4, reward: 35, label: 'Pull off 4 near-misses' },
  { id: 'q2', type: 'combo', target: 10, reward: 45, label: 'Reach a x10 combo', absolute: true },
  { id: 'q3', type: 'dashkill', target: 6, reward: 50, label: 'Smash 6 enemies with Dash' },
  { id: 'q4', type: 'gems', target: 30, reward: 40, label: 'Collect 30 Neon Shards' },
  { id: 'q5', type: 'fever', target: 1, reward: 60, label: 'Trigger Overdrive once' },
  { id: 'q6', type: 'nearmiss', target: 8, reward: 70, label: 'Pull off 8 near-misses' },
  { id: 'q7', type: 'boss', target: 1, reward: 120, label: 'Destroy a boss' },
  { id: 'q8', type: 'combo', target: 15, reward: 85, label: 'Reach a x15 super combo', absolute: true },
  { id: 'q9', type: 'elite', target: 3, reward: 60, label: 'Destroy 3 elite enemies' },
  { id: 'q10', type: 'score', target: 15000, reward: 80, label: 'Score 15,000 in one run', absolute: true },
  { id: 'q11', type: 'wave', target: 6, reward: 70, label: 'Reach Level 6 in one run', absolute: true },
  { id: 'q12', type: 'graze', target: 60, reward: 50, label: 'Graze 60 enemy bullets' },
  { id: 'q13', type: 'perk', target: 4, reward: 55, label: 'Install 4 Tactical Perks' },
  { id: 'q14', type: 'daily', target: 1, reward: 60, label: "Play today's Daily Challenge" },
  { id: 'q15', type: 'dashkill', target: 12, reward: 75, label: 'Smash 12 enemies with Dash' },
  { id: 'q16', type: 'gems', target: 80, reward: 70, label: 'Collect 80 Neon Shards' },
];

/** Paid once all three daily missions are done. */
export const DAILY_QUEST_BONUS = 100;

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'first_blood',
    title: 'Liftoff',
    desc: 'Complete your first flight in the Neon grid.',
    icon: 'rocket',
    rewardShards: 30,
    isEligible: (s) => s.totalRuns >= 1,
  },
  {
    id: 'graze_master',
    title: 'Thread the Needle',
    desc: 'Pull off 20 near-misses in total.',
    icon: 'zap',
    rewardShards: 75,
    isEligible: (s) => s.totalNearMisses >= 20,
  },
  {
    id: 'combo_king',
    title: 'Rhythm Master',
    desc: 'Reach a x15 combo or higher in a single run.',
    icon: 'flame',
    rewardShards: 100,
    isEligible: (s) => s.bestCombo >= 15,
  },
  {
    id: 'overdrive_god',
    title: 'Unstoppable',
    desc: 'Trigger Overdrive twice in a single run.',
    icon: 'sparkles',
    rewardShards: 120,
    isEligible: (s) => s.bestFeverInRun >= 2,
  },
  {
    id: 'boss_slayer',
    title: 'Sentinel Slayer',
    desc: 'Destroy a Sentinel boss core.',
    icon: 'skull',
    rewardShards: 150,
    isEligible: (s) => s.totalBossKills >= 1,
  },
  {
    id: 'shard_collector',
    title: 'Shard Tycoon',
    desc: 'Hold 1,000 Neon Shards at once.',
    icon: 'gem',
    rewardShards: 150,
    isEligible: (s) => s.shards >= 1000,
  },
  {
    id: 'score_legend',
    title: 'Legend of 10K',
    desc: 'Score 10,000 points or more in any mode.',
    icon: 'trophy',
    rewardShards: 200,
    isEligible: (s) => Math.max(s.bestEndless, s.bestTimed, s.bestHardcore, s.bestBossRush) >= 10000,
  },
  {
    id: 'boss_hunter',
    title: 'Core Breaker',
    desc: 'Destroy 5 bosses in total.',
    icon: 'crown',
    rewardShards: 300,
    isEligible: (s) => s.totalBossKills >= 5,
  },
  {
    id: 'boss_rush_clear',
    title: 'Gauntlet Breaker',
    desc: 'Clear Boss Rush: defeat all 7 bosses in one run.',
    icon: 'crown',
    rewardShards: 400,
    isEligible: (s) => s.bestBossRushTime > 0,
  },
  {
    id: 'campaign_half',
    title: 'Halfway Home',
    desc: 'Clear Sector 03 of the Gridfall campaign.',
    icon: 'rocket',
    rewardShards: 200,
    isEligible: (s) => s.campaignUnlocked >= 3,
  },
  {
    id: 'campaign_clear',
    title: 'Grid Restored',
    desc: 'Defeat NULL and finish the Gridfall campaign.',
    icon: 'crown',
    rewardShards: 500,
    isEligible: (s) => (s.campaignStars[5] || 0) > 0,
  },
  {
    id: 'campaign_perfect',
    title: 'Flawless Pilot',
    desc: 'Earn 3 stars on every campaign sector.',
    icon: 'sparkles',
    rewardShards: 800,
    isEligible: (s) => s.campaignStars.filter((n) => n >= 3).length >= LEVELS.length,
  },
  {
    id: 'archive_clear',
    title: 'Deep Sleep',
    desc: 'Seal LEVIATHAN and finish Act II of the campaign.',
    icon: 'crown',
    rewardShards: 700,
    isEligible: (s) => (s.campaignStars[LEVELS.length - 1] || 0) > 0,
  },
  {
    id: 'elite_hunter',
    title: 'Big Game Hunter',
    desc: 'Destroy 25 elite enemies in total.',
    icon: 'target',
    rewardShards: 150,
    isEligible: (s) => s.totalElites >= 25,
  },
  {
    id: 'daily_streak',
    title: 'Creature of Habit',
    desc: 'Play the Daily Challenge 3 days in a row.',
    icon: 'flame',
    rewardShards: 150,
    isEligible: (s) => s.daily.bestStreak >= 3,
  },
  {
    id: 'ship_master',
    title: 'Ace Pilot',
    desc: 'Reach Mastery 5 with any ship.',
    icon: 'crown',
    rewardShards: 300,
    isEligible: (s) => Object.values(s.shipXp).some((xp) => masteryLevel(xp) >= MAX_MASTERY),
  },
];

export const DEFAULT_SETTINGS: GameSettings = {
  reduceFlash: false,
  shake: 1,
  sensitivity: 1.18,
  sfxVolume: 0.9,
  musicVolume: 0.8,
  haptics: true,
};

export function upgradeCost(baseCost: number, level: number): number {
  return Math.round(baseCost * Math.pow(1.5, level));
}

export function hasClaimableAchievement(save: SaveData): boolean {
  return ACHIEVEMENTS.some((a) => !save.unlockedAchievements.includes(a.id) && a.isEligible(save));
}

/** Keep pointing out Dash targets until the pilot has landed this many Dash smashes. */
export const DASH_COACH_SMASHES = 12;

export const INITIAL_SAVE: SaveData = {
  shards: 80,
  bestEndless: 0,
  bestTimed: 0,
  bestHardcore: 0,
  bestBossRush: 0,
  bestBossRushTime: 0,
  bestCombo: 1,
  bestFeverInRun: 0,
  totalRuns: 0,
  totalNearMisses: 0,
  totalBossKills: 0,
  totalDashSmashes: 0,
  selectedShip: 'striker',
  unlockedShips: ['striker'],
  upgrades: {
    dashCd: 0,
    feverDur: 0,
    shardBonus: 0,
    shieldCap: 0,
    blaster: 0,
    fireRate: 0,
    targeting: 0,
    primer: 0,
  },
  muted: false,
  bgmMuted: false,
  questIndex: 0,
  questProgress: 0,
  dailyQuests: { date: '', ids: [], progress: [], done: [], bonusPaid: false },
  unlockedAchievements: [],
  campaignUnlocked: 0,
  campaignStars: [],
  daily: { date: '', best: 0, attempts: 0, rewarded: false, streak: 0, lastPlayed: '', bestStreak: 0 },
  shipXp: {},
  shipSkin: {},
  settings: DEFAULT_SETTINGS,
  totalElites: 0,
  totalRevives: 0,
};
