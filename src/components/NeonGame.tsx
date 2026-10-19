import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Sparkles } from 'lucide-react';
import {
  drawBackground,
  drawFog,
  drawGem,
  drawGlow,
  drawHazard,
  drawLaser,
  drawPowerup,
  drawShip,
  drawVignette,
  hexToRgba,
} from '../game/render';
import { drawBossEntity } from '../game/bossArt';
import { BOSSES, BossApi, ShotOpts } from '../game/bosses';
import { LEVELS, LevelDef, SpeakerId, computeStars } from '../game/campaign';
import {
  BossEntity,
  BossKind,
  BulletEntity,
  FloatingTextEntity,
  GameMode,
  GameState,
  GemEntity,
  HazardEntity,
  LaserEntity,
  ParticleEntity,
  PowerupEntity,
  QuestType,
  SaveData,
  ShipDef,
  ShockwaveEntity,
  StarEntity,
} from '../types/game';
import { sound } from '../utils/audio';
import { MAX_WEAPON_LEVEL, QUESTS, SHIPS } from '../utils/constants';
import { loadGameSave, saveGameData } from '../utils/storage';
import { AchievementsModal } from './AchievementsModal';
import { CampaignMap } from './CampaignMap';
import { GameOverModal, GameOverStats } from './GameOverModal';
import { CommMessage, HUD } from './HUD';
import { LevelClearModal, LevelClearStats } from './LevelClearModal';
import { MainMenu } from './MainMenu';
import { PauseModal } from './PauseModal';
import { ShopModal } from './ShopModal';
import { StoryScreen } from './StoryScreen';

const MAX_PARTICLES = 650;
const SHOT_COLOR = '#f472b6';
/** Seconds of slow-motion celebration between a campaign boss kill and the debrief. */
const CLEAR_DELAY = 2.6;

/** Boss is on station and can be fought (not flying in or retreating). */
const bossReady = (b: BossEntity) => b.entered && b.timeLeft > 0;

/** Raises the auto-blaster's Weapon Power by one level (lost again when a shield breaks). */
const POWER_PICKUP = { kind: 'power' as const, color: '#fb923c', label: 'WEAPON POWER' };

