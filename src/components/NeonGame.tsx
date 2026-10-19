import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  BulletEntity,
  FloatingTextEntity,
  GameMode,
  GameState,
  GemEntity,
  HazardEntity,
  ParticleEntity,
  PowerupEntity,
  SaveData,
  ShipDef,
  ShockwaveEntity,
  StarEntity,
} from '../types/game';
import { sound } from '../utils/audio';
import { QUESTS, SHIPS } from '../utils/constants';
import { loadGameSave, saveGameData } from '../utils/storage';
import { AchievementsModal } from './AchievementsModal';
import { GameOverModal } from './GameOverModal';
import { HUD } from './HUD';
import { MainMenu } from './MainMenu';
import { PauseModal } from './PauseModal';
import { ShopModal } from './ShopModal';

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

  // Active Modals
  const [isShopOpen, setIsShopOpen] = useState(false);
  const [isAchievementsOpen, setIsAchievementsOpen] = useState(false);

  // In-Game Live Metrics for React HUD (synced on frame or throttled)
  const [hudScore, setHudScore] = useState(0);
  const [hudCombo, setHudCombo] = useState(1);
  const [hudWave, setHudWave] = useState(1);
  const [hudShards, setHudShards] = useState(saveData.shards);
  const [hudTimedRemain, setHudTimedRemain] = useState(60.0);
  const [hudFeverEnergy, setHudFeverEnergy] = useState(0);
  const [hudIsFeverActive, setHudIsFeverActive] = useState(false);
  const [hudShieldCount, setHudShieldCount] = useState(0);
  const [hudMagnetTimer, setHudMagnetTimer] = useState(0);
  const [hudSlowFieldTimer, setHudSlowFieldTimer] = useState(0);
  const [hudEmpBombs, setHudEmpBombs] = useState(1);
  const [hudDashCooldown, setHudDashCooldown] = useState(0);
  const [hudDashMaxCooldown, setHudDashMaxCooldown] = useState(2.2);

  // Banner & Toast feedback
  const [centerBannerText, setCenterBannerText] = useState('');
  const [isBannerVisible, setIsBannerVisible] = useState(false);
  const [bannerColorClass, setBannerColorClass] = useState('neon-glow-cyan');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Game Over summary state
  const [gameOverStats, setGameOverStats] = useState({
    score: 0,
    shardsEarned: 0,
    maxCombo: 1,
    nearMisses: 0,
    isNewRecord: false,
    reason: 'crashed' as 'crashed' | 'timeup',
  });

  // Sound toggles
  const [isMuted, setIsMuted] = useState(saveData.muted);
  const [isBgmMuted, setIsBgmMuted] = useState(saveData.bgmMuted);

  // Helper: Show banner
  const bannerTimeoutRef = useRef<number | null>(null);
  const showCenterBanner = useCallback((text: string, colorClass = 'neon-glow-cyan') => {
    setCenterBannerText(text);
    setBannerColorClass(colorClass);
    setIsBannerVisible(true);
    if (bannerTimeoutRef.current) window.clearTimeout(bannerTimeoutRef.current);
    bannerTimeoutRef.current = window.setTimeout(() => {
      setIsBannerVisible(false);
    }, 1400);
  }, []);

  // Helper: Toast
  const toastTimeoutRef = useRef<number | null>(null);
  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    if (toastTimeoutRef.current) window.clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = window.setTimeout(() => {
      setToastMessage(null);
    }, 2400);
  }, []);

  // Sync sound settings with Audio engine
  useEffect(() => {
    sound.setMuted(saveData.muted);
    sound.setBgmMuted(saveData.bgmMuted);
    setIsMuted(saveData.muted);
    setIsBgmMuted(saveData.bgmMuted);
  }, [saveData.muted, saveData.bgmMuted]);

  const updateSave = useCallback((newSave: SaveData) => {
    setSaveData(newSave);
    saveGameData(newSave);
  }, []);

  const toggleMute = useCallback(() => {
    const updated = !saveDataRef.current.muted;
    sound.setMuted(updated);
    setIsMuted(updated);
    const newSave = { ...saveDataRef.current, muted: updated };
    updateSave(newSave);
    if (!updated) sound.playSound('gem', 4);
  }, [updateSave]);

  const toggleBgm = useCallback(() => {
    const updated = !saveDataRef.current.bgmMuted;
    sound.setBgmMuted(updated);
    setIsBgmMuted(updated);
    const newSave = { ...saveDataRef.current, bgmMuted: updated };
    updateSave(newSave);
  }, [updateSave]);

  const claimAchievement = useCallback(
    (achievementId: string, reward: number) => {
      const cur = saveDataRef.current;
      if (cur.unlockedAchievements.includes(achievementId)) return;
      const newSave: SaveData = {
        ...cur,
        shards: cur.shards + reward,
        unlockedAchievements: [...cur.unlockedAchievements, achievementId],
      };
      updateSave(newSave);
      showToast(`🏆 Đã nhận phần thưởng: +${reward} 💎!`);
    },
    [updateSave, showToast]
  );

  // Quest Tracker & Progression
  const currentQuest = QUESTS[saveData.questIndex % QUESTS.length];

  const advanceQuest = useCallback(
    (type: 'nearmiss' | 'combo' | 'dashkill' | 'gems' | 'fever', amount: number, isAbsolute = false) => {
      const cur = saveDataRef.current;
      const q = QUESTS[cur.questIndex % QUESTS.length];
      if (q.type !== type) return;

      const newProg = isAbsolute ? Math.max(cur.questProgress, amount) : cur.questProgress + amount;
      if (newProg >= q.target) {
        // Complete!
        const nextIndex = (cur.questIndex + 1) % QUESTS.length;
        const newSave: SaveData = {
          ...cur,
          shards: cur.shards + q.reward,
          questIndex: nextIndex,
          questProgress: 0,
        };
        updateSave(newSave);
        sound.playSound('powerup');
        showToast(`Hoàn thành nhiệm vụ: ${q.label}! +${q.reward} 💎`);
      } else {
        const newSave: SaveData = {
          ...cur,
          questProgress: newProg,
        };
        updateSave(newSave);
      }
    },
    [updateSave, showToast]
  );

  // ========================================================
  // REFS & ENGINE DATA (Runs inside 60FPS Animation Loop)
  // ========================================================
  const engineRef = useRef({
    // Canvas dimensions
    W: window.innerWidth,
    H: window.innerHeight,
    dpr: Math.min(window.devicePixelRatio || 1, 2),

    // Run metrics
    score: 0,
    combo: 1,
    maxComboThisRun: 1,
    comboDecayTimer: 0,
    nearMissesThisRun: 0,
    runShardsEarned: 0,
    elapsedRunTime: 0,
    timedRemaining: 60.0,
    waveLevel: 1,
    screenShake: 0,
    slowMoFactor: 1.0,
    slowMoTimer: 0,
    gridOffsetY: 0,

    // Fever / Overdrive
    feverEnergy: 0,
    isFeverActive: false,
    feverTimeLeft: 0,

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
      angle: -Math.PI / 2,
    },

    // Entity collections
    hazards: [] as HazardEntity[],
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

  // Particles & Visual Shockwaves
  const spawnParticles = useCallback((x: number, y: number, color: string, count = 12, speed = 180) => {
    const e = engineRef.current;
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = (0.25 + Math.random() * 0.75) * speed;
      e.particles.push({
        x,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        r: Math.random() * 3.5 + 1.5,
        color,
        alpha: 1,
        decay: 1.4 + Math.random() * 1.2,
      });
    }
  }, []);

  const addFloatingText = useCallback((x: number, y: number, text: string, color = '#ffffff', size = 14) => {
    const e = engineRef.current;
    e.floatingTexts.push({
      x: Math.max(50, Math.min(e.W - 50, x)),
      y,
      vy: -55,
      text,
      color,
      size,
      alpha: 1,
    });
  }, []);

  // Abilities
  const triggerDash = useCallback(() => {
    if (gameStateRef.current !== 'PLAYING') return;
    const e = engineRef.current;
    if (e.player.dashCooldown > 0) return;

    e.player.dashTimer = 0.38;
    const cdReduction = 1 - (saveDataRef.current.upgrades.dashCd || 0) * 0.1;
    const ship = getActiveShip();
    e.player.dashMaxCooldown = Math.max(0.8, 2.2 * cdReduction * ship.stats.dashCd);
    e.player.dashCooldown = e.player.dashMaxCooldown;
    e.player.invulnTimer = Math.max(e.player.invulnTimer, 0.45);

    sound.playSound('dash');
    sound.triggerHaptic(30);
    e.screenShake = 8;

    e.shockwaves.push({
      x: e.player.x,
      y: e.player.y,
      r: 10,
      maxR: 120,
      color: '#22d3ee',
      alpha: 1,
    });
    spawnParticles(e.player.x, e.player.y, '#22d3ee', 18, 260);
    addFloatingText(e.player.x, e.player.y - 24, 'LƯỚT SIÊU TỐC!', '#22d3ee', 16);
  }, [getActiveShip, spawnParticles, addFloatingText]);

  const triggerEmp = useCallback(() => {
    if (gameStateRef.current !== 'PLAYING') return;
    const e = engineRef.current;
    if (e.player.empBombs <= 0) return;

    e.player.empBombs--;
    e.player.invulnTimer = Math.max(e.player.invulnTimer, 1.4);
    sound.playSound('boom');
    sound.triggerHaptic([40, 30, 60]);
    e.screenShake = 18;

    e.shockwaves.push({
      x: e.player.x,
      y: e.player.y,
      r: 15,
      maxR: Math.max(e.W, e.H) * 0.95,
      color: '#fbbf24',
      alpha: 1,
    });

    let converted = 0;
    for (let i = e.hazards.length - 1; i >= 0; i--) {
      const h = e.hazards[i];
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
      });
      e.hazards.splice(i, 1);
      converted++;
    }

    const bonus = converted * 80 * e.combo;
    e.score += bonus;
    showCenterBanner(`💥 BÃO TỪ EMP! +${bonus.toLocaleString()} ĐIỂM`, 'neon-glow-amber');
  }, [spawnParticles, showCenterBanner]);

  const activateFeverMode = useCallback(() => {
    const e = engineRef.current;
    e.isFeverActive = true;
    const extraDur = (saveDataRef.current.upgrades.feverDur || 0) * 1.2;
    e.feverTimeLeft = 6.2 + extraDur;
    e.feverEnergy = 100;
    e.player.invulnTimer = Math.max(e.player.invulnTimer, e.feverTimeLeft);

    sound.playSound('fever');
    sound.triggerHaptic([35, 25, 55]);
    e.screenShake = 14;

    e.shockwaves.push({
      x: e.player.x,
      y: e.player.y,
      r: 14,
      maxR: 280,
      color: '#f43f5e',
      alpha: 1,
    });

    showCenterBanner('🔥 CUỒNG NỘ BẤT TỬ! HÚC NỔ MỌI VẬT CẢN!', 'neon-glow-amber');
    advanceQuest('fever', 1, false);
  }, [advanceQuest, showCenterBanner]);

  const addFeverEnergy = useCallback(
    (amt: number) => {
      const e = engineRef.current;
      if (e.isFeverActive) return;
      e.feverEnergy = Math.min(100, e.feverEnergy + amt);
      if (e.feverEnergy >= 100) {
        activateFeverMode();
      }
    },
    [activateFeverMode]
  );

  // Spawners
  const spawnHazardWave = useCallback(() => {
    const e = engineRef.current;
    const speedMult =
      (gameModeRef.current === 'hardcore' ? 1.34 : 1.0) + (e.waveLevel - 1) * 0.1;
    const roll = Math.random();

    if (roll < 0.38) {
      // Type 1: Falling Cyber Drone
      const x = 30 + Math.random() * (e.W - 60);
      const r = 14 + Math.random() * 8;
      e.hazards.push({
        id: e.entityIdCounter++,
        type: 'drone',
        x,
        y: -30,
        vx: (Math.random() - 0.5) * 70,
        vy: (190 + Math.random() * 115) * speedMult,
        r,
        angle: 0,
        spin: (Math.random() - 0.5) * 6,
        color: '#f43f5e',
        grazed: false,
      });
    } else if (roll < 0.68) {
      // Type 2: Homing Seeker
      const side = Math.random() < 0.5 ? -25 : e.W + 25;
      const y = 60 + Math.random() * (e.H * 0.45);
      e.hazards.push({
        id: e.entityIdCounter++,
        type: 'seeker',
        x: side,
        y,
        vx: side < 0 ? 140 : -140,
        vy: 95,
        speed: (215 + Math.random() * 65) * speedMult,
        r: 13,
        angle: Math.PI / 2,
        life: 5.5,
        color: '#fb923c',
        grazed: false,
      });
    } else if (roll < 0.88) {
      // Type 3: Rotating Laser Spinner
      const x = 60 + Math.random() * (e.W - 120);
      e.hazards.push({
        id: e.entityIdCounter++,
        type: 'spinner',
        x,
        y: -45,
        vx: (Math.random() - 0.5) * 45,
        vy: 160 * speedMult,
        r: 23,
        angle: Math.random() * Math.PI,
        spin: (Math.random() < 0.5 ? 1 : -1) * 2.8,
        color: '#ec4899',
        grazed: false,
      });
    } else {
      // Type 4: Wave Splitter with high-value Gem in middle
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
      });
      for (let k = -1; k <= 1; k += 2) {
        e.hazards.push({
          id: e.entityIdCounter++,
          type: 'drone',
          x: centerX + k * 58,
          y: -35,
          vx: 0,
          vy: 170 * speedMult,
          r: 15,
          angle: 0,
          spin: k * 4,
          color: '#f43f5e',
          grazed: false,
        });
      }
    }
  }, []);

  const spawnGemCluster = useCallback(() => {
    const e = engineRef.current;
    const baseX = 45 + Math.random() * (e.W - 90);
    const pattern = Math.random();
    const count = pattern < 0.5 ? 4 : 6;
    for (let i = 0; i < count; i++) {
      const offsetX = pattern < 0.5 ? (i - 1.5) * 28 : Math.sin(i * 0.9) * 42;
      const offsetY = -20 - i * 28;
      e.gems.push({
        id: e.entityIdCounter++,
        x: Math.max(24, Math.min(e.W - 24, baseX + offsetX)),
        y: offsetY,
        vx: 0,
        vy: 155 + e.waveLevel * 8,
        r: 8.5,
        val: 1,
        magnetized: false,
      });
    }
  }, []);

  const spawnPowerup = useCallback(() => {
    const e = engineRef.current;
    const types = [
      { kind: 'shield' as const, icon: '🛡️', color: '#38bdf8', label: 'KHIÊN TỪ TRƯỜNG' },
      { kind: 'magnet' as const, icon: '🧲', color: '#a855f7', label: 'SIÊU NAM CHÂM' },
      { kind: 'slow' as const, icon: '⏳', color: '#34d399', label: 'NGƯNG ĐỌNG THỜI GIAN' },
      { kind: 'bomb' as const, icon: '💥', color: '#fbbf24', label: '+1 BÃO TỪ EMP' },
    ];
    const chosen = types[Math.floor(Math.random() * types.length)];
    e.powerups.push({
      id: e.entityIdCounter++,
      x: 45 + Math.random() * (e.W - 90),
      y: -30,
      vy: 135,
      r: 16,
      kind: chosen.kind,
      icon: chosen.icon,
      color: chosen.color,
      label: chosen.label,
      pulse: 0,
    });
  }, []);

  // Game Lifecycle
  const startGame = useCallback(() => {
    sound.ensureContext();
    sound.startBgm();

    const e = engineRef.current;
    const ship = getActiveShip();

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

    e.feverEnergy = 0;
    e.isFeverActive = false;
    e.feverTimeLeft = 0;

    e.player.x = e.W / 2;
    e.player.y = e.H * 0.76;
    e.player.targetX = e.player.x;
    e.player.targetY = e.player.y;
    e.player.trail = [];
    e.player.shieldCount = ship.stats.bonusShield && gameModeRef.current !== 'hardcore' ? 1 : 0;
    e.player.empBombs = ship.id === 'sovereign' ? 2 : 1;
    e.player.magnetTimer = 0;
    e.player.slowFieldTimer = 0;
    e.player.dashTimer = 0;
    e.player.dashCooldown = 0;
    e.player.dashMaxCooldown = 2.2 * ship.stats.dashCd;
    e.player.invulnTimer = 1.0;

    e.hazards = [];
    e.gems = [];
    e.powerups = [];
    e.bullets = [];
    e.particles = [];
    e.shockwaves = [];
    e.floatingTexts = [];

    e.hazardTimer = 0.4;
    e.gemTimer = 0.2;
    e.powerupTimer = 5.5;

    setGameState('PLAYING');
    gameStateRef.current = 'PLAYING';

    showCenterBanner(
      gameModeRef.current === 'timed'
        ? '⏱️ TỬ CHIẾN 60 GIÂY — BỨT TỐC!'
        : gameModeRef.current === 'hardcore'
        ? '💀 CHẾ ĐỘ SIÊU KHÓ — X2 TINH THỂ!'
        : '🚀 KÉO ĐỂ NÉ • CHẠM ĐÚP ĐỂ LƯỚT!',
      'neon-glow-cyan'
    );
  }, [getActiveShip, showCenterBanner]);

  const triggerGameOver = useCallback(
    (reason: 'crashed' | 'timeup') => {
      const e = engineRef.current;
      setGameState('GAMEOVER');
      gameStateRef.current = 'GAMEOVER';
      e.pointerActive = false;

      sound.playSound('gameover');
      sound.triggerHaptic([60, 40, 90]);
      e.screenShake = 18;

      const cur = saveDataRef.current;
      const finalScore = Math.floor(e.score);
      let isNewRecord = false;

      if (gameModeRef.current === 'endless' && finalScore > cur.bestEndless) {
        cur.bestEndless = finalScore;
        isNewRecord = true;
      } else if (gameModeRef.current === 'timed' && finalScore > cur.bestTimed) {
        cur.bestTimed = finalScore;
        isNewRecord = true;
      } else if (gameModeRef.current === 'hardcore' && finalScore > cur.bestHardcore) {
        cur.bestHardcore = finalScore;
        isNewRecord = true;
      }

      if (e.maxComboThisRun > cur.bestCombo) {
        cur.bestCombo = e.maxComboThisRun;
      }

      cur.totalRuns += 1;
      cur.totalNearMisses += e.nearMissesThisRun;
      cur.shards += e.runShardsEarned;

      updateSave(cur);

      setGameOverStats({
        score: finalScore,
        shardsEarned: e.runShardsEarned,
        maxCombo: e.maxComboThisRun,
        nearMisses: e.nearMissesThisRun,
        isNewRecord,
        reason,
      });
    },
    [updateSave]
  );

  const togglePause = useCallback(() => {
    if (gameStateRef.current === 'PLAYING') {
      setGameState('PAUSED');
      gameStateRef.current = 'PAUSED';
      engineRef.current.pointerActive = false;
    } else if (gameStateRef.current === 'PAUSED') {
      setGameState('PLAYING');
      gameStateRef.current = 'PLAYING';
    }
  }, []);

  const returnToMainMenu = useCallback(() => {
    setGameState('MENU');
    gameStateRef.current = 'MENU';
    engineRef.current.pointerActive = false;
  }, []);

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
        for (let i = 0; i < 70; i++) {
          e.bgStars.push({
            x: Math.random() * e.W,
            y: Math.random() * e.H,
            size: Math.random() * 2 + 0.6,
            speed: Math.random() * 150 + 40,
            alpha: Math.random() * 0.65 + 0.2,
          });
        }
      }
    };
    window.addEventListener('resize', resize);
    resize();

    const loop = (now: number) => {
      const rawDt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;
      const e = engineRef.current;

      if (gameStateRef.current === 'PLAYING') {
        // Slow-mo decay
        if (e.slowMoTimer > 0) {
          e.slowMoTimer -= rawDt;
          if (e.slowMoTimer <= 0) e.slowMoFactor = 1.0;
        }
        const worldDt =
          rawDt * e.slowMoFactor * (e.player.slowFieldTimer > 0 ? 0.52 : 1.0);

        e.elapsedRunTime += rawDt;
        const newWave = 1 + Math.floor(e.elapsedRunTime / 18);
        if (newWave > e.waveLevel) {
          e.waveLevel = newWave;
          e.score += e.waveLevel * 150;
          showCenterBanner(`⚡ CẤP ĐỘ TỐC ĐỘ ${e.waveLevel}!`, 'neon-glow-pink');
          sound.playSound('powerup');
        }

        if (gameModeRef.current === 'timed') {
          e.timedRemaining -= rawDt;
          if (e.timedRemaining <= 0) {
            e.timedRemaining = 0;
            triggerGameOver('timeup');
            return;
          }
        }

        // Passive survival score
        e.score += rawDt * 30 * e.combo * (e.isFeverActive ? 2 : 1);

        // Combo decay
        if (e.combo > 1 && !e.isFeverActive) {
          e.comboDecayTimer -= rawDt;
          if (e.comboDecayTimer <= 0) {
            e.combo = Math.max(1, e.combo - 1);
            e.comboDecayTimer = 2.8;
          }
        }

        // Fever / Overdrive decay
        if (e.isFeverActive) {
          e.feverTimeLeft -= rawDt;
          const maxFeverDur =
            6.2 + (saveDataRef.current.upgrades.feverDur || 0) * 1.2;
          e.feverEnergy = Math.max(0, (e.feverTimeLeft / maxFeverDur) * 100);
          if (e.feverTimeLeft <= 0) {
            e.isFeverActive = false;
            e.feverEnergy = 0;
            e.player.invulnTimer = 0.8;
          }
        }

        // Timers
        if (e.player.dashTimer > 0) e.player.dashTimer -= rawDt;
        if (e.player.dashCooldown > 0)
          e.player.dashCooldown = Math.max(0, e.player.dashCooldown - rawDt);
        if (e.player.invulnTimer > 0) e.player.invulnTimer -= rawDt;
        if (e.player.magnetTimer > 0) e.player.magnetTimer -= rawDt;
        if (e.player.slowFieldTimer > 0) e.player.slowFieldTimer -= rawDt;

        // Keyboard movement
        const kbSpeed = 500 * rawDt;
        if (e.keys['ArrowLeft'] || e.keys['KeyA']) e.player.targetX -= kbSpeed;
        if (e.keys['ArrowRight'] || e.keys['KeyD']) e.player.targetX += kbSpeed;
        if (e.keys['ArrowUp'] || e.keys['KeyW']) e.player.targetY -= kbSpeed;
        if (e.keys['ArrowDown'] || e.keys['KeyS']) e.player.targetY += kbSpeed;
        e.player.targetX = Math.max(22, Math.min(e.W - 22, e.player.targetX));
        e.player.targetY = Math.max(65, Math.min(e.H - 35, e.player.targetY));

        // Smooth ship position interpolation
        const lerpRate = e.player.dashTimer > 0 ? 25 : 19;
        const prevX = e.player.x;
        const prevY = e.player.y;
        e.player.x += (e.player.targetX - e.player.x) * Math.min(1, lerpRate * rawDt);
        e.player.y += (e.player.targetY - e.player.y) * Math.min(1, lerpRate * rawDt);
        e.player.vx = (e.player.x - prevX) / Math.max(0.001, rawDt);
        e.player.vy = (e.player.y - prevY) / Math.max(0.001, rawDt);

        const targetAngle =
          -Math.PI / 2 + Math.max(-0.45, Math.min(0.45, e.player.vx * 0.0012));
        e.player.angle += (targetAngle - e.player.angle) * 0.25;

        // Trail recording
        e.player.trail.unshift({
          x: e.player.x,
          y: e.player.y,
          dash: e.player.dashTimer > 0 || e.isFeverActive,
        });
        if (e.player.trail.length > 14) e.player.trail.pop();

        // Auto-Blaster if combo >= 5 or Overdrive
        e.player.autoFireTimer -= rawDt;
        if ((e.combo >= 5 || e.isFeverActive) && e.player.autoFireTimer <= 0) {
          e.player.autoFireTimer = e.isFeverActive ? 0.13 : 0.26;
          e.bullets.push({
            id: e.entityIdCounter++,
            x: e.player.x,
            y: e.player.y - 16,
            vy: -660,
            color: e.isFeverActive ? '#fbbf24' : '#22d3ee',
          });
        }

        // Bullets update
        for (let i = e.bullets.length - 1; i >= 0; i--) {
          const b = e.bullets[i];
          b.y += b.vy * rawDt;
          if (b.y < -20) {
            e.bullets.splice(i, 1);
            continue;
          }
          for (let j = e.hazards.length - 1; j >= 0; j--) {
            const h = e.hazards[j];
            const dist = Math.hypot(b.x - h.x, b.y - h.y);
            if (dist < h.r + 8) {
              spawnParticles(h.x, h.y, h.color, 10, 190);
              e.score += 45 * e.combo;
              e.hazards.splice(j, 1);
              e.bullets.splice(i, 1);
              break;
            }
          }
        }

        // Spawners update
        e.hazardTimer -= worldDt;
        if (e.hazardTimer <= 0) {
          spawnHazardWave();
          const baseInterval = Math.max(0.25, 0.76 - e.waveLevel * 0.045);
          e.hazardTimer =
            gameModeRef.current === 'hardcore'
              ? baseInterval * 0.78
              : baseInterval;
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

        // Gems update
        const ship = getActiveShip();
        const magnetRange =
          e.isFeverActive || e.player.magnetTimer > 0
            ? 340
            : ship.stats.magnetRange || 90;

        for (let i = e.gems.length - 1; i >= 0; i--) {
          const g = e.gems[i];
          const dx = e.player.x - g.x;
          const dy = e.player.y - g.y;
          const dist = Math.hypot(dx, dy);

          if (dist < magnetRange || g.magnetized) {
            const pullSpeed = e.isFeverActive || g.magnetized ? 640 : 440;
            g.x += (dx / Math.max(1, dist)) * pullSpeed * rawDt;
            g.y += (dy / Math.max(1, dist)) * pullSpeed * rawDt;
          } else {
            g.x += g.vx * worldDt;
            g.y += g.vy * worldDt;
          }

          if (dist < e.player.radius + g.r + 6) {
            const shardMult =
              (1 + (saveDataRef.current.upgrades.shardBonus || 0) * 0.2) *
              (gameModeRef.current === 'hardcore' ? 2 : 1) *
              (ship.stats.shardMultiplier || 1);
            const gained = Math.max(1, Math.round(g.val * shardMult));
            e.runShardsEarned += gained;

            e.combo = Math.min(30, e.combo + 1);
            e.maxComboThisRun = Math.max(e.maxComboThisRun, e.combo);
            e.comboDecayTimer = 3.2;

            const pts = 25 * e.combo * g.val;
            e.score += pts;
            addFeverEnergy(6.5);

            sound.playSound('gem', e.combo);
            spawnParticles(g.x, g.y, '#fbbf24', 7, 130);
            addFloatingText(g.x, g.y, `+${pts}`, '#fde047', 13);

            advanceQuest('gems', 1, false);
            advanceQuest('combo', e.combo, true);

            e.gems.splice(i, 1);
            continue;
          }

          if (g.y > e.H + 50) {
            e.gems.splice(i, 1);
          }
        }

        // Powerups update
        for (let i = e.powerups.length - 1; i >= 0; i--) {
          const p = e.powerups[i];
          p.y += p.vy * rawDt;
          p.pulse += rawDt * 5;

          const dist = Math.hypot(e.player.x - p.x, e.player.y - p.y);
          if (dist < e.player.radius + p.r + 6) {
            sound.playSound('powerup');
            sound.triggerHaptic(25);
            spawnParticles(p.x, p.y, p.color, 16, 200);
            addFloatingText(p.x, p.y - 12, p.label, p.color, 14);

            if (p.kind === 'shield') {
              e.player.shieldCount = Math.min(3, e.player.shieldCount + 1);
            } else if (p.kind === 'magnet') {
              e.player.magnetTimer = 8.0;
            } else if (p.kind === 'slow') {
              e.player.slowFieldTimer = 6.5;
            } else if (p.kind === 'bomb') {
              e.player.empBombs = Math.min(5, e.player.empBombs + 1);
            }
            e.score += 125 * e.combo;
            e.powerups.splice(i, 1);
            continue;
          }

          if (p.y > e.H + 50) {
            e.powerups.splice(i, 1);
          }
        }

        // Hazards update
        const grazeBonus = ship.stats.grazeRadius || 28;
        const isDashingOrFever = e.player.dashTimer > 0 || e.isFeverActive;

        for (let i = e.hazards.length - 1; i >= 0; i--) {
          const h = e.hazards[i];

          if (h.type === 'seeker') {
            h.life = (h.life || 5.5) - worldDt;
            const desired = Math.atan2(e.player.y - h.y, e.player.x - h.x);
            let diff = desired - h.angle;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            h.angle += Math.max(-2.2, Math.min(2.2, diff)) * worldDt;
            const spd = h.speed || 220;
            h.vx = Math.cos(h.angle) * spd;
            h.vy = Math.sin(h.angle) * spd;
            h.x += h.vx * worldDt;
            h.y += h.vy * worldDt;
          } else {
            h.x += h.vx * worldDt;
            h.y += h.vy * worldDt;
            h.angle += (h.spin || 0) * worldDt;
          }

          const dist = Math.hypot(e.player.x - h.x, e.player.y - h.y);
          const hitRadius = e.player.radius + h.r - 4;

          if (dist < hitRadius) {
            if (isDashingOrFever) {
              sound.playSound('boom');
              sound.triggerHaptic(25);
              e.screenShake = 9;
              spawnParticles(h.x, h.y, '#22d3ee', 18, 250);
              e.shockwaves.push({
                x: h.x,
                y: h.y,
                r: 8,
                maxR: 80,
                color: '#f43f5e',
                alpha: 1,
              });
              e.combo = Math.min(30, e.combo + 2);
              e.maxComboThisRun = Math.max(e.maxComboThisRun, e.combo);
              e.comboDecayTimer = 3.2;
              const smashPts = 160 * e.combo;
              e.score += smashPts;
              addFloatingText(h.x, h.y, `💥 HÚC NỔ +${smashPts}`, '#22d3ee', 15);
              advanceQuest('dashkill', 1, false);
              advanceQuest('combo', e.combo, true);
              e.hazards.splice(i, 1);
              continue;
            } else if (e.player.invulnTimer > 0) {
              e.hazards.splice(i, 1);
              continue;
            } else if (e.player.shieldCount > 0) {
              e.player.shieldCount--;
              const extraShieldCap =
                (saveDataRef.current.upgrades.shieldCap || 0) * 0.4;
              e.player.invulnTimer = 1.4 + extraShieldCap;
              sound.playSound('shield_break');
              sound.triggerHaptic([35, 30, 45]);
              e.screenShake = 14;
              e.shockwaves.push({
                x: e.player.x,
                y: e.player.y,
                r: 12,
                maxR: 190,
                color: '#38bdf8',
                alpha: 1,
              });
              spawnParticles(e.player.x, e.player.y, '#38bdf8', 22, 240);
              addFloatingText(
                e.player.x,
                e.player.y - 20,
                '🛡️ VỠ KHIÊN NĂNG LƯỢNG!',
                '#38bdf8',
                15
              );
              e.hazards.splice(i, 1);
              continue;
            } else {
              spawnParticles(e.player.x, e.player.y, '#f43f5e', 35, 300);
              triggerGameOver('crashed');
              return;
            }
          } else if (!h.grazed && dist < hitRadius + grazeBonus) {
            // NEAR-MISS
            h.grazed = true;
            e.nearMissesThisRun++;
            e.combo = Math.min(30, e.combo + 2);
            e.maxComboThisRun = Math.max(e.maxComboThisRun, e.combo);
            e.comboDecayTimer = 3.5;

            const grazePts = 85 * e.combo;
            e.score += grazePts;
            addFeverEnergy(18);

            e.slowMoFactor = 0.55;
            e.slowMoTimer = 0.14;
            sound.playSound('nearmiss');
            sound.triggerHaptic(15);

            e.shockwaves.push({
              x: e.player.x,
              y: e.player.y,
              r: e.player.radius,
              maxR: 65,
              color: '#e879f9',
              alpha: 0.9,
            });
            addFloatingText(
              e.player.x,
              e.player.y - 22,
              `⚡ NÉ SÁT NÚT! +${grazePts}`,
              '#e879f9',
              15
            );

            advanceQuest('nearmiss', 1, false);
            advanceQuest('combo', e.combo, true);
          }

          if (
            h.y > e.H + 70 ||
            h.x < -80 ||
            h.x > e.W + 80 ||
            (h.type === 'seeker' && (h.life || 0) <= 0)
          ) {
            e.hazards.splice(i, 1);
          }
        }

        // Particle updates
        for (let i = e.particles.length - 1; i >= 0; i--) {
          const pt = e.particles[i];
          pt.x += pt.vx * rawDt;
          pt.y += pt.vy * rawDt;
          pt.alpha -= pt.decay * rawDt;
          if (pt.alpha <= 0) e.particles.splice(i, 1);
        }

        // Shockwaves update
        for (let i = e.shockwaves.length - 1; i >= 0; i--) {
          const sw = e.shockwaves[i];
          sw.r += (sw.maxR - sw.r) * 9 * rawDt;
          sw.alpha -= 2.4 * rawDt;
          if (sw.alpha <= 0.02) e.shockwaves.splice(i, 1);
        }

        // Floating texts update
        for (let i = e.floatingTexts.length - 1; i >= 0; i--) {
          const ft = e.floatingTexts[i];
          ft.y += ft.vy * rawDt;
          ft.alpha -= 1.15 * rawDt;
          if (ft.alpha <= 0) e.floatingTexts.splice(i, 1);
        }

        // Screen shake decay
        if (e.screenShake > 0) {
          e.screenShake = Math.max(0, e.screenShake - 38 * rawDt);
        }

        // HUD Throttle sync
        hudSyncCounter++;
        if (hudSyncCounter % 4 === 0) {
          setHudScore(e.score);
          setHudCombo(e.combo);
          setHudWave(e.waveLevel);
          setHudShards(saveDataRef.current.shards + e.runShardsEarned);
          setHudTimedRemain(e.timedRemaining);
          setHudFeverEnergy(e.feverEnergy);
          setHudIsFeverActive(e.isFeverActive);
          setHudShieldCount(e.player.shieldCount);
          setHudMagnetTimer(e.player.magnetTimer);
          setHudSlowFieldTimer(e.player.slowFieldTimer);
          setHudEmpBombs(e.player.empBombs);
          setHudDashCooldown(e.player.dashCooldown);
          setHudDashMaxCooldown(e.player.dashMaxCooldown);
        }
      }

      // ==========================================
      // CANVAS DRAWING
      // ==========================================
      ctx.save();
      if (e.screenShake > 0) {
        const sx = (Math.random() - 0.5) * e.screenShake;
        const sy = (Math.random() - 0.5) * e.screenShake;
        ctx.translate(sx, sy);
      }

      // Background
      const bgGrad = ctx.createLinearGradient(0, 0, 0, e.H);
      if (e.isFeverActive) {
        bgGrad.addColorStop(0, '#1d0526');
        bgGrad.addColorStop(1, '#080417');
      } else {
        bgGrad.addColorStop(0, '#04040e');
        bgGrad.addColorStop(1, '#090e24');
      }
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, e.W, e.H);

      // Moving Neon Grid
      e.gridOffsetY =
        (e.gridOffsetY + rawDt * (e.isFeverActive ? 340 : 160)) % 48;
      ctx.strokeStyle = e.isFeverActive
        ? 'rgba(244, 63, 94, 0.14)'
        : 'rgba(34, 211, 238, 0.08)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x < e.W; x += 48) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, e.H);
      }
      for (let y = e.gridOffsetY; y < e.H; y += 48) {
        ctx.moveTo(0, y);
        ctx.lineTo(e.W, y);
      }
      ctx.stroke();

      // Stars
      for (let i = 0; i < e.bgStars.length; i++) {
        const s = e.bgStars[i];
        s.y += s.speed * rawDt * (e.isFeverActive ? 2.2 : 1.0);
        if (s.y > e.H) {
          s.y = 0;
          s.x = Math.random() * e.W;
        }
        ctx.fillStyle = `rgba(226, 232, 240, ${s.alpha})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fill();
      }

      // Shockwaves
      for (let i = 0; i < e.shockwaves.length; i++) {
        const sw = e.shockwaves[i];
        ctx.save();
        ctx.strokeStyle = sw.color;
        ctx.globalAlpha = Math.max(0, sw.alpha);
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(sw.x, sw.y, sw.r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Gems
      for (let i = 0; i < e.gems.length; i++) {
        const g = e.gems[i];
        ctx.save();
        ctx.translate(g.x, g.y);
        ctx.fillStyle = g.val > 1 ? '#f43f5e' : '#fbbf24';
        ctx.shadowColor = g.val > 1 ? '#f43f5e' : '#fbbf24';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.moveTo(0, -g.r);
        ctx.lineTo(g.r * 0.85, 0);
        ctx.lineTo(0, g.r);
        ctx.lineTo(-g.r * 0.85, 0);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      // Powerups
      for (let i = 0; i < e.powerups.length; i++) {
        const p = e.powerups[i];
        ctx.save();
        ctx.translate(p.x, p.y);
        const ringR = p.r + Math.sin(p.pulse) * 3;
        ctx.strokeStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 14;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, ringR, 0, Math.PI * 2);
        ctx.stroke();

        ctx.font = '16px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(p.icon, 0, 1);
        ctx.restore();
      }

      // Auto-Bullets
      for (let i = 0; i < e.bullets.length; i++) {
        const b = e.bullets[i];
        ctx.save();
        ctx.fillStyle = b.color;
        ctx.shadowColor = b.color;
        ctx.shadowBlur = 10;
        ctx.fillRect(b.x - 2.5, b.y - 10, 5, 16);
        ctx.restore();
      }

      // Hazards
      for (let i = 0; i < e.hazards.length; i++) {
        const h = e.hazards[i];
        ctx.save();
        ctx.translate(h.x, h.y);
        ctx.rotate(h.angle);
        ctx.shadowColor = h.color;
        ctx.shadowBlur = 14;

        if (h.type === 'spinner') {
          ctx.strokeStyle = h.color;
          ctx.lineWidth = 5;
          ctx.beginPath();
          ctx.moveTo(-h.r, 0);
          ctx.lineTo(h.r, 0);
          ctx.moveTo(0, -h.r);
          ctx.lineTo(0, h.r);
          ctx.stroke();

          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(0, 0, 6, 0, Math.PI * 2);
          ctx.fill();
        } else if (h.type === 'seeker') {
          ctx.fillStyle = h.color;
          ctx.beginPath();
          ctx.moveTo(h.r + 4, 0);
          ctx.lineTo(-h.r, -h.r * 0.75);
          ctx.lineTo(-h.r * 0.5, 0);
          ctx.lineTo(-h.r, h.r * 0.75);
          ctx.closePath();
          ctx.fill();
        } else {
          // Drone
          ctx.fillStyle = h.color;
          ctx.beginPath();
          const spikes = 6;
          for (let s = 0; s < spikes * 2; s++) {
            const rad = s % 2 === 0 ? h.r : h.r * 0.58;
            const a = (s * Math.PI) / spikes;
            if (s === 0) ctx.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
            else ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
          }
          ctx.closePath();
          ctx.fill();

          ctx.fillStyle = '#0f172a';
          ctx.beginPath();
          ctx.arc(0, 0, h.r * 0.35, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      // Ship & Trail
      if (
        gameStateRef.current === 'PLAYING' ||
        gameStateRef.current === 'PAUSED'
      ) {
        const ship = getActiveShip();
        const mainColor = e.isFeverActive
          ? '#fbbf24'
          : e.player.dashTimer > 0
          ? '#ffffff'
          : ship.color;

        // Trail
        for (let i = 0; i < e.player.trail.length; i++) {
          const tr = e.player.trail[i];
          const ratio = 1 - i / e.player.trail.length;
          ctx.save();
          ctx.fillStyle = tr.dash ? '#f43f5e' : mainColor;
          ctx.globalAlpha = ratio * 0.42;
          ctx.beginPath();
          ctx.arc(tr.x, tr.y, e.player.radius * ratio * 0.85, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        // Ship
        ctx.save();
        ctx.translate(e.player.x, e.player.y);
        ctx.rotate(e.player.angle + Math.PI / 2);

        // Aura
        if (e.isFeverActive || e.player.dashTimer > 0) {
          ctx.strokeStyle = e.isFeverActive ? '#fbbf24' : '#22d3ee';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(
            0,
            0,
            e.player.radius + 9 + Math.sin(performance.now() * 0.02) * 3,
            0,
            Math.PI * 2
          );
          ctx.stroke();
        }

        // Shield Bubble
        if (e.player.shieldCount > 0) {
          ctx.strokeStyle = '#38bdf8';
          ctx.fillStyle = 'rgba(56, 189, 248, 0.12)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(0, 0, e.player.radius + 7, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }

        ctx.shadowColor = mainColor;
        ctx.shadowBlur = 18;
        ctx.fillStyle = mainColor;

        // Cyber Fighter Delta Wing
        ctx.beginPath();
        ctx.moveTo(0, -e.player.radius - 5);
        ctx.lineTo(e.player.radius + 4, e.player.radius + 2);
        ctx.lineTo(0, e.player.radius - 4);
        ctx.lineTo(-e.player.radius - 4, e.player.radius + 2);
        ctx.closePath();
        ctx.fill();

        // Cockpit
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(0, -e.player.radius * 0.55);
        ctx.lineTo(e.player.radius * 0.38, e.player.radius * 0.35);
        ctx.lineTo(-e.player.radius * 0.38, e.player.radius * 0.35);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
      }

      // Particles
      for (let i = 0; i < e.particles.length; i++) {
        const pt = e.particles[i];
        ctx.save();
        ctx.fillStyle = pt.color;
        ctx.globalAlpha = Math.max(0, pt.alpha);
        ctx.shadowColor = pt.color;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Floating Texts
      for (let i = 0; i < e.floatingTexts.length; i++) {
        const ft = e.floatingTexts[i];
        ctx.save();
        ctx.font = `900 ${ft.size}px 'Rajdhani', system-ui, sans-serif`;
        ctx.fillStyle = ft.color;
        ctx.globalAlpha = Math.max(0, ft.alpha);
        ctx.textAlign = 'center';
        ctx.shadowColor = 'rgba(0,0,0,0.85)';
        ctx.shadowBlur = 6;
        ctx.fillText(ft.text, ft.x, ft.y);
        ctx.restore();
      }

      ctx.restore();
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, [
    getActiveShip,
    advanceQuest,
    spawnHazardWave,
    spawnGemCluster,
    spawnPowerup,
    spawnParticles,
    addFloatingText,
    addFeverEnergy,
    triggerGameOver,
    showCenterBanner,
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
      if (now - e.lastTapTime < 260) {
        // Double Tap anywhere to Dash!
        triggerDash();
      }
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
    if (!e.pointerActive || gameStateRef.current !== 'PLAYING') return;
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
        if (
          evt.code === 'Space' ||
          evt.code === 'ShiftLeft' ||
          evt.code === 'ShiftRight'
        ) {
          evt.preventDefault();
          triggerDash();
        } else if (evt.code === 'KeyE' || evt.code === 'KeyB') {
          triggerEmp();
        } else if (evt.code === 'Escape' || evt.code === 'KeyP') {
          togglePause();
        }
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
      {/* Game Canvas */}
      <canvas
        ref={canvasRef}
        className="block w-full h-full cursor-crosshair touch-none"
        onTouchStart={(e) => {
          if (e.touches.length > 0) {
            onPointerDown(e.touches[0].clientX, e.touches[0].clientY);
          }
        }}
        onTouchMove={(e) => {
          if (e.touches.length > 0) {
            onPointerMove(e.touches[0].clientX, e.touches[0].clientY);
          }
        }}
        onTouchEnd={onPointerUp}
        onMouseDown={(e) => onPointerDown(e.clientX, e.clientY)}
        onMouseMove={(e) => onPointerMove(e.clientX, e.clientY)}
        onMouseUp={onPointerUp}
      />

      {/* In-Game HUD */}
      {gameState === 'PLAYING' && (
        <HUD
          score={hudScore}
          combo={hudCombo}
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
          dashCooldown={hudDashCooldown}
          dashMaxCooldown={hudDashMaxCooldown}
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

      {/* Main Menu Modal */}
      {gameState === 'MENU' && (
        <MainMenu
          saveData={saveData}
          gameMode={gameMode}
          onSelectMode={setGameMode}
          onStartGame={startGame}
          onOpenShop={() => setIsShopOpen(true)}
          onOpenAchievements={() => setIsAchievementsOpen(true)}
          isMuted={isMuted}
          isBgmMuted={isBgmMuted}
          onToggleMute={toggleMute}
          onToggleBgm={toggleBgm}
        />
      )}

      {/* Pause Modal */}
      <PauseModal
        isOpen={gameState === 'PAUSED'}
        onResume={togglePause}
        onRestart={startGame}
        onMainMenu={returnToMainMenu}
        isMuted={isMuted}
        isBgmMuted={isBgmMuted}
        onToggleMute={toggleMute}
        onToggleBgm={toggleBgm}
      />

      {/* Game Over Modal */}
      <GameOverModal
        isOpen={gameState === 'GAMEOVER'}
        score={gameOverStats.score}
        shardsEarned={gameOverStats.shardsEarned}
        maxCombo={gameOverStats.maxCombo}
        nearMisses={gameOverStats.nearMisses}
        isNewRecord={gameOverStats.isNewRecord}
        reason={gameOverStats.reason}
        onPlayAgain={startGame}
        onOpenShop={() => {
          setGameState('MENU');
          setIsShopOpen(true);
        }}
        onMainMenu={returnToMainMenu}
      />

      {/* Shop Modal */}
      <ShopModal
        isOpen={isShopOpen}
        onClose={() => setIsShopOpen(false)}
        saveData={saveData}
        onUpdateSave={updateSave}
        onShowToast={showToast}
      />

      {/* Achievements Modal */}
      <AchievementsModal
        isOpen={isAchievementsOpen}
        onClose={() => setIsAchievementsOpen(false)}
        saveData={saveData}
        onClaimAchievement={claimAchievement}
      />

      {/* Toast Notification */}
      <div
        className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 pointer-events-none transition-all duration-300 transform ${
          toastMessage ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-3'
        }`}
      >
        <div className="px-4 py-2 rounded-full bg-slate-900/95 border border-cyan-400/60 text-cyan-200 text-xs font-bold font-cyber shadow-2xl flex items-center gap-2">
          <span>✨</span>
          <span>{toastMessage}</span>
        </div>
      </div>
    </div>
  );
};
