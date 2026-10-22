import {
  BossEntity,
  BulletEntity,
  DailyModifierId,
  FloatingTextEntity,
  GemEntity,
  HazardEntity,
  LaserEntity,
  PerkId,
  ParticleEntity,
  PowerupEntity,
  ShockwaveEntity,
  StarEntity,
} from '../types/game';

/** Playfield width the spawn rates were tuned for (a typical phone held upright). */
const REFERENCE_WIDTH = 430;

/**
 * Wider screens get proportionally more spawns so enemy density (and difficulty)
 * stays the same on a phone and on a desktop monitor.
 */
export function fieldScale(W: number): number {
  return Math.max(1, Math.min(4.5, W / REFERENCE_WIDTH));
}

/** Where a run's points came from (Game Over breakdown). */
export type ScoreSource = 'survival' | 'graze' | 'combat' | 'shards' | 'boss' | 'bonus';

export const emptyScoreBy = (): Record<ScoreSource, number> => ({
  survival: 0,
  graze: 0,
  combat: 0,
  shards: 0,
  boss: 0,
  bonus: 0,
});

/** All mutable world data, owned by the 60FPS loop (never React state). */
export function createEngineState() {
  return {
    W: window.innerWidth,
    H: window.innerHeight,
    dpr: Math.min(window.devicePixelRatio || 1, 2),
    t: 0,

    // Run metrics
    score: 0,
    combo: 1,
    maxComboThisRun: 1,
    comboDecayTimer: 0,
    comboDecayMax: 3,
    nearMissesThisRun: 0,
    dashSmashesThisRun: 0,
    /** Hazard the Dash coach is pointing at, or -1. */
    dashHintId: -1,
    /** Keeps the HUD Dash bubble up briefly so it doesn't flicker as targets come and go. */
    dashHintHold: 0,
    runShardsEarned: 0,
    /** Live progress of today's three missions; written to the save when one completes or the run ends. */
    questProgress: [0, 0, 0] as number[],
    /** Day the live mission progress belongs to (missions re-roll at midnight). */
    questDate: '',
    /** Points per source this run, and the run-wide score multiplier (Bullet Hell). */
    scoreBy: emptyScoreBy(),
    scoreMult: 1,
    /** Highest combo milestone (10/20/30) already paid out; drops back as the combo decays. */
    comboMilestone: 0,
    elitesThisRun: 0,
    bulletGrazesThisRun: 0,
    perksThisRun: 0,
    /** A revive was already spent this run. */
    revived: false,
    /** Daily Challenge rule twists active this run. */
    modifiers: [] as DailyModifierId[],
    /** Endless biomes: theme index fading from -> to (-1 = default neon look). */
    biomeFrom: -1,
    biomeTo: -1,
    biomeBlend: 1,
    elapsedRunTime: 0,
    timedRemaining: 60.0,
    waveLevel: 1,
    screenShake: 0,
    slowMoFactor: 1.0,
    slowMoTimer: 0,
    gridOffsetY: 0,
    warp: 0,
    flashAlpha: 0,
    flashColor: '#ffffff',
    grazeSoundCd: 0,
    hitSoundCd: 0,

    // Fever / Overdrive
    feverEnergy: 0,
    isFeverActive: false,
    feverTimeLeft: 0,
    feverCountThisRun: 0,

    // Death sequence
    isDying: false,
    deathTimer: 0,

    // Boss
    boss: null as BossEntity | null,
    bossCount: 0,
    bossKillsThisRun: 0,
    nextBossTime: 55,

    // Boss Rush: index of the boss being fought (or next up), intermission countdown
    bossRushIndex: -1,
    bossRushTimer: 0,
    /** Every boss in the Rush is down: victory lap before the results screen. */
    bossRushWon: false,

    // Tactical Perks
    activePerks: [] as PerkId[],
    /** Level of each installed perk (1..maxLevel). */
    perkLevels: {} as Partial<Record<PerkId, number>>,
    /** Seconds until the perk picker opens (0 = nothing pending). */
    perkPendingTimer: 0,
    /** Three choices shown by the perk picker. */
    perkOffer: [] as PerkId[],
    /** Why the picker opened (shown as its subtitle). */
    perkReason: '',
    /** Highest wave milestone that already granted a perk. */
    perkWaveMilestone: 0,
    /** Kinetic Capacitor: grazes banked towards the next shield. */
    grazeCounterForShield: 0,
    /** Swarm Protocol launch timer. */
    missileTimer: 0,
    /** Holo Echo decoys left behind by Dashes. */
    decoys: [] as { x: number; y: number; life: number; maxLife: number; radius: number }[],

    // Campaign stage: fly through the sector, then fight its Warden
    stagePhase: 'stage' as 'stage' | 'boss' | 'clear',
    stageTimer: 0,
    bossTime: 0,
    hitsTaken: 0,
    clearTimer: 0,
    /** Run started at the Warden via "Retry Boss": the no-hit star is out of reach. */
    skippedStage: false,

    // Player entity
    player: {
      x: window.innerWidth / 2,
      y: window.innerHeight * 0.75,
      targetX: window.innerWidth / 2,
      targetY: window.innerHeight * 0.75,
      vx: 0,
      vy: 0,
      radius: 16,
      trail: [] as { x: number; y: number; dash: boolean }[],
      shieldCount: 0,
      empBombs: 1,
      magnetTimer: 0,
      slowFieldTimer: 0,
      dashTimer: 0,
      dashCooldown: 0,
      dashMaxCooldown: 2.2,
      invulnTimer: 0,
      autoFireTimer: 0,
      /** Weapon Power 1..MAX_WEAPON_LEVEL: how many barrels the auto-blaster fires. */
      weaponLevel: 1,
      /** Auto-blaster volleys fired this run (drives every-Nth-shot weapon tricks). */
      volley: 0,
      /** 1 right after a volley, fades out fast — the nose flash. */
      muzzleFlash: 0,
      /** Sovereign's wingman drones (smoothly trail their slots beside the ship). */
      drones: [
        { x: window.innerWidth / 2 - 34, y: window.innerHeight * 0.75 },
        { x: window.innerWidth / 2 + 34, y: window.innerHeight * 0.75 },
      ],
      bossContactCd: 0,
      angle: -Math.PI / 2,
    },

    // Entity collections
    hazards: [] as HazardEntity[],
    lasers: [] as LaserEntity[],
    gems: [] as GemEntity[],
    powerups: [] as PowerupEntity[],
    bullets: [] as BulletEntity[],
    particles: [] as ParticleEntity[],
    shockwaves: [] as ShockwaveEntity[],
    /** Jagged electric arcs: graze sparks and Static Aftershock lightning. */
    grazeArcs: [] as { x1: number; y1: number; x2: number; y2: number; color: string; alpha: number }[],
    floatingTexts: [] as FloatingTextEntity[],
    bgStars: [] as StarEntity[],

    // Spawners
    hazardTimer: 0.5,
    gemTimer: 0.3,
    powerupTimer: 6.0,
    laserTimer: 8.0,
    entityIdCounter: 1,

    // Comfort settings mirrored from the save so the renderer can read them
    fxShake: 1,
    fxReduceFlash: false,

    // Controls
    pointerActive: false,
    /** Identifier of the finger steering the ship, or -1 (mouse / none). */
    touchId: -1,
    pointerStartX: 0,
    pointerStartY: 0,
    playerStartX: 0,
    playerStartY: 0,
    lastTapTime: 0,
    keys: {} as Record<string, boolean>,
  };
}

export type EngineState = ReturnType<typeof createEngineState>;

/** Adds points from `src`, applying the run's score multiplier. */
export function addScore(e: EngineState, pts: number, src: ScoreSource) {
  const v = pts * e.scoreMult;
  e.score += v;
  e.scoreBy[src] += v;
}