export const NeonGame: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Persistence State
  const [saveData, setSaveData] = useState<SaveData>(() => loadGameSave());
  const saveDataRef = useRef<SaveData>(saveData);
  saveDataRef.current = saveData;

  // Game UI Flow State
  const [gameState, setGameState] = useState<GameState>('MENU');
  const gameStateRef = useRef<GameState>('MENU');
  gameStateRef.current = gameState;

  const [gameMode, setGameMode] = useState<GameMode>('endless');
  const gameModeRef = useRef<GameMode>('endless');
  gameModeRef.current = gameMode;

  // Campaign
  const [levelIndex, setLevelIndex] = useState(0);
  const levelIndexRef = useRef(0);
  levelIndexRef.current = levelIndex;
  const [storyKind, setStoryKind] = useState<'briefing' | 'debrief'>('briefing');
  const [levelClearStats, setLevelClearStats] = useState<LevelClearStats | null>(null);

  // Active Modals
  const [isShopOpen, setIsShopOpen] = useState(false);
  const [isAchievementsOpen, setIsAchievementsOpen] = useState(false);
  const [isCampaignOpen, setIsCampaignOpen] = useState(false);

  // In-Game Live Metrics for React HUD (throttled sync)
  const [hudScore, setHudScore] = useState(0);
  const [hudCombo, setHudCombo] = useState(1);
  const [hudComboTimer, setHudComboTimer] = useState(0);
  const [hudWave, setHudWave] = useState(1);
  const [hudShards, setHudShards] = useState(saveData.shards);
  const [hudTimedRemain, setHudTimedRemain] = useState(60.0);
  const [hudFeverEnergy, setHudFeverEnergy] = useState(0);
  const [hudIsFeverActive, setHudIsFeverActive] = useState(false);
  const [hudShieldCount, setHudShieldCount] = useState(0);
  const [hudMagnetTimer, setHudMagnetTimer] = useState(0);
  const [hudSlowFieldTimer, setHudSlowFieldTimer] = useState(0);
  const [hudEmpBombs, setHudEmpBombs] = useState(1);
  const [hudWeaponLevel, setHudWeaponLevel] = useState(1);
  const [hudDashCooldown, setHudDashCooldown] = useState(0);
  const [hudDashMaxCooldown, setHudDashMaxCooldown] = useState(2.2);
  const [hudBossHp, setHudBossHp] = useState(-1);
  const [hudBossName, setHudBossName] = useState('');
  const [hudBossStatus, setHudBossStatus] = useState('');
  const [hudStageProgress, setHudStageProgress] = useState(-1);
  const [hudComm, setHudComm] = useState<CommMessage | null>(null);

  // Banner & Toast feedback
  const [centerBannerText, setCenterBannerText] = useState('');
  const [isBannerVisible, setIsBannerVisible] = useState(false);
  const [bannerColorClass, setBannerColorClass] = useState('neon-glow-cyan');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Game Over summary state
  const [gameOverStats, setGameOverStats] = useState<GameOverStats>({
    score: 0,
    shardsEarned: 0,
    maxCombo: 1,
    nearMisses: 0,
    wave: 1,
    bossKills: 0,
    isNewRecord: false,
    previousBest: 0,
    reason: 'crashed',
    reachedBoss: false,
  });

  // Sound toggles
  const [isMuted, setIsMuted] = useState(saveData.muted);
  const [isBgmMuted, setIsBgmMuted] = useState(saveData.bgmMuted);

  const bannerTimeoutRef = useRef<number | null>(null);
  const showCenterBanner = useCallback((text: string, colorClass = 'neon-glow-cyan') => {
    setCenterBannerText(text);
    setBannerColorClass(colorClass);
    setIsBannerVisible(true);
    if (bannerTimeoutRef.current) window.clearTimeout(bannerTimeoutRef.current);
    bannerTimeoutRef.current = window.setTimeout(() => {
      setIsBannerVisible(false);
    }, 1600);
  }, []);

  const toastTimeoutRef = useRef<number | null>(null);
  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    if (toastTimeoutRef.current) window.clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = window.setTimeout(() => {
      setToastMessage(null);
    }, 2400);
  }, []);

  // In-flight radio chatter: queued so multi-line exchanges read in order
  const commQueueRef = useRef<CommMessage[]>([]);
  const commTimeoutRef = useRef<number | null>(null);
  const commIdRef = useRef(0);
  const pumpComm = useCallback(() => {
    const next = commQueueRef.current.shift();
    if (!next) {
      setHudComm(null);
      commTimeoutRef.current = null;
      return;
    }
    setHudComm(next);
    sound.playSound('comm');
    commTimeoutRef.current = window.setTimeout(pumpComm, Math.min(5200, 1700 + next.text.length * 38));
  }, []);
  const showComm = useCallback(
    (who: SpeakerId, text: string) => {
      commQueueRef.current.push({ id: ++commIdRef.current, who, text });
      if (commQueueRef.current.length > 3) commQueueRef.current.shift();
      if (commTimeoutRef.current === null) pumpComm();
    },
    [pumpComm]
  );
  const clearComms = useCallback(() => {
    commQueueRef.current = [];
    if (commTimeoutRef.current) window.clearTimeout(commTimeoutRef.current);
    commTimeoutRef.current = null;
    setHudComm(null);
  }, []);

  // Sync sound settings with Audio engine
  useEffect(() => {
    sound.setMuted(saveData.muted);
    sound.setBgmMuted(saveData.bgmMuted);
    setIsMuted(saveData.muted);
    setIsBgmMuted(saveData.bgmMuted);
  }, [saveData.muted, saveData.bgmMuted]);

  // Start the soundtrack on the first user gesture (browsers block autoplay)
  useEffect(() => {
    const kick = () => {
      sound.ensureContext();
      sound.startBgm();
    };
    window.addEventListener('pointerdown', kick, { once: true });
    window.addEventListener('keydown', kick, { once: true });
    return () => {
      window.removeEventListener('pointerdown', kick);
      window.removeEventListener('keydown', kick);
    };
  }, []);

  const updateSave = useCallback((newSave: SaveData) => {
    saveDataRef.current = newSave;
    setSaveData(newSave);
    saveGameData(newSave);
  }, []);

  const toggleMute = useCallback(() => {
    const updated = !saveDataRef.current.muted;
    sound.setMuted(updated);
    setIsMuted(updated);
    updateSave({ ...saveDataRef.current, muted: updated });
    if (!updated) sound.playSound('gem', 4);
  }, [updateSave]);

  const toggleBgm = useCallback(() => {
    const updated = !saveDataRef.current.bgmMuted;
    sound.setBgmMuted(updated);
    setIsBgmMuted(updated);
    updateSave({ ...saveDataRef.current, bgmMuted: updated });
    if (!updated) sound.startBgm();
  }, [updateSave]);

  const claimAchievement = useCallback(
    (achievementId: string, reward: number) => {
      const cur = saveDataRef.current;
      if (cur.unlockedAchievements.includes(achievementId)) return;
      updateSave({
        ...cur,
        shards: cur.shards + reward,
        unlockedAchievements: [...cur.unlockedAchievements, achievementId],
      });
      showToast(`Reward claimed: +${reward} shards!`);
    },
    [updateSave, showToast]
  );

  // Quest Tracker & Progression
  const currentQuest = QUESTS[saveData.questIndex % QUESTS.length];

  const advanceQuest = useCallback(
    (type: QuestType, amount: number, isAbsolute = false) => {
      const cur = saveDataRef.current;
      const q = QUESTS[cur.questIndex % QUESTS.length];
      if (q.type !== type) return;

      const newProg = isAbsolute ? Math.max(cur.questProgress, amount) : cur.questProgress + amount;
      if (newProg === cur.questProgress) return;
      if (newProg >= q.target) {
        updateSave({
          ...cur,
          shards: cur.shards + q.reward,
          questIndex: (cur.questIndex + 1) % QUESTS.length,
          questProgress: 0,
        });
        sound.playSound('powerup');
        showToast(`Mission complete: ${q.label}! +${q.reward} shards`);
      } else {
        updateSave({ ...cur, questProgress: newProg });
      }
    },
    [updateSave, showToast]
  );

  // ========================================================
  // ENGINE DATA (mutated inside the 60FPS animation loop)
  // ========================================================
  const engineRef = useRef({
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
    runShardsEarned: 0,
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
    pointerStartX: 0,
    pointerStartY: 0,
    playerStartX: 0,
    playerStartY: 0,
    lastTapTime: 0,
    keys: {} as Record<string, boolean>,
  });

  const getActiveShip = useCallback((): ShipDef => {
    const cur = saveDataRef.current;
    return SHIPS.find((s) => s.id === cur.selectedShip) || SHIPS[0];
  }, []);

  /** The current campaign sector, or null outside the campaign. */
  const getLevel = useCallback((): LevelDef | null => {
    return gameModeRef.current === 'campaign' ? LEVELS[levelIndexRef.current] || null : null;
  }, []);

  /** Wired up inside the render loop; lets abilities outside the loop talk to the boss. */
  const bossApiRef = useRef<BossApi | null>(null);

  /** Music intensity follows what is happening on screen. */
  const refreshMusic = useCallback(() => {
    const e = engineRef.current;
    if (gameStateRef.current !== 'PLAYING') sound.setIntensity(0);
    else if (e.isFeverActive || e.boss) sound.setIntensity(2);
    else sound.setIntensity(1);
  }, []);

  // ========================================================
  // FX helpers
  // ========================================================
  const spawnParticles = useCallback(
    (x: number, y: number, color: string, count = 12, speed = 180, streak = false) => {
      const e = engineRef.current;
      const room = MAX_PARTICLES - e.particles.length;
      const n = Math.min(count, Math.max(0, room));
      for (let i = 0; i < n; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = (0.25 + Math.random() * 0.75) * speed;
        e.particles.push({
          x,
          y,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          r: Math.random() * 3 + 1.5,
          color,
          alpha: 1,
          decay: 1.3 + Math.random() * 1.2,
          streak: streak || Math.random() < 0.3,
        });
      }
    },
    []
  );

  const addShockwave = useCallback((x: number, y: number, color: string, maxR: number, width = 3) => {
    engineRef.current.shockwaves.push({ x, y, r: 8, maxR, color, alpha: 1, width });
  }, []);

  const addFloatingText = useCallback((x: number, y: number, text: string, color = '#ffffff', size = 14) => {
    const e = engineRef.current;
    e.floatingTexts.push({
      x: Math.max(60, Math.min(e.W - 60, x)),
      y,
      vy: -55,
      text,
      color,
      size,
      alpha: 1,
      age: 0,
    });
  }, []);

  const flashScreen = useCallback((color: string, alpha: number) => {
    const e = engineRef.current;
    e.flashColor = color;
    e.flashAlpha = Math.max(e.flashAlpha, alpha);
  }, []);

  const bumpCombo = useCallback((amount: number, timer: number) => {
    const e = engineRef.current;
    e.combo = Math.min(30, e.combo + amount);
    e.maxComboThisRun = Math.max(e.maxComboThisRun, e.combo);
    e.comboDecayTimer = timer;
    e.comboDecayMax = timer;
  }, []);

  // ========================================================
  // Abilities
  // ========================================================
  const triggerDash = useCallback(() => {
    if (gameStateRef.current !== 'PLAYING') return;
    const e = engineRef.current;
    if (e.isDying || e.player.dashCooldown > 0) return;

    e.player.dashTimer = 0.38;
    const cdReduction = 1 - (saveDataRef.current.upgrades.dashCd || 0) * 0.1;
    const ship = getActiveShip();
    e.player.dashMaxCooldown = Math.max(0.8, 2.2 * cdReduction * ship.stats.dashCd);
    e.player.dashCooldown = e.player.dashMaxCooldown;
    e.player.invulnTimer = Math.max(e.player.invulnTimer, 0.45);
    e.player.bossContactCd = 0;

    sound.playSound('dash');
    sound.triggerHaptic(30);
    e.screenShake = 8;

    addShockwave(e.player.x, e.player.y, '#22d3ee', 120);
    spawnParticles(e.player.x, e.player.y, '#22d3ee', 18, 260, true);
    addFloatingText(e.player.x, e.player.y - 26, 'HYPER DASH!', '#67e8f9', 16);
  }, [getActiveShip, spawnParticles, addFloatingText, addShockwave]);

  const defeatBoss = useCallback(() => {
    const e = engineRef.current;
    const b = e.boss;
    if (!b) return;
    const campaign = gameModeRef.current === 'campaign';
    e.boss = null;
    e.bossKillsThisRun++;
    e.nextBossTime = e.elapsedRunTime + 60;

    sound.playSound('boss_down');
    sound.triggerHaptic([60, 40, 120]);
    e.screenShake = 26;
    flashScreen('#ffffff', 0.75);
    e.slowMoFactor = 0.35;
    e.slowMoTimer = campaign ? 1.2 : 0.6;

    for (let k = 0; k < 4; k++) {
      addShockwave(b.x, b.y, k % 2 ? b.color : '#fbbf24', 160 + k * 110, 5 - k);
    }
    spawnParticles(b.x, b.y, b.color, 70, 520, true);
    spawnParticles(b.x, b.y, '#fbbf24', 50, 380);
    spawnParticles(b.x, b.y, '#ffffff', 30, 260);
    for (const pt of b.parts) {
      if (pt.alive) spawnParticles(pt.x, pt.y, b.color, 16, 300, true);
    }

    // Bullet cancel: every enemy shot turns into sparks (the whole sector goes quiet in the campaign)
    e.hazards = e.hazards.filter((h) => {
      if (!campaign && h.type !== 'shot' && h.type !== 'orb') return true;
      spawnParticles(h.x, h.y, h.type === 'shot' ? h.color : '#fbbf24', 3, 90);
      return false;
    });
    e.lasers = [];
    e.powerups = e.powerups.filter((pu) => pu.kind !== 'key');
    if (campaign) {
      e.stagePhase = 'clear';
      e.clearTimer = CLEAR_DELAY;
      e.player.invulnTimer = Math.max(e.player.invulnTimer, CLEAR_DELAY + 1);
    }

    // Shard fountain
    for (let i = 0; i < 16 + b.level * 4; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 120 + Math.random() * 200;
      e.gems.push({
        id: e.entityIdCounter++,
        x: b.x,
        y: b.y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        r: 10,
        val: 2,
        magnetized: false,
        spin: Math.random() * 6,
      });
    }

    const bonus = 2000 * b.level + 150 * e.combo;
    e.score += bonus;
    addFloatingText(b.x, b.y, `+${bonus.toLocaleString('en-US')}`, '#fde047', 26);
    showCenterBanner(
      campaign ? `${b.name} DEFEATED!` : `SENTINEL DESTROYED! +${bonus.toLocaleString('en-US')}`,
      'neon-glow-amber'
    );
    advanceQuest('boss', 1, false);
    refreshMusic();
  }, [addShockwave, addFloatingText, advanceQuest, flashScreen, refreshMusic, showCenterBanner, spawnParticles]);

  const triggerEmp = useCallback(() => {
    if (gameStateRef.current !== 'PLAYING') return;
    const e = engineRef.current;
    if (e.isDying || e.player.empBombs <= 0) return;

    e.player.empBombs--;
    e.player.invulnTimer = Math.max(e.player.invulnTimer, 1.4);
    sound.playSound('boom');
    sound.triggerHaptic([40, 30, 60]);
    e.screenShake = 18;
    flashScreen('#fbbf24', 0.45);

    addShockwave(e.player.x, e.player.y, '#fbbf24', Math.max(e.W, e.H) * 0.95, 6);
    addShockwave(e.player.x, e.player.y, '#ffffff', Math.max(e.W, e.H) * 0.6, 2);

    let converted = 0;
    for (let i = e.hazards.length - 1; i >= 0; i--) {
      const h = e.hazards[i];
      if (h.type === 'shot') {
        spawnParticles(h.x, h.y, '#fbbf24', 3, 120);
      } else {
        spawnParticles(h.x, h.y, '#fbbf24', 12, 220);
        e.gems.push({
          id: e.entityIdCounter++,
          x: h.x,
          y: h.y,
          vx: (Math.random() - 0.5) * 60,
          vy: -40,
          r: 9,
          val: 2,
          magnetized: true,
          spin: Math.random() * 6,
        });
        converted++;
      }
    }
    e.hazards = [];
    e.lasers = [];

    const bonus = converted * 80 * e.combo;
    e.score += bonus;
    showCenterBanner(`EMP BLAST! +${bonus.toLocaleString('en-US')}`, 'neon-glow-amber');
    // After the banner so boss-specific EMP reactions can override it
    if (e.boss && bossApiRef.current && bossReady(e.boss)) BOSSES[e.boss.kind].emp(e.boss, bossApiRef.current);
  }, [spawnParticles, showCenterBanner, addShockwave, flashScreen]);

  const activateFeverMode = useCallback(() => {
    const e = engineRef.current;
    e.isFeverActive = true;
    e.feverCountThisRun++;
    const extraDur = (saveDataRef.current.upgrades.feverDur || 0) * 1.2;
    e.feverTimeLeft = 6.2 + extraDur;
    e.feverEnergy = 100;
    e.player.invulnTimer = Math.max(e.player.invulnTimer, e.feverTimeLeft);

    sound.playSound('fever');
    sound.triggerHaptic([35, 25, 55]);
    e.screenShake = 14;
    flashScreen('#fbbf24', 0.35);
    addShockwave(e.player.x, e.player.y, '#f43f5e', 280, 5);
    addShockwave(e.player.x, e.player.y, '#fbbf24', 200, 3);

    showCenterBanner('OVERDRIVE! SMASH EVERYTHING!', 'neon-glow-amber');
    advanceQuest('fever', 1, false);
    refreshMusic();
  }, [advanceQuest, showCenterBanner, addShockwave, flashScreen, refreshMusic]);

  const addFeverEnergy = useCallback(
    (amt: number) => {
      const e = engineRef.current;
      if (e.isFeverActive) return;
      e.feverEnergy = Math.min(100, e.feverEnergy + amt);
      if (e.feverEnergy >= 100) activateFeverMode();
    },
    [activateFeverMode]
  );

  // ========================================================
  // Spawners
  // ========================================================
  const pushShot = useCallback((x: number, y: number, angle: number, speed: number, opts?: ShotOpts) => {
    const e = engineRef.current;
    if (e.hazards.length > 300) return;
    e.hazards.push({
      id: e.entityIdCounter++,
      type: 'shot',
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      r: opts?.r ?? 6,
      angle,
      color: opts?.color ?? SHOT_COLOR,
      grazed: false,
      ay: opts?.ay,
      ghost: opts?.ghost,
      glitch: opts?.glitch ? 0.45 + Math.random() * 0.3 : undefined,
    });
  }, []);

  const pushOrb = useCallback((x: number, y: number, angle: number, speed: number) => {
    const e = engineRef.current;
    e.hazards.push({
      id: e.entityIdCounter++,
      type: 'orb',
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      speed,
      r: 18,
      angle,
      fuse: 5,
      color: '#f97316',
      grazed: false,
    });
  }, []);

  const spawnLaser = useCallback((pos: number, orient: 'v' | 'h' = 'v', warn?: number) => {
    const e = engineRef.current;
    const hard = gameModeRef.current === 'hardcore';
    const width = 50 + Math.random() * 16 + (hard ? 10 : 0);
    const span = orient === 'h' ? e.H : e.W;
    e.lasers.push({
      id: e.entityIdCounter++,
      x: Math.max(width / 2, Math.min(span - width / 2, pos)),
      width,
      warnTime: warn ?? (hard ? 0.9 : 1.15),
      fireTime: 0.5,
      grazed: false,
      orient,
    });
    sound.playSound('laser_warn');
  }, []);

  const spawnBoss = useCallback(
    (kind: BossKind = 'sentinel') => {
      const e = engineRef.current;
      const level = getLevel();
      e.bossCount++;
      const tier = level ? level.id + 1 : e.bossCount;
      const hard = gameModeRef.current === 'hardcore';
      const maxHp = level ? level.bossHp : Math.round((60 + tier * 35) * (hard ? 1.3 : 1));
      const b: BossEntity = {
        kind,
        name: level ? level.bossName : `SENTINEL MK-${tier}`,
        color: level ? level.accent : '#e879f9',
        x: e.W / 2,
        y: -120,
        targetY: Math.max(200, e.H * 0.27),
        r: Math.min(62, e.W * 0.13),
        hp: maxHp,
        maxHp,
        angle: 0,
        t: 0,
        attackTimer: 1.6,
        attackIndex: 0,
        hitFlash: 0,
        timeLeft: level ? Infinity : 38,
        level: tier,
        entered: false,
        phase: 1,
        parts: [],
        status: '',
        v: {},
      };
      if (bossApiRef.current) BOSSES[kind].setup(b, bossApiRef.current);
      e.boss = b;
      e.bossTime = 0;
      sound.playSound('boss_alarm');
      sound.triggerHaptic([50, 50, 50]);
      flashScreen('#f43f5e', 0.25);
      showCenterBanner(`WARNING: ${b.name} INBOUND`, 'neon-glow-pink');
      if (level) level.bossIntro.forEach((line) => showComm(line.who, line.text));
      refreshMusic();
    },
    [flashScreen, getLevel, refreshMusic, showCenterBanner, showComm]
  );

  const spawnHazardWave = useCallback(() => {
    const e = engineRef.current;
    const wave = e.waveLevel;
    const speedMult = (gameModeRef.current === 'hardcore' ? 1.34 : 1.0) + (wave - 1) * 0.1;
    // Campaign sectors bias the roll towards their own enemy mix
    const mix = getLevel()?.mix;
    let roll = Math.random();
    if (mix) {
      const total = mix.drone + mix.seeker + mix.spinner + mix.formation + mix.turret;
      let r = roll * total;
      const bands: [number, number][] = [
        [mix.drone, 0.17],
        [mix.seeker, 0.46],
        [mix.spinner, 0.66],
        [mix.formation, 0.8],
        [mix.turret, 0.95],
      ];
      for (const [w, mapped] of bands) {
        if (r < w) {
          roll = mapped;
          break;
        }
        r -= w;
      }
    }

    const pushDrone = (x: number, y: number, vx: number, vy: number, r: number, spin: number) => {
      e.hazards.push({
        id: e.entityIdCounter++,
        type: 'drone',
        x,
        y,
        vx,
        vy,
        r,
        angle: 0,
        spin,
        color: '#f43f5e',
        grazed: false,
      });
    };

    if (roll < 0.34) {
      pushDrone(
        30 + Math.random() * (e.W - 60),
        -30,
        (Math.random() - 0.5) * 70,
        (190 + Math.random() * 115) * speedMult,
        14 + Math.random() * 8,
        (Math.random() - 0.5) * 6
      );
    } else if (roll < 0.58) {
      // Homing seeker from the side
      const side = Math.random() < 0.5 ? -25 : e.W + 25;
      e.hazards.push({
        id: e.entityIdCounter++,
        type: 'seeker',
        x: side,
        y: 60 + Math.random() * (e.H * 0.45),
        vx: side < 0 ? 140 : -140,
        vy: 95,
        speed: (215 + Math.random() * 65) * speedMult,
        r: 13,
        angle: side < 0 ? 0 : Math.PI,
        life: 5.5,
        color: '#fb923c',
        grazed: false,
      });
    } else if (roll < 0.74) {
      e.hazards.push({
        id: e.entityIdCounter++,
        type: 'spinner',
        x: 60 + Math.random() * (e.W - 120),
        y: -45,
        vx: (Math.random() - 0.5) * 45,
        vy: 160 * speedMult,
        r: 24,
        angle: Math.random() * Math.PI,
        spin: (Math.random() < 0.5 ? 1 : -1) * 2.8,
        color: '#ec4899',
        grazed: false,
      });
    } else if (roll < 0.86 && wave >= 2 && Math.random() < 0.55) {
      // Wall of mines with a gap — thread the needle for a big shard
      const spacing = 46;
      const count = Math.floor((e.W - 40) / spacing);
      const gap = 1 + Math.floor(Math.random() * Math.max(1, count - 3));
      const vy = 150 * speedMult;
      for (let i = 0; i < count; i++) {
        if (i === gap || i === gap + 1) continue;
        pushDrone(20 + spacing / 2 + i * spacing, -30, 0, vy, 12, i % 2 ? 3 : -3);
      }
      e.gems.push({
        id: e.entityIdCounter++,
        x: 20 + spacing / 2 + (gap + 0.5) * spacing,
        y: -30,
        vx: 0,
        vy,
        r: 11,
        val: 3,
        magnetized: false,
        spin: 0,
      });
    } else if (roll < 0.86 || wave < 3) {
      // Twin drones guarding a high-value shard
      const centerX = 70 + Math.random() * (e.W - 140);
      e.gems.push({
        id: e.entityIdCounter++,
        x: centerX,
        y: -35,
        vx: 0,
        vy: 170 * speedMult,
        r: 11,
        val: 3,
        magnetized: false,
        spin: 0,
      });
      for (let k = -1; k <= 1; k += 2) {
        pushDrone(centerX + k * 58, -35, 0, 170 * speedMult, 15, k * 4);
      }
    } else {
      // Turret: parks near the top and fires aimed shots
      e.hazards.push({
        id: e.entityIdCounter++,
        type: 'turret',
        x: 60 + Math.random() * (e.W - 120),
        y: -30,
        vx: 0,
        vy: 160,
        r: 17,
        angle: 0,
        hp: 3 + Math.floor(wave / 4),
        stopY: e.H * (0.12 + Math.random() * 0.16),
        shotsLeft: 3,
        fireTimer: 0.5,
        color: '#ef4444',
        grazed: false,
      });
    }
  }, [getLevel]);

  const spawnGemCluster = useCallback(() => {
    const e = engineRef.current;
    const baseX = 45 + Math.random() * (e.W - 90);
    const pattern = Math.random();
    const count = pattern < 0.5 ? 4 : 6;
    for (let i = 0; i < count; i++) {
      const offsetX = pattern < 0.5 ? (i - 1.5) * 28 : Math.sin(i * 0.9) * 42;
      e.gems.push({
        id: e.entityIdCounter++,
        x: Math.max(24, Math.min(e.W - 24, baseX + offsetX)),
        y: -20 - i * 28,
        vx: 0,
        vy: 155 + e.waveLevel * 8,
        r: 8.5,
        val: 1,
        magnetized: false,
        spin: i * 0.6,
      });
    }
  }, []);

  const spawnPowerup = useCallback(() => {
    const e = engineRef.current;
    const types = [
      { kind: 'shield' as const, color: '#38bdf8', label: 'ENERGY SHIELD' },
      { kind: 'magnet' as const, color: '#a855f7', label: 'MEGA MAGNET' },
      { kind: 'slow' as const, color: '#34d399', label: 'TIME WARP' },
      { kind: 'bomb' as const, color: '#fbbf24', label: '+1 EMP BOMB' },
    ];
    // Weapon Power shows up often until the blaster is maxed out
    const chosen =
      e.player.weaponLevel < MAX_WEAPON_LEVEL && Math.random() < 0.4
        ? POWER_PICKUP
        : types[Math.floor(Math.random() * types.length)];
    e.powerups.push({
      id: e.entityIdCounter++,
      x: 45 + Math.random() * (e.W - 90),
      y: -30,
      vy: 135,
      r: 17,
      kind: chosen.kind,
      color: chosen.color,
      label: chosen.label,
      pulse: 0,
    });
  }, []);

  /** Turrets sometimes leave a Weapon Power pickup behind. */
  const dropPower = useCallback((x: number, y: number) => {
    const e = engineRef.current;
    if (e.player.weaponLevel >= MAX_WEAPON_LEVEL || Math.random() > 0.25) return;
    e.powerups.push({ id: e.entityIdCounter++, x, y, vy: 110, r: 17, pulse: 0, ...POWER_PICKUP });
  }, []);

  // ========================================================
  // Damage & Game Lifecycle
  // ========================================================
  const finishGameOver = useCallback(
    (reason: 'crashed' | 'timeup') => {
      const e = engineRef.current;
      setGameState('GAMEOVER');
      gameStateRef.current = 'GAMEOVER';
      e.pointerActive = false;
      e.isDying = false;
      refreshMusic();

      if (reason === 'timeup') {
        sound.playSound('wave');
        flashScreen('#e879f9', 0.4);
      }

      clearComms();
      const cur = saveDataRef.current;
      const finalScore = Math.floor(e.score);
      const campaign = gameModeRef.current === 'campaign';
      const bestKey =
        gameModeRef.current === 'timed'
          ? 'bestTimed'
          : gameModeRef.current === 'hardcore'
          ? 'bestHardcore'
          : 'bestEndless';
      const previousBest = campaign ? 0 : cur[bestKey];
      const isNewRecord = !campaign && finalScore > previousBest;

      updateSave({
        ...cur,
        ...(campaign ? {} : { [bestKey]: Math.max(previousBest, finalScore) }),
        bestCombo: Math.max(cur.bestCombo, e.maxComboThisRun),
        bestFeverInRun: Math.max(cur.bestFeverInRun, e.feverCountThisRun),
        totalRuns: cur.totalRuns + 1,
        totalNearMisses: cur.totalNearMisses + e.nearMissesThisRun,
        totalBossKills: cur.totalBossKills + e.bossKillsThisRun,
        shards: cur.shards + e.runShardsEarned,
      });

      setGameOverStats({
        score: finalScore,
        shardsEarned: e.runShardsEarned,
        maxCombo: e.maxComboThisRun,
        nearMisses: e.nearMissesThisRun,
        wave: e.waveLevel,
        bossKills: e.bossKillsThisRun,
        isNewRecord,
        previousBest,
        reason,
        reachedBoss: campaign && e.stagePhase === 'boss',
      });
    },
    [updateSave, refreshMusic, flashScreen, clearComms]
  );

  const startDeath = useCallback(() => {
    const e = engineRef.current;
    const ship = getActiveShip();
    e.isDying = true;
    e.deathTimer = 1.15;
    e.pointerActive = false;
    e.player.trail = [];
    sound.playSound('gameover');
    sound.triggerHaptic([60, 40, 90]);
    e.screenShake = 24;
    flashScreen('#f43f5e', 0.55);
    addShockwave(e.player.x, e.player.y, ship.color, 220, 5);
    addShockwave(e.player.x, e.player.y, '#ffffff', 120, 3);
    spawnParticles(e.player.x, e.player.y, ship.color, 45, 340, true);
    spawnParticles(e.player.x, e.player.y, '#fb923c', 30, 240);
    spawnParticles(e.player.x, e.player.y, '#ffffff', 20, 160);
  }, [getActiveShip, addShockwave, spawnParticles, flashScreen]);

  /** Returns true if the hit killed the player. */
  const hitPlayer = useCallback((): boolean => {
    const e = engineRef.current;
    if (e.isDying) return true;
    if (e.player.invulnTimer > 0) return false;
    e.hitsTaken++;
    if (e.player.shieldCount > 0) {
      e.player.shieldCount--;
      e.player.invulnTimer = 1.4 + (saveDataRef.current.upgrades.shieldCap || 0) * 0.4;
      sound.playSound('shield_break');
      sound.triggerHaptic([35, 30, 45]);
      e.screenShake = 14;
      flashScreen('#38bdf8', 0.3);
      addShockwave(e.player.x, e.player.y, '#38bdf8', 190, 4);
      spawnParticles(e.player.x, e.player.y, '#38bdf8', 22, 240, true);
      addFloatingText(e.player.x, e.player.y - 22, 'SHIELD BROKEN!', '#7dd3fc', 15);
      if (e.player.weaponLevel > 1) {
        e.player.weaponLevel--;
        addFloatingText(e.player.x, e.player.y + 26, `POWER DOWN · LV ${e.player.weaponLevel}`, POWER_PICKUP.color, 13);
      }
      return false;
    }
    startDeath();
    return true;
  }, [addShockwave, addFloatingText, spawnParticles, flashScreen, startDeath]);

  /** Starts a run. In the campaign, `fromBoss` skips straight to the sector's Warden. */
  const startGame = useCallback((fromBoss = false) => {
    sound.ensureContext();
    sound.startBgm();
    clearComms();

    const e = engineRef.current;
    const ship = getActiveShip();
    const timed = gameModeRef.current === 'timed';
    const level = getLevel();

    e.score = 0;
    e.combo = 1;
    e.maxComboThisRun = 1;
    e.comboDecayTimer = 0;
    e.nearMissesThisRun = 0;
    e.runShardsEarned = 0;
    e.elapsedRunTime = 0;
    e.timedRemaining = 60.0;
    e.waveLevel = 1;
    e.screenShake = 0;
    e.slowMoFactor = 1.0;
    e.slowMoTimer = 0;
    e.flashAlpha = 0;

    e.feverEnergy = 0;
    e.isFeverActive = false;
    e.feverTimeLeft = 0;
    e.feverCountThisRun = 0;

    e.isDying = false;
    e.deathTimer = 0;
    e.boss = null;
    e.bossCount = 0;
    e.bossKillsThisRun = 0;
    e.nextBossTime = timed ? 26 : 55;

    e.stagePhase = 'stage';
    e.stageTimer = level && fromBoss ? level.stageTime - 1.5 : 0;
    e.bossTime = 0;
    e.hitsTaken = 0;
    e.clearTimer = 0;
    if (level) e.waveLevel = level.wave;

    e.player.x = e.W / 2;
    e.player.y = e.H * 0.76;
    e.player.targetX = e.player.x;
    e.player.targetY = e.player.y;
    e.player.trail = [];
    // Campaign pilots get one extra layer of hull plating
    e.player.shieldCount =
      (ship.stats.bonusShield && gameModeRef.current !== 'hardcore' ? 1 : 0) + (level ? 1 : 0);
    e.player.empBombs = ship.id === 'sovereign' ? 2 : 1;
    // Weapon Primer upgrades, plus a head start in the late campaign sectors
    e.player.weaponLevel = Math.min(
      MAX_WEAPON_LEVEL,
      1 + (saveDataRef.current.upgrades.primer || 0) + (level ? Math.floor(level.id / 3) : 0)
    );
    e.player.magnetTimer = 0;
    e.player.slowFieldTimer = 0;
    e.player.dashTimer = 0;
    e.player.dashCooldown = 0;
    e.player.dashMaxCooldown = 2.2 * ship.stats.dashCd;
    e.player.invulnTimer = 1.0;
    e.player.bossContactCd = 0;

    e.hazards = [];
    e.lasers = [];
    e.gems = [];
    e.powerups = [];
    e.bullets = [];
    e.particles = [];
    e.shockwaves = [];
    e.floatingTexts = [];

    e.hazardTimer = 0.4;
    e.gemTimer = 0.2;
    e.powerupTimer = 5.5;
    e.laserTimer = 6;

    setGameState('PLAYING');
    gameStateRef.current = 'PLAYING';
    refreshMusic();

    addShockwave(e.player.x, e.player.y, ship.color, 160, 4);
    showCenterBanner(
      level
        ? `${level.code} — ${level.name.toUpperCase()}`
        : timed
        ? '60 SECOND BLITZ — GO GO GO!'
        : gameModeRef.current === 'hardcore'
        ? 'HARDCORE — x2 SHARDS!'
        : 'DRAG TO FLY • DOUBLE-TAP TO DASH',
      'neon-glow-cyan'
    );
  }, [getActiveShip, getLevel, showCenterBanner, refreshMusic, addShockwave, clearComms]);

  const togglePause = useCallback(() => {
    if (gameStateRef.current === 'PLAYING') {
      if (engineRef.current.isDying) return;
      setGameState('PAUSED');
      gameStateRef.current = 'PAUSED';
      engineRef.current.pointerActive = false;
    } else if (gameStateRef.current === 'PAUSED') {
      setGameState('PLAYING');
      gameStateRef.current = 'PLAYING';
    }
    refreshMusic();
  }, [refreshMusic]);

  const clearWorld = useCallback(() => {
    const e = engineRef.current;
    e.pointerActive = false;
    e.isDying = false;
    e.boss = null;
    e.hazards = [];
    e.lasers = [];
    e.gems = [];
    e.powerups = [];
    e.bullets = [];
  }, []);

  const returnToMainMenu = useCallback(() => {
    setGameState('MENU');
    gameStateRef.current = 'MENU';
    // The menu's Launch button is for arcade modes; the campaign has its own map
    if (gameModeRef.current === 'campaign') {
      setGameMode('endless');
      gameModeRef.current = 'endless';
    }
    clearWorld();
    clearComms();
    refreshMusic();
  }, [refreshMusic, clearWorld, clearComms]);

  // ========================================================
  // Campaign flow: map → briefing → sector → debrief → results
  // ========================================================
  const openBriefing = useCallback(
    (idx: number) => {
      setLevelIndex(idx);
      levelIndexRef.current = idx;
      setGameMode('campaign');
      gameModeRef.current = 'campaign';
      setIsCampaignOpen(false);
      setStoryKind('briefing');
      setGameState('STORY');
      gameStateRef.current = 'STORY';
      clearWorld();
      clearComms();
      refreshMusic();
    },
    [clearWorld, clearComms, refreshMusic]
  );

  /** Boss is down: bank rewards and stars right away, then roll the debrief. */
  const completeLevel = useCallback(() => {
    const e = engineRef.current;
    const level = LEVELS[levelIndexRef.current];
    const cur = saveDataRef.current;
    const stars = computeStars(e.hitsTaken, e.bossTime, level.parTime);
    const prevStars = cur.campaignStars[level.id] || 0;
    const firstClear = prevStars === 0;
    const reward = firstClear ? level.reward : Math.round(level.reward * 0.25);
    const campaignStars = [...cur.campaignStars];
    campaignStars[level.id] = Math.max(prevStars, stars);

    updateSave({
      ...cur,
      shards: cur.shards + e.runShardsEarned + reward,
      campaignStars,
      campaignUnlocked: Math.max(cur.campaignUnlocked, Math.min(LEVELS.length - 1, level.id + 1)),
      bestCombo: Math.max(cur.bestCombo, e.maxComboThisRun),
      bestFeverInRun: Math.max(cur.bestFeverInRun, e.feverCountThisRun),
      totalRuns: cur.totalRuns + 1,
      totalNearMisses: cur.totalNearMisses + e.nearMissesThisRun,
      totalBossKills: cur.totalBossKills + e.bossKillsThisRun,
    });

    setLevelClearStats({
      levelId: level.id,
      stars,
      prevStars,
      score: Math.floor(e.score),
      shardsEarned: e.runShardsEarned,
      reward,
      firstClear,
      hitsTaken: e.hitsTaken,
      bossTime: e.bossTime,
      parTime: level.parTime,
    });

    clearWorld();
    clearComms();
    setStoryKind('debrief');
    setGameState('STORY');
    gameStateRef.current = 'STORY';
    refreshMusic();
  }, [updateSave, clearWorld, clearComms, refreshMusic]);

  const onStoryDone = useCallback(() => {
    if (storyKind === 'briefing') {
      startGame(false);
    } else {
      setGameState('LEVELCLEAR');
      gameStateRef.current = 'LEVELCLEAR';
    }
  }, [storyKind, startGame]);

  // Auto-pause when the tab or app goes to the background
  useEffect(() => {
    const onVis = () => {
      if (document.hidden && gameStateRef.current === 'PLAYING') togglePause();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [togglePause]);

  // ========================================================
  // ENGINE UPDATE & RENDER LOOP
  // ========================================================
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let lastTime = performance.now();
    let hudSyncCounter = 0;

    const resize = () => {
      const e = engineRef.current;
      e.W = window.innerWidth;
      e.H = window.innerHeight;
      e.dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(e.W * e.dpr);
      canvas.height = Math.floor(e.H * e.dpr);
      ctx.setTransform(e.dpr, 0, 0, e.dpr, 0, 0);

      if (e.bgStars.length === 0) {
        const layers = [
          { n: 55, size: 0.9, min: 18, max: 40, a: 0.35 },
          { n: 32, size: 1.4, min: 60, max: 110, a: 0.55 },
          { n: 14, size: 2.1, min: 140, max: 230, a: 0.8 },
        ];
        layers.forEach((L, layer) => {
          for (let i = 0; i < L.n; i++) {
            e.bgStars.push({
              x: Math.random() * e.W,
              y: Math.random() * e.H,
              size: L.size + Math.random() * 0.5,
              speed: L.min + Math.random() * (L.max - L.min),
              alpha: L.a * (0.6 + Math.random() * 0.4),
              layer,
            });
          }
        });
      }
    };
    window.addEventListener('resize', resize);
    resize();

    // ---------- Boss bridge: everything a boss behaviour may do to the world ----------
    const eng = () => engineRef.current;
    const api: BossApi = {
      get W() {
        return eng().W;
      },
      get H() {
        return eng().H;
      },
      get hard() {
        return gameModeRef.current === 'hardcore';
      },
      get fever() {
        return eng().isFeverActive;
      },
      get alive() {
        return !eng().isDying && gameStateRef.current === 'PLAYING';
      },
      get player() {
        return eng().player;
      },
      get hazards() {
        return eng().hazards;
      },
      get bullets() {
        return eng().bullets;
      },
      get powerups() {
        return eng().powerups;
      },
      nextId: () => eng().entityIdCounter++,
      shot: pushShot,
      orb: pushOrb,
      laser: spawnLaser,
      drone: (x, y, vx, vy) => {
        const e = eng();
        e.hazards.push({
          id: e.entityIdCounter++,
          type: 'drone',
          x,
          y,
          vx,
          vy,
          r: 13,
          angle: 0,
          spin: (Math.random() - 0.5) * 6,
          color: '#f43f5e',
          grazed: false,
        });
      },
      pullPlayer: (dx, dy) => {
        const e = eng();
        const p = e.player;
        p.targetX = Math.max(22, Math.min(e.W - 22, p.targetX + dx));
        p.targetY = Math.max(65, Math.min(e.H - 35, p.targetY + dy));
        // Keep touch-drag anchored so the pull isn't erased by the next pointer move
        e.playerStartX += dx;
        e.playerStartY += dy;
      },
      particles: spawnParticles,
      shockwave: addShockwave,
      text: addFloatingText,
      flash: flashScreen,
      shake: (n) => {
        const e = eng();
        e.screenShake = Math.max(e.screenShake, n);
      },
      slowmo: (factor, time) => {
        const e = eng();
        e.slowMoFactor = factor;
        e.slowMoTimer = time;
      },
      banner: showCenterBanner,
      comm: showComm,
      sfx: (name, param) => sound.playSound(name, param),
      hurtPlayer: hitPlayer,
      defeat: defeatBoss,
      clearShots: () => {
        const e = eng();
        e.hazards = e.hazards.filter((h) => {
          if (h.type !== 'shot' && h.type !== 'orb') return true;
          spawnParticles(h.x, h.y, h.color, 2, 80);
          return false;
        });
        e.lasers = [];
      },
    };
    bossApiRef.current = api;

    /** Lets the active boss react to grazes (e.g. the Wraith's scan meter). */
    const notifyGraze = (amount: number) => {
      const b = engineRef.current.boss;
      if (b && bossReady(b)) BOSSES[b.kind].graze?.(b, api, amount);
    };

    // ---------- Simulation (PLAYING only) ----------
    const update = (rawDt: number) => {
      const e = engineRef.current;
      const p = e.player;
      const alive = !e.isDying;
      const ship = getActiveShip();
      const hard = gameModeRef.current === 'hardcore';
      const level = getLevel();

      // Campaign victory lap: let the explosion play out, then roll the debrief
      if (e.stagePhase === 'clear') {
        e.clearTimer -= rawDt;
        if (e.clearTimer <= 0) {
          completeLevel();
          return;
        }
      }

      if (e.slowMoTimer > 0) {
        e.slowMoTimer -= rawDt;
        if (e.slowMoTimer <= 0) e.slowMoFactor = 1.0;
      }
      const worldDt =
        rawDt * e.slowMoFactor * (p.slowFieldTimer > 0 ? 0.52 : 1.0) * (alive ? 1 : 0.3);

      if (!alive) {
        e.deathTimer -= rawDt;
        if (e.deathTimer <= 0) {
          finishGameOver('crashed');
          return;
        }
      }

      if (alive) {
        e.elapsedRunTime += rawDt;
        const newWave = level
          ? level.wave + (e.stageTimer > level.stageTime * 0.5 ? 1 : 0)
          : 1 + Math.floor(e.elapsedRunTime / (gameModeRef.current === 'timed' ? 15 : 18));
        if (newWave > e.waveLevel) {
          e.waveLevel = newWave;
          e.score += e.waveLevel * 150;
          if (!e.boss) showCenterBanner(`SPEED LEVEL ${e.waveLevel}!`, 'neon-glow-pink');
          sound.playSound('wave');
        }

        if (gameModeRef.current === 'timed') {
          e.timedRemaining -= rawDt;
          if (e.timedRemaining <= 0) {
            e.timedRemaining = 0;
            finishGameOver('timeup');
            return;
          }
        }

        e.score += rawDt * 30 * e.combo * (e.isFeverActive ? 2 : 1);

        if (e.combo > 1 && !e.isFeverActive) {
          e.comboDecayTimer -= rawDt;
          if (e.comboDecayTimer <= 0) {
            e.combo = Math.max(1, e.combo - 1);
            e.comboDecayTimer = 2.8;
            e.comboDecayMax = 2.8;
          }
        }
      }

      if (e.isFeverActive) {
        e.feverTimeLeft -= rawDt;
        const maxFeverDur = 6.2 + (saveDataRef.current.upgrades.feverDur || 0) * 1.2;
        e.feverEnergy = Math.max(0, (e.feverTimeLeft / maxFeverDur) * 100);
        if (e.feverTimeLeft <= 0) {
          e.isFeverActive = false;
          e.feverEnergy = 0;
          p.invulnTimer = 0.8;
          refreshMusic();
        }
      }

      // Timers
      if (p.dashTimer > 0) p.dashTimer -= rawDt;
      if (p.dashCooldown > 0) p.dashCooldown = Math.max(0, p.dashCooldown - rawDt);
      if (p.invulnTimer > 0) p.invulnTimer -= rawDt;
      if (p.magnetTimer > 0) p.magnetTimer -= rawDt;
      if (p.slowFieldTimer > 0) p.slowFieldTimer -= rawDt;
      if (p.bossContactCd > 0) p.bossContactCd -= rawDt;
      if (e.grazeSoundCd > 0) e.grazeSoundCd -= rawDt;
      if (e.hitSoundCd > 0) e.hitSoundCd -= rawDt;

      const isDashingOrFever = p.dashTimer > 0 || e.isFeverActive;

      // Movement
      if (alive) {
        const kbSpeed = 520 * ship.stats.speed * rawDt;
        if (e.keys['ArrowLeft'] || e.keys['KeyA']) p.targetX -= kbSpeed;
        if (e.keys['ArrowRight'] || e.keys['KeyD']) p.targetX += kbSpeed;
        if (e.keys['ArrowUp'] || e.keys['KeyW']) p.targetY -= kbSpeed;
        if (e.keys['ArrowDown'] || e.keys['KeyS']) p.targetY += kbSpeed;
        p.targetX = Math.max(22, Math.min(e.W - 22, p.targetX));
        p.targetY = Math.max(65, Math.min(e.H - 35, p.targetY));

        const lerpRate = (p.dashTimer > 0 ? 25 : 19) * ship.stats.speed;
        const prevX = p.x;
        const prevY = p.y;
        p.x += (p.targetX - p.x) * Math.min(1, lerpRate * rawDt);
        p.y += (p.targetY - p.y) * Math.min(1, lerpRate * rawDt);
        p.vx = (p.x - prevX) / Math.max(0.001, rawDt);
        p.vy = (p.y - prevY) / Math.max(0.001, rawDt);

        const targetAngle = -Math.PI / 2 + Math.max(-0.45, Math.min(0.45, p.vx * 0.0012));
        p.angle += (targetAngle - p.angle) * 0.25;

        p.trail.unshift({ x: p.x, y: p.y, dash: isDashingOrFever });
        if (p.trail.length > 16) p.trail.pop();

        // Auto-blaster: unlocked by combo x5 (lowered by Targeting AI), Overdrive, or a boss fight
        const up = saveDataRef.current.upgrades;
        p.autoFireTimer -= rawDt;
        if ((e.combo >= Math.max(1, 5 - (up.targeting || 0)) || e.isFeverActive || e.boss) && p.autoFireTimer <= 0) {
          const interval = e.isFeverActive ? 0.11 : e.boss ? (e.combo >= 10 ? 0.12 : 0.15) : 0.24;
          p.autoFireTimer = interval / (1 + (up.fireRate || 0) * 0.08);
          const color = e.isFeverActive ? '#fbbf24' : ship.color;
          const fever = e.isFeverActive;
          const dmgMult = 1 + (up.blaster || 0) * 0.12;
          // A x12 combo still guarantees the twin blaster; Overdrive fires at least the Lv3 spread
          let lvl = Math.max(p.weaponLevel, e.combo >= 12 ? 2 : 1);
          if (fever) lvl = Math.min(MAX_WEAPON_LEVEL, Math.max(3, lvl + 1));
          // Angled side shots hit softer, except during Overdrive
          const side = fever ? 1 : 0.5;
          const fire = (dx: number, vx: number, dmg = 1) =>
            e.bullets.push({
              id: e.entityIdCounter++,
              x: p.x + dx,
              y: p.y - 18,
              vx,
              vy: -720,
              color,
              fever,
              damage: dmg * dmgMult,
            });
          if (lvl === 1) {
            fire(0, 0);
          } else if (lvl <= 3) {
            fire(-7, 0);
            fire(7, 0);
          } else {
            fire(-10, 0);
            fire(0, 0);
            fire(10, 0);
          }
          if (lvl >= 3) {
            fire(-8, -110, side);
            fire(8, 110, side);
          }
          if (lvl >= 5) {
            fire(-10, -220, side);
            fire(10, 220, side);
          }
        }
      } else {
        p.trail.pop();
      }

      // Player bullets
      for (let i = e.bullets.length - 1; i >= 0; i--) {
        const b = e.bullets[i];
        b.x += b.vx * rawDt;
        b.y += b.vy * rawDt;
        if (b.y < -20 || b.x < -20 || b.x > e.W + 20) {
          e.bullets.splice(i, 1);
          continue;
        }
        const boss = e.boss;
        if (boss && bossReady(boss)) {
          const res = BOSSES[boss.kind].bullet(boss, api, b);
          if (res) {
            e.bullets.splice(i, 1);
            if (res === 'hit') {
              spawnParticles(b.x, b.y, boss.color, 3, 120);
              e.score += 10 * e.combo;
            } else {
              spawnParticles(b.x, b.y, '#e2e8f0', 2, 140, true);
            }
            if (e.hitSoundCd <= 0) {
              sound.playSound(res === 'hit' ? 'hit' : 'block');
              e.hitSoundCd = 0.08;
            }
            continue;
          }
        }
        for (let j = e.hazards.length - 1; j >= 0; j--) {
          const h = e.hazards[j];
          if (h.type === 'shot' || h.type === 'orb') continue;
          if (Math.hypot(b.x - h.x, b.y - h.y) < h.r + 8) {
            e.bullets.splice(i, 1);
            const dmg = b.damage ?? 1;
            if (h.type === 'turret' && (h.hp || 0) > dmg) {
              h.hp = (h.hp || 1) - dmg;
              h.hitFlash = 0.06;
              spawnParticles(b.x, b.y, h.color, 4, 120);
              if (e.hitSoundCd <= 0) {
                sound.playSound('hit');
                e.hitSoundCd = 0.08;
              }
            } else {
              spawnParticles(h.x, h.y, h.color, 12, 200);
              const pts = (h.type === 'turret' ? 150 : 45) * e.combo;
              e.score += pts;
              if (h.type === 'turret') {
                addShockwave(h.x, h.y, h.color, 70);
                addFloatingText(h.x, h.y, `+${pts}`, '#c4b5fd', 14);
                dropPower(h.x, h.y);
                e.gems.push({
                  id: e.entityIdCounter++,
                  x: h.x,
                  y: h.y,
                  vx: 0,
                  vy: 120,
                  r: 10,
                  val: 2,
                  magnetized: false,
                  spin: 0,
                });
              }
              e.hazards.splice(j, 1);
            }
            break;
          }
        }
      }

      // Spawners
      if (alive && e.stagePhase !== 'clear') {
        const bossActive = !!e.boss;
        // Campaign Wardens get the stage to themselves (mostly)
        const bossSpawnMult = level ? 3.5 : 2.4;
        e.hazardTimer -= worldDt;
        if (e.hazardTimer <= 0) {
          spawnHazardWave();
          const baseInterval = Math.max(0.25, 0.76 - e.waveLevel * 0.045);
          e.hazardTimer = baseInterval * (hard ? 0.78 : 1) * (bossActive ? bossSpawnMult : 1);
        }

        e.gemTimer -= worldDt;
        if (e.gemTimer <= 0) {
          spawnGemCluster();
          e.gemTimer = 1.6;
        }

        e.powerupTimer -= rawDt;
        if (e.powerupTimer <= 0) {
          spawnPowerup();
          e.powerupTimer = 8.5 + Math.random() * 3.5;
        }

        const laserMode = level ? level.lasers : e.waveLevel >= 2 ? 'v' : 'none';
        if (laserMode !== 'none' && !bossActive) {
          e.laserTimer -= worldDt;
          if (e.laserTimer <= 0) {
            const horizontal = laserMode === 'h' || (laserMode === 'both' && Math.random() < 0.5);
            if (horizontal) spawnLaser(p.y + (Math.random() - 0.5) * 100, 'h', 1.3);
            else spawnLaser(p.x + (Math.random() - 0.5) * 120);
            e.laserTimer = Math.max(3.2, 7.5 - e.waveLevel * 0.45) * (hard ? 0.8 : 1);
          }
        }

        if (level) {
          if (e.stagePhase === 'stage') {
            e.stageTimer += rawDt;
            if (e.stageTimer >= level.stageTime) {
              e.stagePhase = 'boss';
              e.lasers = [];
              spawnBoss(level.boss);
            }
          } else if (e.boss) {
            e.bossTime += rawDt;
          }
        } else if (!bossActive && e.elapsedRunTime >= e.nextBossTime) {
          spawnBoss();
        }
      }

      // Gems
      const magnetRange = e.isFeverActive || p.magnetTimer > 0 ? 340 : ship.stats.magnetRange || 90;
      for (let i = e.gems.length - 1; i >= 0; i--) {
        const g = e.gems[i];
        g.spin += rawDt * 2;
        const dx = p.x - g.x;
        const dy = p.y - g.y;
        const dist = Math.hypot(dx, dy);

        if (alive && (dist < magnetRange || g.magnetized)) {
          const pullSpeed = e.isFeverActive || g.magnetized ? 640 : 440;
          g.x += (dx / Math.max(1, dist)) * pullSpeed * rawDt;
          g.y += (dy / Math.max(1, dist)) * pullSpeed * rawDt;
        } else {
          g.x += g.vx * worldDt;
          g.y += g.vy * worldDt;
          // Bursting shards settle into a gentle fall
          g.vx *= 1 - Math.min(1, 2.5 * worldDt);
          g.vy += (150 - g.vy) * Math.min(1, 2.5 * worldDt);
        }

        if (alive && dist < p.radius + g.r + 6) {
          const shardMult =
            (1 + (saveDataRef.current.upgrades.shardBonus || 0) * 0.2) *
            (hard ? 2 : 1) *
            (ship.stats.shardMultiplier || 1);
          e.runShardsEarned += Math.max(1, Math.round(g.val * shardMult));

          bumpCombo(1, 3.2);
          const pts = 25 * e.combo * g.val;
          e.score += pts;
          addFeverEnergy(6.5);

          sound.playSound('gem', e.combo);
          spawnParticles(g.x, g.y, g.val > 1 ? '#fde047' : '#fbbf24', 7, 130);
          addFloatingText(g.x, g.y, `+${pts}`, '#fde047', 13);

          advanceQuest('gems', 1, false);
          advanceQuest('combo', e.combo, true);

          e.gems.splice(i, 1);
          continue;
        }

        if (g.y > e.H + 50 || g.y < -400) e.gems.splice(i, 1);
      }

      // Powerups
      for (let i = e.powerups.length - 1; i >= 0; i--) {
        const pu = e.powerups[i];
        pu.x += (pu.vx || 0) * worldDt;
        pu.y += pu.vy * worldDt;
        pu.pulse += rawDt * 5;
        if (pu.kind === 'key') {
          // Root Keys drift and bounce around the lower arena until collected
          if ((pu.x < 30 && (pu.vx || 0) < 0) || (pu.x > e.W - 30 && (pu.vx || 0) > 0)) pu.vx = -(pu.vx || 0);
          if ((pu.y < e.H * 0.3 && pu.vy < 0) || (pu.y > e.H - 40 && pu.vy > 0)) pu.vy = -pu.vy;
        }
        if (pu.armTime && pu.armTime > 0) {
          pu.armTime -= rawDt;
          continue;
        }

        if (alive && Math.hypot(p.x - pu.x, p.y - pu.y) < p.radius + pu.r + 6) {
          sound.playSound(pu.kind === 'key' ? 'key' : 'powerup');
          sound.triggerHaptic(25);
          spawnParticles(pu.x, pu.y, pu.color, 16, 200);
          addShockwave(pu.x, pu.y, pu.color, 70, 2);
          const maxed = pu.kind === 'power' && p.weaponLevel >= MAX_WEAPON_LEVEL;
          const label = pu.kind !== 'power' ? pu.label : maxed ? 'MAX POWER!' : `POWER UP · LV ${p.weaponLevel + 1}`;
          addFloatingText(pu.x, pu.y - 12, label, pu.color, 14);

          if (pu.kind === 'key') {
            e.powerups.splice(i, 1);
            if (e.boss) BOSSES[e.boss.kind].key?.(e.boss, api);
            continue;
          }
          if (pu.kind === 'shield') p.shieldCount = Math.min(3, p.shieldCount + 1);
          else if (pu.kind === 'magnet') p.magnetTimer = 8.0;
          else if (pu.kind === 'slow') p.slowFieldTimer = 6.5;
          else if (pu.kind === 'bomb') p.empBombs = Math.min(5, p.empBombs + 1);
          else if (pu.kind === 'power') {
            if (maxed) e.score += 375 * e.combo;
            else p.weaponLevel++;
          }
          e.score += 125 * e.combo;
          e.powerups.splice(i, 1);
          continue;
        }
        if (pu.y > e.H + 50) e.powerups.splice(i, 1);
      }

      // Lasers
      const grazeBonus = ship.stats.grazeRadius || 28;
      for (let i = e.lasers.length - 1; i >= 0; i--) {
        const l = e.lasers[i];
        if (l.warnTime > 0) {
          l.warnTime -= worldDt;
          if (l.warnTime <= 0) {
            sound.playSound('laser_fire');
            e.screenShake = Math.max(e.screenShake, 6);
          }
          continue;
        }
        l.fireTime -= worldDt;
        if (l.fireTime <= 0) {
          e.lasers.splice(i, 1);
          continue;
        }
        if (!alive) continue;
        const dx = Math.abs((l.orient === 'h' ? p.y : p.x) - l.x);
        if (dx < l.width / 2 + p.radius * 0.5) {
          if (!isDashingOrFever && hitPlayer()) break;
        } else if (!l.grazed && dx < l.width / 2 + p.radius + grazeBonus * 0.6) {
          l.grazed = true;
          e.nearMissesThisRun++;
          bumpCombo(2, 3.5);
          const pts = 100 * e.combo;
          e.score += pts;
          addFeverEnergy(16);
          notifyGraze(2);
          sound.playSound('nearmiss');
          addFloatingText(p.x, p.y - 24, `LASER GRAZE! +${pts}`, '#fb7185', 15);
          advanceQuest('nearmiss', 1, false);
          advanceQuest('combo', e.combo, true);
        }
      }

      // Boss
      const boss = e.boss;
      if (boss) {
        const behavior = BOSSES[boss.kind];
        boss.hitFlash = Math.max(0, boss.hitFlash - rawDt);
        if (boss.timeLeft <= 0) {
          // Retreat (endless Sentinels only — campaign Wardens fight to the end)
          boss.y -= 170 * worldDt;
          if (boss.y < -boss.r * 2) {
            e.boss = null;
            e.nextBossTime = e.elapsedRunTime + 45;
            refreshMusic();
          }
        } else if (!boss.entered) {
          boss.y += Math.max(40, (boss.targetY - boss.y) * 1.6) * worldDt;
          if (boss.y >= boss.targetY - 4) boss.entered = true;
          behavior.update(boss, api, worldDt, false);
        } else {
          if (alive && boss.kind === 'sentinel') {
            boss.timeLeft -= rawDt;
            if (boss.timeLeft <= 0) showCenterBanner('THE SENTINEL RETREATED', 'neon-glow-pink');
          }
          behavior.update(boss, api, worldDt, true);
        }

        if (alive && e.boss === boss && bossReady(boss)) behavior.contact(boss, api, isDashingOrFever);
      }

      // Hazards
      for (let i = e.hazards.length - 1; i >= 0; i--) {
        const h = e.hazards[i];
        if (h.hitFlash && h.hitFlash > 0) h.hitFlash -= rawDt;

        if (h.type === 'seeker') {
          h.life = (h.life || 5.5) - worldDt;
          const desired = Math.atan2(p.y - h.y, p.x - h.x);
          let diff = desired - h.angle;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          h.angle += Math.max(-2.2, Math.min(2.2, diff)) * worldDt;
          const spd = h.speed || 220;
          h.vx = Math.cos(h.angle) * spd;
          h.vy = Math.sin(h.angle) * spd;
          h.x += h.vx * worldDt;
          h.y += h.vy * worldDt;
        } else if (h.type === 'turret') {
          const stopY = h.stopY || 120;
          if (h.y < stopY && (h.shotsLeft || 0) > 0) {
            h.y += Math.max(40, (stopY - h.y) * 2.5) * worldDt;
          } else if ((h.shotsLeft || 0) > 0) {
            h.fireTimer = (h.fireTimer || 0) - worldDt;
            if (h.fireTimer <= 0 && alive) {
              const aim = Math.atan2(p.y - h.y, p.x - h.x);
              const n = e.waveLevel >= 6 || hard ? 3 : 1;
              for (let k = 0; k < n; k++) pushShot(h.x, h.y, aim + (k - (n - 1) / 2) * 0.22, 210);
              sound.playSound('enemy_shot');
              h.shotsLeft = (h.shotsLeft || 1) - 1;
              h.fireTimer = 1.1;
            }
          } else {
            h.y += 110 * worldDt;
          }
        } else if (h.type === 'orb') {
          const tb = e.boss;
          if (h.reflected) {
            // Deflected plasma core homes in on the boss that threw it
            if (tb) {
              const a = Math.atan2(tb.y - h.y, tb.x - h.x);
              const k = Math.min(1, 6 * worldDt);
              h.vx += (Math.cos(a) * 620 - h.vx) * k;
              h.vy += (Math.sin(a) * 620 - h.vy) * k;
            }
            h.x += h.vx * worldDt;
            h.y += h.vy * worldDt;
            if (tb && bossReady(tb) && Math.hypot(tb.x - h.x, tb.y - h.y) < tb.r + h.r * 0.5) {
              spawnParticles(h.x, h.y, '#67e8f9', 20, 260, true);
              e.hazards.splice(i, 1);
              BOSSES[tb.kind].orbReturn?.(tb, api, h);
              continue;
            }
            if (h.y < -60 || h.y > e.H + 60 || h.x < -60 || h.x > e.W + 60) e.hazards.splice(i, 1);
            continue;
          }
          // Lazy homing towards the pilot until the fuse runs out
          h.fuse = (h.fuse ?? 5) - worldDt;
          let heading = Math.atan2(h.vy, h.vx);
          let diff = Math.atan2(p.y - h.y, p.x - h.x) - heading;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          heading += Math.max(-0.7, Math.min(0.7, diff)) * worldDt;
          const spd = h.speed || 125;
          h.vx = Math.cos(heading) * spd;
          h.vy = Math.sin(heading) * spd;
          h.x += h.vx * worldDt;
          h.y += h.vy * worldDt;
          if (h.fuse <= 0 || h.y > e.H - 24) {
            sound.playSound('boom');
            e.screenShake = Math.max(e.screenShake, 6);
            addShockwave(h.x, h.y, '#fb923c', 90, 3);
            spawnParticles(h.x, h.y, '#fdba74', 14, 220);
            for (let k = 0; k < 10; k++) pushShot(h.x, h.y, (k / 10) * Math.PI * 2, 150, { color: '#fdba74' });
            e.hazards.splice(i, 1);
            continue;
          }
        } else {
          if (h.ay) h.vy += h.ay * worldDt;
          h.x += h.vx * worldDt;
          h.y += h.vy * worldDt;
          h.angle += (h.spin || 0) * worldDt;
          if (h.glitch !== undefined) {
            // Glitch shots skip forward along their path
            h.glitch -= worldDt;
            if (h.glitch <= 0) {
              h.glitch = 0.5 + Math.random() * 0.3;
              const sp = Math.hypot(h.vx, h.vy) || 1;
              spawnParticles(h.x, h.y, h.color, 2, 60);
              h.x += (h.vx / sp) * 34;
              h.y += (h.vy / sp) * 34;
            }
          }
        }

        // Parry: dashing into a plasma core sends it straight back
        if (alive && h.type === 'orb' && isDashingOrFever && Math.hypot(p.x - h.x, p.y - h.y) < p.radius + h.r + 14) {
          h.reflected = true;
          const tb = e.boss;
          const a = tb ? Math.atan2(tb.y - h.y, tb.x - h.x) : -Math.PI / 2;
          h.vx = Math.cos(a) * 620;
          h.vy = Math.sin(a) * 620;
          sound.playSound('parry');
          sound.triggerHaptic([20, 20, 40]);
          e.screenShake = Math.max(e.screenShake, 10);
          e.slowMoFactor = 0.35;
          e.slowMoTimer = 0.22;
          addShockwave(h.x, h.y, '#22d3ee', 110, 4);
          spawnParticles(h.x, h.y, '#67e8f9', 18, 280, true);
          bumpCombo(3, 3.5);
          const pts = 300 * e.combo;
          e.score += pts;
          addFeverEnergy(20);
          addFloatingText(p.x, p.y - 26, `PARRY! +${pts}`, '#67e8f9', 17);
          advanceQuest('dashkill', 1, false);
          continue;
        }

        const isShot = h.type === 'shot';
        if (alive) {
          const dist = Math.hypot(p.x - h.x, p.y - h.y);
          // Bullets use a tighter hitbox so grazing them feels fair
          const hitRadius = isShot ? p.radius * 0.5 + h.r : p.radius + h.r - 4;

          if (dist < hitRadius) {
            if (isDashingOrFever) {
              if (isShot) {
                spawnParticles(h.x, h.y, SHOT_COLOR, 4, 120);
                e.score += 10 * e.combo;
              } else {
                sound.playSound('boom');
                sound.triggerHaptic(25);
                e.screenShake = 9;
                spawnParticles(h.x, h.y, '#22d3ee', 18, 250, true);
                spawnParticles(h.x, h.y, h.color, 10, 180);
                addShockwave(h.x, h.y, '#f43f5e', 80);
                bumpCombo(2, 3.2);
                const smashPts = 160 * e.combo;
                e.score += smashPts;
                addFloatingText(h.x, h.y, `SMASH! +${smashPts}`, '#67e8f9', 15);
                if (h.type === 'turret') dropPower(h.x, h.y);
                advanceQuest('dashkill', 1, false);
                advanceQuest('combo', e.combo, true);
              }
              e.hazards.splice(i, 1);
              continue;
            }
            const invuln = p.invulnTimer > 0;
            e.hazards.splice(i, 1);
            if (!invuln && hitPlayer()) break;
            continue;
          } else if (!h.grazed && dist < hitRadius + (isShot ? grazeBonus * 0.7 : grazeBonus)) {
            h.grazed = true;
            if (isShot) {
              bumpCombo(1, 3.2);
              const pts = 40 * e.combo;
              e.score += pts;
              addFeverEnergy(7);
              notifyGraze(1);
              if (e.grazeSoundCd <= 0) {
                sound.playSound('nearmiss');
                e.grazeSoundCd = 0.12;
                addFloatingText(p.x, p.y - 22, `GRAZE +${pts}`, '#f9a8d4', 12);
              }
              spawnParticles(p.x, p.y, '#f9a8d4', 3, 90);
            } else {
              e.nearMissesThisRun++;
              bumpCombo(2, 3.5);
              const grazePts = 85 * e.combo;
              e.score += grazePts;
              addFeverEnergy(18);
              notifyGraze(2.5);
              e.slowMoFactor = 0.55;
              e.slowMoTimer = 0.14;
              sound.playSound('nearmiss');
              sound.triggerHaptic(15);
              addShockwave(p.x, p.y, '#e879f9', 65, 2);
              addFloatingText(p.x, p.y - 22, `NEAR MISS! +${grazePts}`, '#f0abfc', 15);
              advanceQuest('nearmiss', 1, false);
            }
            advanceQuest('combo', e.combo, true);
          }
        }

        if (
          h.y > e.H + 70 ||
          h.x < -80 ||
          h.x > e.W + 80 ||
          (isShot && h.y < -40) ||
          (h.type === 'seeker' && (h.life || 0) <= 0)
        ) {
          e.hazards.splice(i, 1);
        }
      }

      // HUD throttle sync
      hudSyncCounter++;
      if (hudSyncCounter % 4 === 0) {
        setHudScore(e.score);
        setHudCombo(e.combo);
        setHudComboTimer(e.combo > 1 && !e.isFeverActive ? e.comboDecayTimer / e.comboDecayMax : 0);
        setHudWave(e.waveLevel);
        setHudShards(saveDataRef.current.shards + e.runShardsEarned);
        setHudTimedRemain(e.timedRemaining);
        setHudFeverEnergy(e.feverEnergy);
        setHudIsFeverActive(e.isFeverActive);
        setHudShieldCount(p.shieldCount);
        setHudMagnetTimer(p.magnetTimer);
        setHudSlowFieldTimer(p.slowFieldTimer);
        setHudEmpBombs(p.empBombs);
        setHudWeaponLevel(p.weaponLevel);
        setHudDashCooldown(p.dashCooldown);
        setHudDashMaxCooldown(p.dashMaxCooldown);
        setHudBossHp(e.boss ? Math.max(0, e.boss.hp / e.boss.maxHp) : -1);
        setHudBossName(e.boss ? e.boss.name : '');
        setHudBossStatus(e.boss && bossReady(e.boss) ? e.boss.status : '');
        setHudStageProgress(level && e.stagePhase === 'stage' ? Math.min(1, e.stageTimer / level.stageTime) : -1);
      }
    };

    // ---------- Effects (run in every state except PAUSED) ----------
    const updateFx = (dt: number) => {
      const e = engineRef.current;
      const playing = gameStateRef.current === 'PLAYING';
      const warpTarget = playing
        ? e.isFeverActive
          ? 1
          : e.player.dashTimer > 0
          ? 0.8
          : e.boss
          ? 0.25
          : 0
        : 0;
      e.warp += (warpTarget - e.warp) * Math.min(1, dt * 4);
      const speedMul = (playing ? 1 : 0.5) * (1 + e.warp * 3);

      e.gridOffsetY = (e.gridOffsetY + dt * 140 * speedMul) % 52;
      for (const s of e.bgStars) {
        s.y += s.speed * dt * speedMul;
        if (s.y > e.H + 10) {
          s.y = -10;
          s.x = Math.random() * e.W;
        }
      }

      for (let i = e.particles.length - 1; i >= 0; i--) {
        const pt = e.particles[i];
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
        const drag = 1 - Math.min(1, 1.8 * dt);
        pt.vx *= drag;
        pt.vy *= drag;
        pt.alpha -= pt.decay * dt;
        if (pt.alpha <= 0) e.particles.splice(i, 1);
      }

      for (let i = e.shockwaves.length - 1; i >= 0; i--) {
        const sw = e.shockwaves[i];
        sw.r += (sw.maxR - sw.r) * 8 * dt;
        sw.alpha -= 2.2 * dt;
        if (sw.alpha <= 0.02) e.shockwaves.splice(i, 1);
      }

      for (let i = e.floatingTexts.length - 1; i >= 0; i--) {
        const ft = e.floatingTexts[i];
        ft.age += dt;
        ft.y += ft.vy * dt;
        ft.vy *= 1 - Math.min(1, 1.5 * dt);
        if (ft.age > 0.45) ft.alpha -= 1.6 * dt;
        if (ft.alpha <= 0) e.floatingTexts.splice(i, 1);
      }

      if (e.screenShake > 0) e.screenShake = Math.max(0, e.screenShake - 38 * dt);
      if (e.flashAlpha > 0) e.flashAlpha = Math.max(0, e.flashAlpha - 2.4 * dt);
    };

    // ---------- Rendering ----------
    const render = () => {
      const e = engineRef.current;
      const p = e.player;
      const t = e.t;
      const W = e.W;
      const H = e.H;
      const st = gameStateRef.current;
      const lvl = st === 'MENU' ? null : getLevel();

      drawBackground(
        ctx,
        W,
        H,
        t,
        e.gridOffsetY,
        e.bgStars,
        e.isFeverActive && st === 'PLAYING',
        !!e.boss,
        e.warp,
        lvl?.theme
      );

      ctx.save();
      if (e.screenShake > 0) {
        ctx.translate((Math.random() - 0.5) * e.screenShake, (Math.random() - 0.5) * e.screenShake);
      }

      if (p.slowFieldTimer > 0 && st === 'PLAYING') {
        ctx.fillStyle = 'rgba(52, 211, 153, 0.05)';
        ctx.fillRect(0, 0, W, H);
      }

      for (const l of e.lasers) drawLaser(ctx, l, W, H, t);

      // Shockwaves
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const sw of e.shockwaves) {
        ctx.strokeStyle = sw.color;
        ctx.globalAlpha = Math.max(0, sw.alpha);
        ctx.lineWidth = (sw.width || 3) * (0.4 + sw.alpha);
        ctx.beginPath();
        ctx.arc(sw.x, sw.y, sw.r, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();

      for (const g of e.gems) drawGem(ctx, g, t);
      for (const pu of e.powerups) drawPowerup(ctx, pu, t);

      // Player bullets
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const b of e.bullets) {
        drawGlow(ctx, b.x, b.y, 12, b.color, 0.6);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(b.x - 1.5, b.y - 9, 3, 14);
      }
      ctx.restore();

      for (const h of e.hazards) if (h.type !== 'shot') drawHazard(ctx, h, t, p.x, p.y);
      if (e.boss) drawBossEntity(ctx, e.boss, t, p.x, p.y, W);
      for (const h of e.hazards) if (h.type === 'shot') drawHazard(ctx, h, t, p.x, p.y);

      // Player
      if ((st === 'PLAYING' || st === 'PAUSED') && !e.isDying) {
        const ship = getActiveShip();
        const mainColor = e.isFeverActive ? '#fbbf24' : ship.color;

        // Afterglow trail
        for (let i = p.trail.length - 1; i >= 1; i--) {
          const tr = p.trail[i];
          const ratio = 1 - i / p.trail.length;
          drawGlow(ctx, tr.x, tr.y + 6, p.radius * (0.6 + ratio * 0.9), tr.dash ? '#f43f5e' : mainColor, ratio * 0.45);
        }

        // Magnet field ring
        if (p.magnetTimer > 0) {
          ctx.save();
          ctx.strokeStyle = 'rgba(192, 132, 252, 0.55)';
          ctx.setLineDash([4, 8]);
          ctx.lineDashOffset = -t * 40;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius + 24 + Math.sin(t * 6) * 3, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }

        const blinking = p.invulnTimer > 0 && p.dashTimer <= 0 && !e.isFeverActive;
        ctx.save();
        ctx.translate(p.x, p.y);
        if (blinking && Math.sin(t * 40) < 0) ctx.globalAlpha = 0.35;

        // Overdrive aura
        if (e.isFeverActive) {
          drawGlow(ctx, 0, 0, p.radius * 3.5, '#fbbf24', 0.55);
          ctx.save();
          ctx.rotate(t * 5);
          ctx.strokeStyle = '#fde047';
          ctx.lineWidth = 2.5;
          for (let k = 0; k < 2; k++) {
            ctx.beginPath();
            ctx.arc(0, 0, p.radius + 12, k * Math.PI, k * Math.PI + Math.PI * 0.6);
            ctx.stroke();
          }
          ctx.restore();
        } else if (p.dashTimer > 0) {
          drawGlow(ctx, 0, 0, p.radius * 3, '#22d3ee', 0.6);
        }

        // Shield bubble
        if (p.shieldCount > 0) {
          ctx.save();
          ctx.rotate(t * 0.8);
          ctx.beginPath();
          const sr = p.radius + 10;
          for (let k = 0; k < 6; k++) {
            const a = (k / 6) * Math.PI * 2;
            if (k === 0) ctx.moveTo(Math.cos(a) * sr, Math.sin(a) * sr);
            else ctx.lineTo(Math.cos(a) * sr, Math.sin(a) * sr);
          }
          ctx.closePath();
          ctx.fillStyle = 'rgba(56, 189, 248, 0.12)';
          ctx.fill();
          ctx.strokeStyle = `rgba(125, 211, 252, ${0.6 + Math.sin(t * 5) * 0.25})`;
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.restore();
        }

        ctx.rotate(p.angle + Math.PI / 2);
        const thrust = p.dashTimer > 0 ? 2 : e.isFeverActive ? 1.6 : 1 + Math.max(0, -p.vy) * 0.002;
        drawShip(
          ctx,
          ship.id,
          p.radius,
          mainColor,
          e.isFeverActive ? '#b45309' : ship.secondary,
          t,
          thrust
        );
        ctx.restore();
      }

      // Particles
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';
      for (const pt of e.particles) {
        const a = Math.max(0, pt.alpha);
        if (pt.streak) {
          ctx.strokeStyle = hexToRgba(pt.color, a);
          ctx.lineWidth = pt.r * 0.8;
          ctx.beginPath();
          ctx.moveTo(pt.x, pt.y);
          ctx.lineTo(pt.x - pt.vx * 0.045, pt.y - pt.vy * 0.045);
          ctx.stroke();
        } else {
          drawGlow(ctx, pt.x, pt.y, pt.r * 3.2, pt.color, a);
        }
      }
      ctx.restore();

      if (lvl?.fog && (st === 'PLAYING' || st === 'PAUSED')) drawFog(ctx, W, H, p.x, p.y, 240, t);

      // Floating texts with a pop-in scale
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      for (const ft of e.floatingTexts) {
        const pop = 1 + Math.max(0, 1 - ft.age * 7) * 0.5;
        ctx.globalAlpha = Math.max(0, ft.alpha);
        ctx.font = `700 ${Math.round(ft.size * pop)}px 'Orbitron', 'Rajdhani', system-ui, sans-serif`;
        ctx.strokeStyle = 'rgba(2, 6, 23, 0.85)';
        ctx.lineWidth = 4;
        ctx.strokeText(ft.text, ft.x, ft.y);
        ctx.fillStyle = ft.color;
        ctx.fillText(ft.text, ft.x, ft.y);
      }
      ctx.restore();

      ctx.restore();

      if (e.flashAlpha > 0) {
        ctx.fillStyle = hexToRgba(e.flashColor, e.flashAlpha * 0.6);
        ctx.fillRect(0, 0, W, H);
      }
      drawVignette(ctx, W, H);
    };

    const loop = (now: number) => {
      const rawDt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;
      const e = engineRef.current;
      const st = gameStateRef.current;

      if (st !== 'PAUSED') e.t += rawDt;
      if (st === 'PLAYING') update(rawDt);
      if (gameStateRef.current !== 'PAUSED') updateFx(rawDt);
      render();

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, [
    getActiveShip,
    getLevel,
    advanceQuest,
    spawnHazardWave,
    spawnGemCluster,
    spawnPowerup,
    dropPower,
    spawnLaser,
    spawnBoss,
    pushShot,
    pushOrb,
    spawnParticles,
    addShockwave,
    addFloatingText,
    addFeverEnergy,
    bumpCombo,
    flashScreen,
    defeatBoss,
    hitPlayer,
    finishGameOver,
    completeLevel,
    showCenterBanner,
    showComm,
    refreshMusic,
  ]);

  // ========================================================
  // TOUCH & POINTER GESTURES
  // ========================================================
  const onPointerDown = useCallback(
    (clientX: number, clientY: number) => {
      sound.ensureContext();
      if (gameStateRef.current !== 'PLAYING') return;

      const e = engineRef.current;
      const now = performance.now();
      if (now - e.lastTapTime < 260) triggerDash();
      e.lastTapTime = now;

      e.pointerActive = true;
      e.pointerStartX = clientX;
      e.pointerStartY = clientY;
      e.playerStartX = e.player.targetX;
      e.playerStartY = e.player.targetY;
    },
    [triggerDash]
  );

  const onPointerMove = useCallback((clientX: number, clientY: number) => {
    const e = engineRef.current;
    if (!e.pointerActive || gameStateRef.current !== 'PLAYING' || e.isDying) return;
    const dx = (clientX - e.pointerStartX) * 1.18;
    const dy = (clientY - e.pointerStartY) * 1.18;
    const margin = 22;
    e.player.targetX = Math.max(margin, Math.min(e.W - margin, e.playerStartX + dx));
    e.player.targetY = Math.max(margin + 50, Math.min(e.H - margin - 20, e.playerStartY + dy));
  }, []);

  const onPointerUp = useCallback(() => {
    engineRef.current.pointerActive = false;
  }, []);

  // Keyboard handlers
  useEffect(() => {
    const onKeyDown = (evt: KeyboardEvent) => {
      engineRef.current.keys[evt.code] = true;
      if (gameStateRef.current === 'PLAYING') {
        if (evt.code === 'Space' || evt.code === 'ShiftLeft' || evt.code === 'ShiftRight') {
          evt.preventDefault();
          triggerDash();
        } else if (evt.code === 'KeyE' || evt.code === 'KeyB') {
          triggerEmp();
        } else if (evt.code === 'Escape' || evt.code === 'KeyP') {
          togglePause();
        }
      } else if (gameStateRef.current === 'PAUSED' && (evt.code === 'Escape' || evt.code === 'KeyP')) {
        togglePause();
      }
    };

    const onKeyUp = (evt: KeyboardEvent) => {
      engineRef.current.keys[evt.code] = false;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [triggerDash, triggerEmp, togglePause]);

  return (
    <div className="relative w-full h-full overflow-hidden select-none bg-[#050510]">
      <canvas
        ref={canvasRef}
        className="block w-full h-full cursor-crosshair touch-none"
        onTouchStart={(e) => {
          if (e.touches.length > 0) onPointerDown(e.touches[0].clientX, e.touches[0].clientY);
        }}
        onTouchMove={(e) => {
          if (e.touches.length > 0) onPointerMove(e.touches[0].clientX, e.touches[0].clientY);
        }}
        onTouchEnd={onPointerUp}
        onMouseDown={(e) => onPointerDown(e.clientX, e.clientY)}
        onMouseMove={(e) => onPointerMove(e.clientX, e.clientY)}
        onMouseUp={onPointerUp}
        onMouseLeave={onPointerUp}
      />

      {gameState === 'PLAYING' && (
        <HUD
          score={hudScore}
          combo={hudCombo}
          comboTimer={hudComboTimer}
          shards={hudShards}
          waveLevel={hudWave}
          gameMode={gameMode}
          timedRemaining={hudTimedRemain}
          feverEnergy={hudFeverEnergy}
          isFeverActive={hudIsFeverActive}
          shieldCount={hudShieldCount}
          magnetTimer={hudMagnetTimer}
          slowFieldTimer={hudSlowFieldTimer}
          empBombs={hudEmpBombs}
          weaponLevel={hudWeaponLevel}
          dashCooldown={hudDashCooldown}
          dashMaxCooldown={hudDashMaxCooldown}
          bossHp={hudBossHp}
          bossName={hudBossName}
          bossStatus={hudBossStatus}
          stageProgress={hudStageProgress}
          level={gameMode === 'campaign' ? LEVELS[levelIndex] : null}
          comm={hudComm}
          currentQuest={currentQuest}
          questProgress={saveData.questProgress}
          centerBannerText={centerBannerText}
          isBannerVisible={isBannerVisible}
          bannerColorClass={bannerColorClass}
          isMuted={isMuted}
          isBgmMuted={isBgmMuted}
          onToggleMute={toggleMute}
          onToggleBgm={toggleBgm}
          onPause={togglePause}
          onTriggerDash={triggerDash}
          onTriggerEmp={triggerEmp}
        />
      )}

      {gameState === 'MENU' && (
        <MainMenu
          saveData={saveData}
          gameMode={gameMode}
          onSelectMode={setGameMode}
          onStartGame={() => startGame(false)}
          onOpenCampaign={() => setIsCampaignOpen(true)}
          onOpenShop={() => setIsShopOpen(true)}
          onOpenAchievements={() => setIsAchievementsOpen(true)}
          isMuted={isMuted}
          isBgmMuted={isBgmMuted}
          onToggleMute={toggleMute}
          onToggleBgm={toggleBgm}
        />
      )}

      {gameState === 'STORY' && (
        <StoryScreen
          key={`${levelIndex}-${storyKind}`}
          level={LEVELS[levelIndex]}
          kind={storyKind}
          isFinal={levelIndex === LEVELS.length - 1}
          onDone={onStoryDone}
          onBack={returnToMainMenu}
        />
      )}

      <PauseModal
        isOpen={gameState === 'PAUSED'}
        onResume={togglePause}
        onRestart={() => startGame(false)}
        onMainMenu={returnToMainMenu}
        isMuted={isMuted}
        isBgmMuted={isBgmMuted}
        onToggleMute={toggleMute}
        onToggleBgm={toggleBgm}
      />

      <GameOverModal
        isOpen={gameState === 'GAMEOVER'}
        stats={gameOverStats}
        gameMode={gameMode}
        level={gameMode === 'campaign' ? LEVELS[levelIndex] : null}
        onPlayAgain={() => startGame(false)}
        onRetryBoss={() => startGame(true)}
        onOpenShop={() => {
          returnToMainMenu();
          setIsShopOpen(true);
        }}
        onMainMenu={returnToMainMenu}
      />

      <LevelClearModal
        isOpen={gameState === 'LEVELCLEAR'}
        stats={levelClearStats}
        onNext={() => openBriefing(Math.min(LEVELS.length - 1, levelIndex + 1))}
        onReplay={() => openBriefing(levelIndex)}
        onMap={() => {
          returnToMainMenu();
          setIsCampaignOpen(true);
        }}
      />

      <CampaignMap
        isOpen={isCampaignOpen}
        saveData={saveData}
        onClose={() => setIsCampaignOpen(false)}
        onSelectLevel={openBriefing}
      />

      <ShopModal
        isOpen={isShopOpen}
        onClose={() => setIsShopOpen(false)}
        saveData={saveData}
        onUpdateSave={updateSave}
        onShowToast={showToast}
      />

      <AchievementsModal
        isOpen={isAchievementsOpen}
        onClose={() => setIsAchievementsOpen(false)}
        saveData={saveData}
        onClaimAchievement={claimAchievement}
      />

      {/* Toast Notification */}
      <div
        className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 pointer-events-none transition-all duration-300 ${
          toastMessage ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-3'
        }`}
      >
        <div className="px-4 py-2 rounded-full bg-slate-900/95 border border-cyan-400/60 text-cyan-100 text-xs font-bold shadow-2xl shadow-cyan-500/20 flex items-center gap-2 whitespace-nowrap">
          <Sparkles size={14} className="text-cyan-300" />
          <span>{toastMessage}</span>
        </div>
      </div>
    </div>
  );
};
