import { AchievementDef, QuestDef, SaveData, ShipDef, UpgradeDef } from '../types/game';

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

/** Highest in-run Weapon Power level (collected from POWER pickups). */
export const MAX_WEAPON_LEVEL = 5;

export const QUESTS: QuestDef[] = [
  { id: 'q1', type: 'nearmiss', target: 4, reward: 35, label: 'Pull off 4 near-misses' },
  { id: 'q2', type: 'combo', target: 10, reward: 45, label: 'Reach a x10 combo' },
  { id: 'q3', type: 'dashkill', target: 6, reward: 50, label: 'Smash 6 enemies with Dash' },
  { id: 'q4', type: 'gems', target: 30, reward: 40, label: 'Collect 30 Neon Shards' },
  { id: 'q5', type: 'fever', target: 1, reward: 60, label: 'Trigger Overdrive once' },
  { id: 'q6', type: 'nearmiss', target: 8, reward: 70, label: 'Pull off 8 near-misses' },
  { id: 'q7', type: 'boss', target: 1, reward: 120, label: 'Destroy a Sentinel boss' },
  { id: 'q8', type: 'combo', target: 15, reward: 85, label: 'Reach a x15 super combo' },
];

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
    isEligible: (s) => Math.max(s.bestEndless, s.bestTimed, s.bestHardcore) >= 10000,
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
    isEligible: (s) => s.campaignStars.filter((n) => n >= 3).length >= 6,
  },
];

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
  unlockedAchievements: [],
  campaignUnlocked: 0,
  campaignStars: [],
};
