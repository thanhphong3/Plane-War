import {
  BossEntity,
  BulletEntity,
  FloatingTextEntity,
  GemEntity,
  HazardEntity,
  LaserEntity,
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
    /** Live quest progress; written to the save only when the quest completes or the run ends. */
    questProgress: 0,
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
    floatingTexts: [] as FloatingTextEntity[],
    bgStars: [] as StarEntity[],

    // Spawners
    hazardTimer: 0.5,
    gemTimer: 0.3,
    powerupTimer: 6.0,
    laserTimer: 8.0,
    entityIdCounter: 1,

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
