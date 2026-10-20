import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Sparkles } from 'lucide-react';
import { BOSSES, BossApi, ShotOpts } from '../game/bosses';
import { LEVELS, LevelDef, SpeakerId, computeStars } from '../game/campaign';
import { EngineState, createEngineState, fieldScale } from '../game/engine';
import { HudSnapshot, HudStore, createHudStore } from '../game/hudStore';
import { renderScene } from '../game/scene';
import { tr, useLang } from '../i18n';
import { localLevel, questLabel } from '../i18n/content';
import { BossEntity, BossKind, BulletEntity, GameMode, GameState, PerkId, QuestType, SaveData, ShipDef } from '../types/game';
import { sound } from '../utils/audio';
import { BOSS_RUSH_ORDER, DASH_COACH_SMASHES, MAX_WEAPON_LEVEL, PERKS, QUESTS, SHIPS } from '../utils/constants';
import { loadGameSave, saveGameData } from '../utils/storage';
import { AchievementsModal } from './AchievementsModal';
import { CampaignMap } from './CampaignMap';
import { GameOverModal, GameOverStats } from './GameOverModal';
import { CommMessage, HUD } from './HUD';
import { LevelClearModal, LevelClearStats } from './LevelClearModal';
import { MainMenu } from './MainMenu';
import { PerkModal } from './PerkModal';
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

/** Fire-interval multiplier per ship: heavier signature rounds cycle a little slower. */
const WEAPON_RATE: Record<string, number> = { striker: 1, phantom: 1, phoenix: 1.15, vortex: 1.2, sovereign: 1 };

/** Support pickup labels (read at call time so they follow the language). */
const pickupDef = (kind: 'shield' | 'magnet' | 'slow' | 'bomb' | 'power') =>
  ({
    shield: { kind: 'shield' as const, color: '#38bdf8', label: tr('ENERGY SHIELD', 'KHIÊN NĂNG LƯỢNG') },
    magnet: { kind: 'magnet' as const, color: '#a855f7', label: tr('MEGA MAGNET', 'SIÊU NAM CHÂM') },
    slow: { kind: 'slow' as const, color: '#34d399', label: tr('TIME WARP', 'BẺ CONG THỜI GIAN') },
    bomb: { kind: 'bomb' as const, color: '#fbbf24', label: tr('+1 EMP BOMB', '+1 BOM EMP') },
    power: POWER_PICKUP,
  })[kind];

/** Modes that offer mid-run Tactical Perks. */
const perkMode = (mode: GameMode) => mode === 'endless' || mode === 'hardcore' || mode === 'bossrush';

/** Endless/Timed speed stops ramping here; later waves get denser instead of faster. */
const SPEED_CAP_WAVE = 9;

/** Dash recharge time for a ship, after Dash Thruster upgrades. */
const dashCooldownFor = (ship: ShipDef, save: SaveData) =>
  Math.max(0.8, 2.2 * (1 - (save.upgrades.dashCd || 0) * 0.1) * ship.stats.dashCd);

type LiveHUDProps = Omit<React.ComponentProps<typeof HUD>, keyof HudSnapshot> & { store: HudStore };

/** Subscribes to the loop's HUD snapshots so only the HUD re-renders on every sync. */
const LiveHUD: React.FC<LiveHUDProps> = ({ store, ...rest }) => {
  const snap = useSyncExternalStore(store.subscribe, store.get);
  return <HUD {...rest} {...snap} />;
};

const findTouch = (list: React.TouchList, id: number): React.Touch | null => {
  if (id < 0) return null;
  for (let i = 0; i < list.length; i++) if (list[i].identifier === id) return list[i];
  return null;
};

/** Lifetime stats a run adds to the save, whether it ended, cleared a sector or was abandoned. */
const withRunTotals = (cur: SaveData, e: EngineState): SaveData => ({
  ...cur,
  bestCombo: Math.max(cur.bestCombo, e.maxComboThisRun),
  bestFeverInRun: Math.max(cur.bestFeverInRun, e.feverCountThisRun),
  totalNearMisses: cur.totalNearMisses + e.nearMissesThisRun,
  totalDashSmashes: cur.totalDashSmashes + e.dashSmashesThisRun,
  totalBossKills: cur.totalBossKills + e.bossKillsThisRun,
  questProgress: e.questProgress,
});

export const NeonGame: React.FC = () => {
  // Re-render every screen when the language is switched
  useLang();
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

  // In-game live metrics: the loop publishes snapshots to this store (throttled), only <LiveHUD> re-renders
  const [hudStore] = useState(() =>
    createHudStore({
      score: 0,
      combo: 1,
      comboTimer: 0,
      shards: saveData.shards,
      waveLevel: 1,
      timedRemaining: 60.0,
      feverEnergy: 0,
      isFeverActive: false,
      shieldCount: 0,
      magnetTimer: 0,
      slowFieldTimer: 0,
      empBombs: 1,
      weaponLevel: 1,
      dashCooldown: 0,
      dashMaxCooldown: 2.2,
      dashHint: false,
      bossHp: -1,
      bossName: '',
      bossStatus: '',
      stageProgress: -1,
      questProgress: saveData.questProgress,
      perks: [],
      grazeCharge: -1,
      bossRush: -1,
    })
  );
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
    bossRush: null,
  });

  // Tactical Perk picker
  const [perkOffer, setPerkOffer] = useState<PerkId[]>([]);
  const [perkSubtitle, setPerkSubtitle] = useState('');

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
      showToast(tr(`Reward claimed: +${reward} shards!`, `Đã nhận thưởng: +${reward} mảnh!`));
    },
    [updateSave, showToast]
  );

  // Quest Tracker & Progression
  const currentQuest = QUESTS[saveData.questIndex % QUESTS.length];

  /**
   * Called from the 60FPS loop, so progress lives in the engine and only touches
   * React state / localStorage when a quest completes (or the run ends).
   */
  const advanceQuest = useCallback(
    (type: QuestType, amount: number, isAbsolute = false) => {
      const e = engineRef.current;
      const cur = saveDataRef.current;
      const q = QUESTS[cur.questIndex % QUESTS.length];
      if (q.type !== type) return;

      const newProg = isAbsolute ? Math.max(e.questProgress, amount) : e.questProgress + amount;
      if (newProg === e.questProgress) return;
      if (newProg >= q.target) {
        e.questProgress = 0;
        updateSave({
          ...cur,
          shards: cur.shards + q.reward,
          questIndex: (cur.questIndex + 1) % QUESTS.length,
          questProgress: 0,
        });
        sound.playSound('powerup');
        showToast(
          tr(`Mission complete: ${q.label}! +${q.reward} shards`, `Hoàn thành nhiệm vụ: ${questLabel(q)}! +${q.reward} mảnh`)
        );
      } else {
        e.questProgress = newProg;
      }
    },
    [updateSave, showToast]
  );

  // ========================================================
  // ENGINE DATA (mutated inside the 60FPS animation loop)
  // ========================================================
  const engineRef = useRef<EngineState>(createEngineState());

  const getActiveShip = useCallback((): ShipDef => {
    const cur = saveDataRef.current;
    return SHIPS.find((s) => s.id === cur.selectedShip) || SHIPS[0];
  }, []);

  /** The current campaign sector, or null outside the campaign. */
  const getLevel = useCallback((): LevelDef | null => {
    const level = gameModeRef.current === 'campaign' ? LEVELS[levelIndexRef.current] : undefined;
    return level ? localLevel(level) : null;
  }, []);

  /** Wired up inside the render loop; lets abilities outside the loop talk to the boss. */
  const bossApiRef = useRef<BossApi | null>(null);

  /** Music intensity follows what is happening on screen. */
  const refreshMusic = useCallback(() => {
    const e = engineRef.current;
    const st = gameStateRef.current;
    if (st !== 'PLAYING' && st !== 'PERK_SELECT') {
      sound.setIntensity(0);
      sound.setBgmIntensity('normal');
      return;
    }
    sound.setIntensity(1);
    if (e.isFeverActive) sound.setBgmIntensity('fever');
    else if (e.boss || gameModeRef.current === 'bossrush') sound.setBgmIntensity('boss');
    else sound.setBgmIntensity('normal');
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
    e.player.dashMaxCooldown = dashCooldownFor(getActiveShip(), saveDataRef.current);
    e.player.dashCooldown = e.player.dashMaxCooldown;
    e.player.invulnTimer = Math.max(e.player.invulnTimer, 0.45);
    e.player.bossContactCd = 0;
    // Holo Echo: leave a decoy where the Dash started
    if (e.activePerks.includes('dash_decoy')) {
      if (e.decoys.length >= 3) e.decoys.shift();
      e.decoys.push({ x: e.player.x, y: e.player.y, life: 2.5, maxLife: 2.5 });
    }

    sound.playSound('dash');
    sound.triggerHaptic(30);
    e.screenShake = 8;

    addShockwave(e.player.x, e.player.y, '#22d3ee', 120);
    spawnParticles(e.player.x, e.player.y, '#22d3ee', 18, 260, true);
    addFloatingText(e.player.x, e.player.y - 26, tr('HYPER DASH!', 'SIÊU LƯỚT!'), '#67e8f9', 16);
    addFloatingText(e.player.x, e.player.y - 8, tr('INVINCIBLE', 'BẤT TỬ'), '#cffafe', 10);
  }, [getActiveShip, spawnParticles, addFloatingText, addShockwave]);

  /** Lifetime Dash smashes drive the in-run coaching; celebrate the very first one. */
  const noteDashSmash = useCallback(() => {
    const e = engineRef.current;
    e.dashSmashesThisRun++;
    if (saveDataRef.current.totalDashSmashes + e.dashSmashesThisRun === 1) {
      showCenterBanner(tr('DASH SMASH! NOTHING HURTS YOU MID-DASH', 'LƯỚT HÚC! ĐANG LƯỚT THÌ KHÔNG GÌ HẠI ĐƯỢC BẠN'), 'neon-glow-cyan');
    }
  }, [showCenterBanner]);

  const defeatBoss = useCallback(() => {
    const e = engineRef.current;
    const b = e.boss;
    if (!b) return;
    const campaign = gameModeRef.current === 'campaign';
    const rush = gameModeRef.current === 'bossrush';
    e.boss = null;
    e.bossKillsThisRun++;
    e.nextBossTime = e.elapsedRunTime + 60;
    if (rush) e.bossRushIndex++;
    const rushWon = rush && e.bossRushIndex >= BOSS_RUSH_ORDER.length;
    /** The fight that ends the run: the whole field goes quiet. */
    const finale = campaign || rushWon;

    sound.playSound('boss_down');
    sound.triggerHaptic([60, 40, 120]);
    e.screenShake = 26;
    flashScreen('#ffffff', 0.75);
    e.slowMoFactor = 0.35;
    e.slowMoTimer = finale ? 1.2 : 0.6;

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
      if (!finale && h.type !== 'shot' && h.type !== 'orb') return true;
      spawnParticles(h.x, h.y, h.type === 'shot' ? h.color : '#fbbf24', 3, 90);
      return false;
    });
    e.lasers = [];
    e.powerups = e.powerups.filter((pu) => pu.kind !== 'key');
    if (finale) {
      e.stagePhase = 'clear';
      e.clearTimer = CLEAR_DELAY;
      e.player.invulnTimer = Math.max(e.player.invulnTimer, CLEAR_DELAY + 1);
      e.bossRushWon = rushWon;
      e.perkPendingTimer = 0;
    } else if (rush) {
      // Intermission: bounty, a support drop, then a perk before the next boss
      e.bossRushTimer = 4;
      e.runShardsEarned += 15 + e.bossRushIndex * 8;
      const p = e.player;
      const drop = pickupDef(p.shieldCount < 2 ? 'shield' : p.weaponLevel < MAX_WEAPON_LEVEL ? 'power' : 'bomb');
      e.powerups.push({ id: e.entityIdCounter++, x: b.x, y: b.y, vy: 90, r: 17, pulse: 0, ...drop });
    }
    if (!finale && perkMode(gameModeRef.current)) {
      e.perkPendingTimer = 1.3;
      e.perkReason = rush
        ? tr(`Boss ${e.bossRushIndex}/${BOSS_RUSH_ORDER.length} down`, `Đã hạ boss ${e.bossRushIndex}/${BOSS_RUSH_ORDER.length}`)
        : tr(`${b.name} destroyed`, `Đã phá ${b.name}`);
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
      rushWon
        ? tr('BOSS RUSH COMPLETE!', 'PHÁ ĐẢO BOSS RUSH!')
        : rush
        ? tr(
            `${b.name} DOWN! ${e.bossRushIndex}/${BOSS_RUSH_ORDER.length}`,
            `ĐÃ HẠ ${b.name}! ${e.bossRushIndex}/${BOSS_RUSH_ORDER.length}`
          )
        : campaign
        ? tr(`${b.name} DEFEATED!`, `ĐÃ HẠ ${b.name}!`)
        : tr(`SENTINEL DESTROYED! +${bonus.toLocaleString('en-US')}`, `ĐÃ PHÁ LÍNH CANH! +${bonus.toLocaleString('en-US')}`),
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
    showCenterBanner(`${tr('EMP BLAST!', 'NỔ EMP!')} +${bonus.toLocaleString('en-US')}`, 'neon-glow-amber');
    // After the banner so boss-specific EMP reactions can override it
    if (e.boss && bossApiRef.current && bossReady(e.boss)) BOSSES[e.boss.kind].emp(e.boss, bossApiRef.current);
  }, [spawnParticles, showCenterBanner, addShockwave, flashScreen]);

  /** Supernova Core: Overdrive starting or ending wipes every enemy bullet. */
  const novaBlast = useCallback(() => {
    const e = engineRef.current;
    if (!e.activePerks.includes('overdrive_nova') || e.isDying) return;
    const p = e.player;
    let n = 0;
    e.hazards = e.hazards.filter((h) => {
      if (h.type !== 'shot' && !(h.type === 'orb' && !h.reflected)) return true;
      spawnParticles(h.x, h.y, '#fde047', 2, 90);
      n++;
      return false;
    });
    sound.playSound('boom');
    flashScreen('#fde047', 0.3);
    addShockwave(p.x, p.y, '#fbbf24', Math.max(e.W, e.H) * 1.1, 7);
    addShockwave(p.x, p.y, '#ffffff', Math.max(e.W, e.H) * 0.6, 3);
    e.score += n * 15 * e.combo;
    addFloatingText(p.x, p.y - 44, `${tr('SUPERNOVA!', 'SIÊU TÂN TINH!')} ×${n}`, '#fde047', 16);
  }, [spawnParticles, flashScreen, addShockwave, addFloatingText]);

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

    showCenterBanner(tr('OVERDRIVE! SMASH EVERYTHING!', 'QUÁ TẢI! HÚC NÁT TẤT CẢ!'), 'neon-glow-amber');
    advanceQuest('fever', 1, false);
    novaBlast();
    refreshMusic();
  }, [advanceQuest, showCenterBanner, addShockwave, flashScreen, refreshMusic, novaBlast]);

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
      const rush = gameModeRef.current === 'bossrush';
      // Boss Rush borrows each Warden's campaign tuning; its Sentinel is a fixed MK-2
      const rushSrc = rush ? LEVELS.find((l) => l.boss === kind) : undefined;
      const def = level ?? (rushSrc ? localLevel(rushSrc) : null);
      e.bossCount++;
      const tier = def ? def.id + 1 : rush ? 2 : e.bossCount;
      const hard = gameModeRef.current === 'hardcore';
      const maxHp = def ? def.bossHp : Math.round((60 + tier * 35) * (hard ? 1.3 : 1));
      const b: BossEntity = {
        kind,
        name: def ? def.bossName : `${tr('SENTINEL', 'LÍNH CANH')} MK-${tier}`,
        color: def ? def.accent : '#e879f9',
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
        timeLeft: def || rush ? Infinity : 38,
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
      showCenterBanner(
        rush
          ? `${tr('BOSS', 'BOSS')} ${e.bossRushIndex + 1}/${BOSS_RUSH_ORDER.length} — ${b.name}`
          : tr(`WARNING: ${b.name} INBOUND`, `CẢNH BÁO: ${b.name} ĐANG TỚI`),
        'neon-glow-pink'
      );
      if (def) def.bossIntro.forEach((line) => showComm(line.who, line.text));
      refreshMusic();
    },
    [flashScreen, getLevel, refreshMusic, showCenterBanner, showComm]
  );

  const spawnHazardWave = useCallback(() => {
    const e = engineRef.current;
    const wave = e.waveLevel;
    // Speed ramps until SPEED_CAP_WAVE; past that the spawner adds extra enemies instead (see the loop)
    const speedMult = (gameModeRef.current === 'hardcore' ? 1.34 : 1.0) + (Math.min(wave, SPEED_CAP_WAVE) - 1) * 0.1;
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
    // Spawns come fieldScale() times more often on wide screens. Seekers and turrets go for the
    // pilot wherever they appear, so keep them at phone frequency and fall back to drones/spinners
    const scale = fieldScale(e.W);
    const targeted = (roll >= 0.34 && roll < 0.58) || roll >= 0.86;
    if (targeted && Math.random() > 1 / scale) roll = Math.random() < 0.6 ? 0.1 : 0.66;

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
    } else if (roll < 0.86 && wave >= 2 && Math.random() < 0.55 / scale) {
      // Wall of mines with a gap — thread the needle for a big shard (spans the screen, so not width-scaled)
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
      { kind: 'shield' as const, color: '#38bdf8', label: tr('ENERGY SHIELD', 'KHIÊN NĂNG LƯỢNG') },
      { kind: 'magnet' as const, color: '#a855f7', label: tr('MEGA MAGNET', 'SIÊU NAM CHÂM') },
      { kind: 'slow' as const, color: '#34d399', label: tr('TIME WARP', 'BẺ CONG THỜI GIAN') },
      { kind: 'bomb' as const, color: '#fbbf24', label: tr('+1 EMP BOMB', '+1 BOM EMP') },
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
    (reason: 'crashed' | 'timeup' | 'victory') => {
      const e = engineRef.current;
      setGameState('GAMEOVER');
      gameStateRef.current = 'GAMEOVER';
      e.pointerActive = false;
      e.isDying = false;
      refreshMusic();

      if (reason === 'timeup') {
        sound.playSound('wave');
        flashScreen('#e879f9', 0.4);
      } else if (reason === 'victory') {
        sound.playSound('perk_pick');
        flashScreen('#fde047', 0.4);
      }

      clearComms();
      const cur = saveDataRef.current;
      const finalScore = Math.floor(e.score);
      const campaign = gameModeRef.current === 'campaign';
      const rush = gameModeRef.current === 'bossrush';
      const bestKey =
        gameModeRef.current === 'timed'
          ? 'bestTimed'
          : gameModeRef.current === 'hardcore'
          ? 'bestHardcore'
          : rush
          ? 'bestBossRush'
          : 'bestEndless';
      const previousBest = campaign ? 0 : cur[bestKey];
      const isNewRecord = !campaign && finalScore > previousBest;

      // Boss Rush: a full clear pays a big bounty and may set a new fastest time
      const won = rush && reason === 'victory';
      if (won) e.runShardsEarned += 250;
      const clearTime = e.elapsedRunTime;
      const prevTime = cur.bestBossRushTime;
      const newBestTime = won && (prevTime <= 0 || clearTime < prevTime);

      updateSave({
        ...withRunTotals(cur, e),
        ...(campaign ? {} : { [bestKey]: Math.max(previousBest, finalScore) }),
        ...(newBestTime ? { bestBossRushTime: clearTime } : {}),
        totalRuns: cur.totalRuns + 1,
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
        bossRush: rush
          ? {
              cleared: Math.min(BOSS_RUSH_ORDER.length, Math.max(0, e.bossRushIndex)),
              total: BOSS_RUSH_ORDER.length,
              time: clearTime,
              bestTime: newBestTime ? clearTime : prevTime,
              newBestTime,
            }
          : null,
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
      addFloatingText(e.player.x, e.player.y - 22, tr('SHIELD BROKEN!', 'VỠ KHIÊN!'), '#7dd3fc', 15);
      if (e.player.weaponLevel > 1) {
        e.player.weaponLevel--;
        addFloatingText(e.player.x, e.player.y + 26, `${tr('POWER DOWN', 'HỎA LỰC GIẢM')} · LV ${e.player.weaponLevel}`, POWER_PICKUP.color, 13);
      }
      return false;
    }
    startDeath();
    return true;
  }, [addShockwave, addFloatingText, spawnParticles, flashScreen, startDeath]);

  /** Publishes the engine's live numbers to the HUD store. */
  const syncHud = useCallback(() => {
    const e = engineRef.current;
    const p = e.player;
    const level = getLevel();
    const dashingOrFever = p.dashTimer > 0 || e.isFeverActive;
    hudStore.set({
      score: e.score,
      combo: e.combo,
      comboTimer: e.combo > 1 && !e.isFeverActive ? e.comboDecayTimer / e.comboDecayMax : 0,
      shards: saveDataRef.current.shards + e.runShardsEarned,
      waveLevel: e.waveLevel,
      timedRemaining: e.timedRemaining,
      feverEnergy: e.feverEnergy,
      isFeverActive: e.isFeverActive,
      shieldCount: p.shieldCount,
      magnetTimer: p.magnetTimer,
      slowFieldTimer: p.slowFieldTimer,
      empBombs: p.empBombs,
      weaponLevel: p.weaponLevel,
      dashCooldown: p.dashCooldown,
      dashMaxCooldown: p.dashMaxCooldown,
      dashHint: e.dashHintHold > 0 && p.dashCooldown <= 0 && !dashingOrFever,
      bossHp: e.boss ? Math.max(0, e.boss.hp / e.boss.maxHp) : -1,
      bossName: e.boss ? e.boss.name : '',
      bossStatus: e.boss && bossReady(e.boss) ? e.boss.status : '',
      stageProgress: level && e.stagePhase === 'stage' ? Math.min(1, e.stageTimer / level.stageTime) : -1,
      questProgress: e.questProgress,
      perks: e.activePerks,
      grazeCharge: e.activePerks.includes('graze_shield') ? e.grazeCounterForShield / 18 : -1,
      bossRush: e.bossRushIndex >= 0 ? Math.min(BOSS_RUSH_ORDER.length, e.bossRushIndex + 1) : -1,
    });
  }, [getLevel, hudStore]);

  /** Rolls three perks the pilot doesn't own yet and opens the picker. Returns false if none are left. */
  const openPerkSelect = useCallback((): boolean => {
    const e = engineRef.current;
    const pool = PERKS.map((pk) => pk.id).filter((id) => !e.activePerks.includes(id));
    if (pool.length === 0) return false;
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    e.perkOffer = pool.slice(0, 3);
    e.pointerActive = false;
    e.touchId = -1;
    e.keys = {};
    setPerkOffer(e.perkOffer);
    setPerkSubtitle(e.perkReason);
    setGameState('PERK_SELECT');
    gameStateRef.current = 'PERK_SELECT';
    sound.playSound('wave');
    refreshMusic();
    return true;
  }, [refreshMusic]);

  const pickPerk = useCallback(
    (id: PerkId) => {
      if (gameStateRef.current !== 'PERK_SELECT') return;
      const e = engineRef.current;
      const p = e.player;
      if (!e.activePerks.includes(id)) e.activePerks.push(id);
      e.perkOffer = [];
      // A moment of safety to get your bearings after the freeze
      p.invulnTimer = Math.max(p.invulnTimer, 1.2);
      const def = PERKS.find((pk) => pk.id === id);
      sound.playSound('perk_pick');
      sound.triggerHaptic([20, 20, 40]);
      addShockwave(p.x, p.y, def?.color || '#67e8f9', 160, 4);
      spawnParticles(p.x, p.y, def?.color || '#67e8f9', 20, 240, true);
      setGameState('PLAYING');
      gameStateRef.current = 'PLAYING';
      refreshMusic();
      syncHud();
    },
    [addShockwave, spawnParticles, refreshMusic, syncHud]
  );

  /** Starts a run. In the campaign, `fromBoss` skips straight to the sector's Warden. */
  const startGame = useCallback((fromBoss = false) => {
    sound.ensureContext();
    sound.startBgm();
    clearComms();

    const e = engineRef.current;
    const ship = getActiveShip();
    const timed = gameModeRef.current === 'timed';
    const rush = gameModeRef.current === 'bossrush';
    const level = getLevel();

    e.score = 0;
    e.combo = 1;
    e.maxComboThisRun = 1;
    e.comboDecayTimer = 0;
    e.nearMissesThisRun = 0;
    e.dashSmashesThisRun = 0;
    e.dashHintId = -1;
    e.dashHintHold = 0;
    e.runShardsEarned = 0;
    e.questProgress = saveDataRef.current.questProgress;
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
    e.bossRushIndex = rush ? 0 : -1;
    e.bossRushTimer = rush ? 2.4 : 0;
    e.bossRushWon = false;

    e.activePerks = [];
    e.perkPendingTimer = 0;
    e.perkOffer = [];
    e.perkReason = '';
    e.perkWaveMilestone = 0;
    e.grazeCounterForShield = 0;
    e.missileTimer = 0;
    e.decoys = [];

    e.stagePhase = 'stage';
    e.stageTimer = level && fromBoss ? level.stageTime - 1.5 : 0;
    e.bossTime = 0;
    e.hitsTaken = 0;
    e.clearTimer = 0;
    e.skippedStage = !!level && fromBoss;
    if (level) e.waveLevel = level.wave;
    if (rush) e.waveLevel = 2;

    e.player.x = e.W / 2;
    e.player.y = e.H * 0.76;
    e.player.targetX = e.player.x;
    e.player.targetY = e.player.y;
    e.player.trail = [];
    // Campaign pilots get one extra layer of hull plating
    e.player.shieldCount =
      (ship.stats.bonusShield && gameModeRef.current !== 'hardcore' ? 1 : 0) + (level || rush ? 1 : 0);
    e.player.empBombs = ship.id === 'sovereign' ? 2 : 1;
    // Weapon Primer upgrades, plus a head start in the late campaign sectors
    e.player.weaponLevel = Math.min(
      MAX_WEAPON_LEVEL,
      Math.max(rush ? 3 : 1, 1 + (saveDataRef.current.upgrades.primer || 0) + (level ? Math.floor(level.id / 3) : 0))
    );
    e.player.magnetTimer = 0;
    e.player.slowFieldTimer = 0;
    e.player.dashTimer = 0;
    e.player.dashCooldown = 0;
    e.player.dashMaxCooldown = dashCooldownFor(ship, saveDataRef.current);
    e.player.invulnTimer = 1.0;
    e.player.bossContactCd = 0;
    e.player.volley = 0;
    e.player.muzzleFlash = 0;
    e.player.autoFireTimer = 0;
    for (const [k, d] of e.player.drones.entries()) {
      d.x = e.player.x + (k ? 34 : -34);
      d.y = e.player.y + 10;
    }

    e.hazards = [];
    e.lasers = [];
    e.gems = [];
    e.powerups = [];
    e.bullets = [];
    e.particles = [];
    e.shockwaves = [];
    e.floatingTexts = [];
    e.grazeArcs = [];

    e.hazardTimer = 0.4;
    e.gemTimer = 0.2;
    e.powerupTimer = 5.5;
    e.laserTimer = 6;

    setGameState('PLAYING');
    gameStateRef.current = 'PLAYING';
    refreshMusic();
    // Don't flash the previous run's numbers before the loop's first sync
    syncHud();

    addShockwave(e.player.x, e.player.y, ship.color, 160, 4);
    showCenterBanner(
      level
        ? `${level.code} — ${level.name.toUpperCase()}`
        : timed
        ? tr('60 SECOND BLITZ — GO GO GO!', 'TỐC CHIẾN 60 GIÂY — LÊN NÀO!')
        : rush
        ? tr('BOSS RUSH — 7 BOSSES, ONE LIFE', 'BOSS RUSH — 7 BOSS, MỘT MẠNG')
        : gameModeRef.current === 'hardcore'
        ? tr('HARDCORE — x2 SHARDS!', 'CỰC HẠN — x2 MẢNH!')
        : tr('DRAG TO FLY • DOUBLE-TAP TO DASH', 'KÉO ĐỂ BAY • CHẠM ĐÚP ĐỂ LƯỚT'),
      'neon-glow-cyan'
    );
  }, [getActiveShip, getLevel, showCenterBanner, refreshMusic, addShockwave, clearComms, syncHud]);

  const togglePause = useCallback(() => {
    if (gameStateRef.current === 'PLAYING') {
      if (engineRef.current.isDying) return;
      setGameState('PAUSED');
      gameStateRef.current = 'PAUSED';
      engineRef.current.pointerActive = false;
      engineRef.current.touchId = -1;
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

  /** Quitting or restarting from the pause menu still banks the shards and stats earned so far. */
  const bankAbandonedRun = useCallback(() => {
    const st = gameStateRef.current;
    if (st !== 'PLAYING' && st !== 'PAUSED') return;
    const e = engineRef.current;
    const cur = saveDataRef.current;
    const banked = e.runShardsEarned;
    updateSave({ ...withRunTotals(cur, e), shards: cur.shards + banked });
    // Zero the run so nothing gets counted twice
    e.runShardsEarned = 0;
    e.nearMissesThisRun = 0;
    e.dashSmashesThisRun = 0;
    e.bossKillsThisRun = 0;
    if (banked > 0) showToast(tr(`+${banked} shards banked from that run`, `Đã cất +${banked} mảnh từ lượt vừa rồi`));
  }, [updateSave, showToast]);

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
    const stars = computeStars(e.hitsTaken, e.bossTime, level.parTime, e.skippedStage);
    const prevStars = cur.campaignStars[level.id] || 0;
    const firstClear = prevStars === 0;
    const reward = firstClear ? level.reward : Math.round(level.reward * 0.25);
    const campaignStars = [...cur.campaignStars];
    campaignStars[level.id] = Math.max(prevStars, stars);

    updateSave({
      ...withRunTotals(cur, e),
      shards: cur.shards + e.runShardsEarned + reward,
      campaignStars,
      campaignUnlocked: Math.max(cur.campaignUnlocked, Math.min(LEVELS.length - 1, level.id + 1)),
      totalRuns: cur.totalRuns + 1,
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
      skippedStage: e.skippedStage,
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

  // Auto-pause when the tab or window goes to the background. Alt-Tab only fires `blur`, and the
  // keyup for any held key never arrives, so drop all input too or the ship drifts on return.
  useEffect(() => {
    const releaseInput = () => {
      const e = engineRef.current;
      e.keys = {};
      e.pointerActive = false;
      e.touchId = -1;
      if (gameStateRef.current === 'PLAYING') togglePause();
    };
    const onVis = () => {
      if (document.hidden) releaseInput();
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('blur', releaseInput);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('blur', releaseInput);
    };
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

    const hasPerk = (id: PerkId) => engineRef.current.activePerks.includes(id);

    /** Electric arc FX (graze sparks, Static Aftershock). */
    const pushArc = (x1: number, y1: number, x2: number, y2: number, color: string) => {
      const e = engineRef.current;
      if (e.grazeArcs.length > 30) e.grazeArcs.shift();
      e.grazeArcs.push({ x1, y1, x2, y2, color, alpha: 1 });
    };

    /** Every graze feeds Kinetic Capacitor; 18 of them forge a shield layer. */
    const chargeGrazeShield = () => {
      const e = engineRef.current;
      if (!hasPerk('graze_shield')) return;
      e.grazeCounterForShield++;
      if (e.grazeCounterForShield < 18) return;
      e.grazeCounterForShield = 0;
      const p = e.player;
      if (p.shieldCount >= 3) {
        e.score += 250 * e.combo;
        addFloatingText(p.x, p.y - 34, tr('CAPACITOR FULL +SCORE', 'TỤ ĐẦY +ĐIỂM'), '#7dd3fc', 13);
        return;
      }
      p.shieldCount++;
      sound.playSound('powerup');
      addShockwave(p.x, p.y, '#38bdf8', 110, 3);
      spawnParticles(p.x, p.y, '#7dd3fc', 14, 200, true);
      addFloatingText(p.x, p.y - 34, tr('KINETIC SHIELD +1', 'KHIÊN ĐỘNG NĂNG +1'), '#7dd3fc', 15);
    };

    const nearestDecoy = (x: number, y: number, range: number) => {
      let best: { x: number; y: number } | null = null;
      let bestD = range;
      for (const d of engineRef.current.decoys) {
        const dist = Math.hypot(d.x - x, d.y - y);
        if (dist < bestD) {
          bestD = dist;
          best = d;
        }
      }
      return best;
    };

    /** Static Aftershock: when a Dash ends, lightning jumps to the 3 closest enemies (or zaps the boss). */
    const staticAftershock = () => {
      const e = engineRef.current;
      const p = e.player;
      const near = e.hazards
        .filter((h) => h.type !== 'shot' && h.type !== 'orb' && h.y > 0 && Math.hypot(h.x - p.x, h.y - p.y) < 280)
        .sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))
        .slice(0, 3);
      for (const h of near) {
        pushArc(p.x, p.y, h.x, h.y, '#67e8f9');
        const j = e.hazards.indexOf(h);
        if (j >= 0) damageHazard(j, 4);
      }
      const boss = e.boss;
      let zappedBoss = false;
      if (near.length < 3 && boss && bossReady(boss) && Math.hypot(boss.x - p.x, boss.y - p.y) < 320) {
        pushArc(p.x, p.y, boss.x, boss.y, '#67e8f9');
        const zap: BulletEntity = { id: -1, x: boss.x, y: boss.y, vx: 0, vy: -1, color: '#67e8f9', damage: 3, kind: 'plasma' };
        zappedBoss = BOSSES[boss.kind].bullet(boss, api, zap) === 'hit';
      }
      if (near.length > 0 || zappedBoss) {
        sound.playSound('parry');
        e.screenShake = Math.max(e.screenShake, 6);
        spawnParticles(p.x, p.y, '#67e8f9', 10, 220, true);
      }
    };

    /** Destroys hazard `j` with the usual score / loot. */
    const killHazard = (j: number) => {
      const e = engineRef.current;
      const h = e.hazards[j];
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
    };

    /** Deals weapon damage to hazard `j`. Only turrets have HP; everything else pops. Returns true on a kill. */
    const damageHazard = (j: number, dmg: number): boolean => {
      const e = engineRef.current;
      const h = e.hazards[j];
      if (h.type === 'turret' && (h.hp || 0) > dmg) {
        h.hp = (h.hp || 1) - dmg;
        h.hitFlash = 0.06;
        spawnParticles(h.x, h.y, h.color, 4, 120);
        if (e.hitSoundCd <= 0) {
          sound.playSound('hit');
          e.hitSoundCd = 0.08;
        }
        return false;
      }
      killHazard(j);
      return true;
    };

    /** Area blast from Solar Fireballs, missiles and Holo Echo: hurts every enemy (not bullets) in range. */
    const explode = (x: number, y: number, radius: number, dmg: number, color: string, skipId = -1) => {
      const e = engineRef.current;
      addShockwave(x, y, color, radius, 3);
      spawnParticles(x, y, color, 8, 180);
      spawnParticles(x, y, '#fde68a', 4, 120);
      for (let j = e.hazards.length - 1; j >= 0; j--) {
        const h = e.hazards[j];
        if (h.id === skipId || h.type === 'shot' || h.type === 'orb') continue;
        if (Math.hypot(h.x - x, h.y - y) < radius + h.r) damageHazard(j, dmg);
      }
    };

    /** Closest thing worth shooting: enemies, the boss, or its live parts. */
    const findTarget = (x: number, y: number, range: number): { x: number; y: number } | null => {
      const e = engineRef.current;
      let best: { x: number; y: number } | null = null;
      let bestD = range;
      for (const h of e.hazards) {
        if (h.type === 'shot' || h.type === 'orb' || h.y < -10) continue;
        const d = Math.hypot(h.x - x, h.y - y);
        if (d < bestD) {
          bestD = d;
          best = h;
        }
      }
      const boss = e.boss;
      if (boss && bossReady(boss)) {
        // Slight preference for the boss so homing rounds don't all chase stray drones
        const d = Math.hypot(boss.x - x, boss.y - y) * 0.8;
        if (d < bestD) {
          bestD = d;
          best = boss;
        }
        for (const pt of boss.parts) {
          if (!pt.alive) continue;
          const dp = Math.hypot(pt.x - x, pt.y - y) * 0.85;
          if (dp < bestD) {
            bestD = dp;
            best = pt;
          }
        }
      }
      return best;
    };

    /** Homing rounds bend towards their target at a capped turn rate and accelerate. */
    const steerBullet = (b: BulletEntity, dt: number) => {
      const target = findTarget(b.x, b.y, 620);
      let a = Math.atan2(b.vy, b.vx);
      if (target) {
        let diff = Math.atan2(target.y - b.y, target.x - b.x) - a;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        const turn = (b.turnRate || 6) * dt;
        a += Math.max(-turn, Math.min(turn, diff));
      }
      const top = b.kind === 'missile' ? 640 : 780;
      const spd = Math.min(top, Math.hypot(b.vx, b.vy) + 900 * dt);
      b.vx = Math.cos(a) * spd;
      b.vy = Math.sin(a) * spd;
    };

    /** One auto-blaster volley with the ship's signature weapon. */
    const fireShipWeapons = (ship: ShipDef, lvl: number, fever: boolean, dmgMult: number) => {
      const e = engineRef.current;
      const p = e.player;
      const color = fever ? '#fbbf24' : ship.color;
      // Angled side shots hit softer, except during Overdrive
      const side = fever ? 1 : 0.5;
      p.volley++;
      p.muzzleFlash = 1;
      const fire = (dx: number, vx: number, dmg = 1, extra?: Partial<BulletEntity>, vy = -720) =>
        e.bullets.push({
          id: e.entityIdCounter++,
          x: p.x + dx,
          y: p.y - 18,
          vx,
          vy,
          color,
          fever,
          damage: dmg * dmgMult,
          kind: 'plasma',
          ...extra,
        });
      const main = (dx: number) => {
        if (ship.id === 'phoenix') fire(dx, 0, 1.2, { kind: 'fireball', splashRadius: 52 }, -560);
        else if (ship.id === 'vortex') fire(dx, 0, 1.1, { kind: 'rail', pierce: 2 }, -1150);
        else fire(dx, 0);
      };
      if (lvl === 1) {
        main(0);
      } else if (lvl <= 3) {
        main(-7);
        main(7);
      } else {
        main(-10);
        main(0);
        main(10);
      }
      if (lvl >= 3) {
        fire(-8, -110, side);
        fire(8, 110, side);
      }
      if (lvl >= 5) {
        fire(-10, -220, side);
        fire(10, 220, side);
      }

      // Signature extras
      if (ship.id === 'striker' && p.volley % 4 === 0) {
        // Rapid Plasma: every 4th volley adds a heavy piercing bolt
        fire(0, 0, 1.4, { pierce: 1 }, -880);
      } else if (ship.id === 'phantom' && p.volley % 2 === 0) {
        // Homing Needles: darts fan out sideways, then hunt
        const n = lvl >= 4 ? 2 : 1;
        for (let k = 0; k < n; k++) {
          const s = n === 2 ? (k ? 1 : -1) : p.volley % 4 === 0 ? 1 : -1;
          e.bullets.push({
            id: e.entityIdCounter++,
            x: p.x + s * 12,
            y: p.y - 6,
            vx: s * 260,
            vy: -380,
            color: fever ? '#fde047' : '#c084fc',
            fever,
            damage: 0.65 * dmgMult,
            kind: 'homing',
            turnRate: 6.5,
            life: 2.2,
          });
        }
      } else if (ship.id === 'sovereign' && p.volley % 2 === 0) {
        // Twin Wingman Drones add covering fire
        for (const d of p.drones) {
          e.bullets.push({
            id: e.entityIdCounter++,
            x: d.x,
            y: d.y - 8,
            vx: 0,
            vy: -680,
            color: fever ? '#fde047' : '#fde68a',
            fever,
            damage: 0.5 * dmgMult,
            kind: 'drone',
          });
        }
      }
      if (ship.id === 'vortex' && p.volley % 3 === 1) sound.playSound('railgun');
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
          if (e.bossRushWon) finishGameOver('victory');
          else completeLevel();
          return;
        }
      }

      // Tactical Perk picker opens after a short beat (lets a boss explosion land first)
      if (e.perkPendingTimer > 0) {
        if (!alive) {
          e.perkPendingTimer = 0;
        } else {
          e.perkPendingTimer -= rawDt;
          if (e.perkPendingTimer <= 0) {
            e.perkPendingTimer = 0;
            if (openPerkSelect()) return;
          }
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

      const rush = gameModeRef.current === 'bossrush';
      if (alive) {
        e.elapsedRunTime += rawDt;
        const newWave = level
          ? level.wave + (e.stageTimer > level.stageTime * 0.5 ? 1 : 0)
          : rush
          ? 2 + Math.max(0, e.bossRushIndex)
          : 1 + Math.floor(e.elapsedRunTime / (gameModeRef.current === 'timed' ? 15 : 18));
        if (newWave > e.waveLevel) {
          e.waveLevel = newWave;
          e.score += e.waveLevel * 150;
          if (!e.boss && !rush) showCenterBanner(tr(`SPEED LEVEL ${e.waveLevel}!`, `TỐC ĐỘ CẤP ${e.waveLevel}!`), 'neon-glow-pink');
          sound.playSound('wave');
          // Endless / Hardcore: Wave 2, 4 and 6 each grant a Tactical Perk
          const mode = gameModeRef.current;
          if (
            (mode === 'endless' || mode === 'hardcore') &&
            newWave % 2 === 0 &&
            newWave <= 6 &&
            newWave > e.perkWaveMilestone
          ) {
            e.perkWaveMilestone = newWave;
            e.perkPendingTimer = Math.max(e.perkPendingTimer, 0.5);
            e.perkReason = tr(`Wave ${newWave} reached`, `Đã tới đợt ${newWave}`);
          }
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
          novaBlast();
          refreshMusic();
        }
      }

      // Timers
      const wasDashing = p.dashTimer > 0;
      if (p.dashTimer > 0) p.dashTimer -= rawDt;
      if (wasDashing && p.dashTimer <= 0 && alive && hasPerk('chain_dash')) staticAftershock();
      if (p.dashCooldown > 0) p.dashCooldown = Math.max(0, p.dashCooldown - rawDt);
      if (p.invulnTimer > 0) p.invulnTimer -= rawDt;
      if (p.magnetTimer > 0) p.magnetTimer -= rawDt;
      if (p.slowFieldTimer > 0) p.slowFieldTimer -= rawDt;
      if (p.bossContactCd > 0) p.bossContactCd -= rawDt;
      if (p.muzzleFlash > 0) p.muzzleFlash = Math.max(0, p.muzzleFlash - rawDt * 12);
      if (e.grazeSoundCd > 0) e.grazeSoundCd -= rawDt;
      if (e.hitSoundCd > 0) e.hitSoundCd -= rawDt;

      const isDashingOrFever = p.dashTimer > 0 || e.isFeverActive;

      // Dash coach: until the pilot has landed a few smashes, point at the closest enemy worth dashing into
      e.dashHintId = -1;
      if (
        alive &&
        p.dashCooldown <= 0 &&
        !isDashingOrFever &&
        saveDataRef.current.totalDashSmashes + e.dashSmashesThisRun < DASH_COACH_SMASHES
      ) {
        let best = 190;
        for (const h of e.hazards) {
          if (h.type === 'shot' || h.reflected) continue;
          const d = Math.hypot(p.x - h.x, p.y - h.y);
          if (d < best) {
            best = d;
            e.dashHintId = h.id;
          }
        }
      }
      if (e.dashHintId >= 0) e.dashHintHold = 0.8;
      else if (e.dashHintHold > 0) e.dashHintHold -= rawDt;

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

        // Sovereign's wingman drones glide after their slots beside the wings
        if (ship.id === 'sovereign') {
          const follow = Math.min(1, 14 * rawDt);
          p.drones.forEach((d, k) => {
            const s = k ? 1 : -1;
            d.x += (p.x + s * 34 - d.x) * follow;
            d.y += (p.y + 10 + Math.sin(e.t * 4 + k * Math.PI) * 6 - d.y) * follow;
          });
        }

        // Auto-blaster: always on at a slow idle cadence; full rate from combo x5 (lowered by
        // Targeting AI), during Overdrive, or in a boss fight
        const up = saveDataRef.current.upgrades;
        const berserk = hasPerk('berserk_barrel') && p.shieldCount === 0;
        p.autoFireTimer -= rawDt;
        if (p.autoFireTimer <= 0) {
          const fullRate = e.combo >= Math.max(1, 5 - (up.targeting || 0));
          const interval = e.isFeverActive ? 0.11 : e.boss ? (e.combo >= 10 ? 0.12 : 0.15) : fullRate ? 0.24 : 0.42;
          p.autoFireTimer =
            (interval * (WEAPON_RATE[ship.id] || 1)) / ((1 + (up.fireRate || 0) * 0.08) * (berserk ? 1.35 : 1));
          const fever = e.isFeverActive;
          const dmgMult = (1 + (up.blaster || 0) * 0.12) * (berserk ? 1.25 : 1);
          // A x12 combo still guarantees the twin blaster; Overdrive fires at least the Lv3 spread
          let lvl = Math.max(p.weaponLevel, e.combo >= 12 ? 2 : 1);
          if (fever) lvl = Math.min(MAX_WEAPON_LEVEL, Math.max(3, lvl + 1));
          fireShipWeapons(ship, lvl, fever, dmgMult);
        }

        // Swarm Protocol: a hot combo keeps a missile pair in the air
        if (hasPerk('combo_missiles') && e.combo >= 10) {
          e.missileTimer -= rawDt;
          if (e.missileTimer <= 0) {
            e.missileTimer = 1.8;
            const dmg = 2 * (1 + (up.blaster || 0) * 0.12);
            for (const s of [-1, 1]) {
              e.bullets.push({
                id: e.entityIdCounter++,
                x: p.x + s * 14,
                y: p.y,
                vx: s * 280,
                vy: -160,
                color: '#fb923c',
                fever: e.isFeverActive,
                damage: dmg,
                kind: 'missile',
                turnRate: 5,
                life: 3,
                splashRadius: 40,
              });
            }
            sound.playSound('homing_launch');
          }
        } else if (e.missileTimer > 0.6) {
          e.missileTimer = 0.6;
        }
      } else {
        p.trail.pop();
      }

      // Player bullets
      const ricochet = hasPerk('ricochet');
      for (let i = e.bullets.length - 1; i >= 0; i--) {
        const b = e.bullets[i];
        if (b.kind === 'homing' || b.kind === 'missile') {
          b.life = (b.life ?? 2) - rawDt;
          if (b.life <= 0) {
            spawnParticles(b.x, b.y, b.color, 3, 80);
            e.bullets.splice(i, 1);
            continue;
          }
          steerBullet(b, rawDt);
        }
        b.x += b.vx * rawDt;
        b.y += b.vy * rawDt;
        // Prism Bounce: one ricochet off the side walls
        if (ricochet && !b.bounced && ((b.x < 6 && b.vx < 0) || (b.x > e.W - 6 && b.vx > 0))) {
          b.vx = -b.vx;
          b.bounced = true;
          b.x = Math.max(6, Math.min(e.W - 6, b.x));
          spawnParticles(b.x, b.y, '#a78bfa', 3, 90, true);
        }
        if (b.y < -30 || b.y > e.H + 30 || b.x < -20 || b.x > e.W + 20) {
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
              if (b.splashRadius) explode(b.x, b.y, b.splashRadius, (b.damage ?? 1) * 0.6, b.color);
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
        let consumed = false;
        const reach = b.kind === 'fireball' ? 11 : b.kind === 'missile' ? 10 : 8;
        for (let j = e.hazards.length - 1; j >= 0; j--) {
          const h = e.hazards[j];
          if (h.type === 'shot' || h.type === 'orb') continue;
          if (b.hitIds && b.hitIds.includes(h.id)) continue;
          if (Math.hypot(b.x - h.x, b.y - h.y) < h.r + reach) {
            const dmg = b.damage ?? 1;
            const { x: hx, y: hy, id: hid } = h;
            damageHazard(j, dmg);
            if (b.splashRadius) explode(hx, hy, b.splashRadius, dmg * 0.6, b.color, hid);
            if ((b.pierce || 0) > 0) {
              b.pierce = (b.pierce || 1) - 1;
              (b.hitIds ??= []).push(hid);
              spawnParticles(hx, hy, '#ffffff', 3, 160, true);
            } else {
              consumed = true;
            }
            break;
          }
        }
        if (consumed) e.bullets.splice(i, 1);
      }

      // Spawners
      if (alive && e.stagePhase !== 'clear') {
        const bossActive = !!e.boss;
        // Campaign Wardens and Boss Rush bosses get the stage to themselves (mostly)
        const bossSpawnMult = level || rush ? 3.5 : 2.4;
        // Wide screens spawn proportionally more often so density matches a phone
        const scale = fieldScale(e.W);
        // Boss Rush intermissions are a breather: no fresh enemies between bosses
        if (!rush || bossActive) e.hazardTimer -= worldDt;
        if (e.hazardTimer <= 0) {
          spawnHazardWave();
          // Past the speed cap, Endless keeps escalating with extra enemies rather than faster ones
          const overflow = Math.max(0, e.waveLevel - SPEED_CAP_WAVE);
          if (overflow > 0 && Math.random() < Math.min(0.45, overflow * 0.05)) spawnHazardWave();
          const baseInterval = Math.max(0.25, 0.76 - e.waveLevel * 0.045);
          e.hazardTimer = (baseInterval * (hard ? 0.78 : 1) * (bossActive ? bossSpawnMult : 1)) / scale;
        }

        e.gemTimer -= worldDt;
        if (e.gemTimer <= 0) {
          spawnGemCluster();
          e.gemTimer = 1.6 / scale;
        }

        e.powerupTimer -= rawDt;
        if (e.powerupTimer <= 0) {
          spawnPowerup();
          e.powerupTimer = 8.5 + Math.random() * 3.5;
        }

        const laserMode = level ? level.lasers : rush ? 'none' : e.waveLevel >= 2 ? 'v' : 'none';
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
        } else if (rush) {
          // Boss Rush: next boss after the intermission (the perk picker pauses this countdown)
          if (!bossActive && !e.bossRushWon && e.bossRushIndex < BOSS_RUSH_ORDER.length && e.perkPendingTimer <= 0) {
            e.bossRushTimer -= rawDt;
            if (e.bossRushTimer <= 0) {
              e.hazards = e.hazards.filter((h) => h.type !== 'shot');
              spawnBoss(BOSS_RUSH_ORDER[e.bossRushIndex]);
            }
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
          const frenzy = hasPerk('shard_frenzy');
          if (frenzy) p.dashCooldown = Math.max(0, p.dashCooldown - 0.15);
          const pts = Math.round(25 * e.combo * g.val * (frenzy ? 1.25 : 1));
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
          const label =
            pu.kind !== 'power'
              ? pu.label
              : maxed
              ? tr('MAX POWER!', 'HỎA LỰC TỐI ĐA!')
              : `${tr('POWER UP', 'HỎA LỰC TĂNG')} · LV ${p.weaponLevel + 1}`;
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
          if (l.orient === 'h') pushArc(p.x, p.y, p.x, l.x + Math.sign(p.y - l.x) * (l.width / 2), '#fb7185');
          else pushArc(p.x, p.y, l.x + Math.sign(p.x - l.x) * (l.width / 2), p.y, '#fb7185');
          chargeGrazeShield();
          bumpCombo(2, 3.5);
          const pts = 100 * e.combo;
          e.score += pts;
          addFeverEnergy(16);
          notifyGraze(2);
          sound.playSound('nearmiss');
          addFloatingText(p.x, p.y - 24, `${tr('LASER GRAZE!', 'SƯỢT LASER!')} +${pts}`, '#fb7185', 15);
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
            if (boss.timeLeft <= 0) showCenterBanner(tr('THE SENTINEL RETREATED', 'LÍNH CANH ĐÃ RÚT LUI'), 'neon-glow-pink');
          }
          behavior.update(boss, api, worldDt, true);
        }

        if (alive && e.boss === boss && bossReady(boss)) behavior.contact(boss, api, isDashingOrFever);
      }

      // Holo Echo decoys: bend nearby enemy shots into themselves, then detonate
      for (let k = e.decoys.length - 1; k >= 0; k--) {
        const d = e.decoys[k];
        d.life -= rawDt;
        for (let j = e.hazards.length - 1; j >= 0; j--) {
          const h = e.hazards[j];
          if (h.type !== 'shot') continue;
          const dist = Math.hypot(d.x - h.x, d.y - h.y);
          if (dist < 18) {
            spawnParticles(h.x, h.y, '#f0abfc', 3, 90);
            e.score += 5 * e.combo;
            e.hazards.splice(j, 1);
          } else if (dist < 240) {
            let a = Math.atan2(h.vy, h.vx);
            let diff = Math.atan2(d.y - h.y, d.x - h.x) - a;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            a += Math.max(-3.2 * worldDt, Math.min(3.2 * worldDt, diff));
            const sp = Math.hypot(h.vx, h.vy);
            h.vx = Math.cos(a) * sp;
            h.vy = Math.sin(a) * sp;
            h.angle = a;
            h.ay = undefined;
          }
        }
        if (d.life <= 0) {
          e.decoys.splice(k, 1);
          sound.playSound('boom');
          e.screenShake = Math.max(e.screenShake, 8);
          e.hazards = e.hazards.filter((h) => {
            if (h.type !== 'shot' || Math.hypot(h.x - d.x, h.y - d.y) > 130) return true;
            spawnParticles(h.x, h.y, '#f0abfc', 2, 80);
            return false;
          });
          explode(d.x, d.y, 130, 4, '#e879f9');
          addFloatingText(d.x, d.y - 20, tr('ECHO BURST!', 'BÓNG ẢNH NỔ!'), '#f0abfc', 14);
        }
      }

      // Hazards
      for (let i = e.hazards.length - 1; i >= 0; i--) {
        const h = e.hazards[i];
        if (h.hitFlash && h.hitFlash > 0) h.hitFlash -= rawDt;

        if (h.type === 'seeker') {
          h.life = (h.life || 5.5) - worldDt;
          const lure = nearestDecoy(h.x, h.y, Infinity) ?? p;
          const desired = Math.atan2(lure.y - h.y, lure.x - h.x);
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
          addFloatingText(p.x, p.y - 26, `${tr('PARRY!', 'PHẢN ĐÒN!')} +${pts}`, '#67e8f9', 17);
          advanceQuest('dashkill', 1, false);
          noteDashSmash();
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
                addFloatingText(h.x, h.y, `${tr('SMASH!', 'HÚC NÁT!')} +${smashPts}`, '#67e8f9', 15);
                if (h.type === 'turret') dropPower(h.x, h.y);
                advanceQuest('dashkill', 1, false);
                advanceQuest('combo', e.combo, true);
                noteDashSmash();
              }
              e.hazards.splice(i, 1);
              continue;
            }
            // While invulnerable (spawn, post-shield, victory lap) enemies just pass through
            if (p.invulnTimer <= 0) {
              e.hazards.splice(i, 1);
              if (hitPlayer()) break;
              continue;
            }
            h.grazed = true; // no near-miss credit for something that went straight through you
          } else if (!h.grazed && dist < hitRadius + (isShot ? grazeBonus * 0.7 : grazeBonus)) {
            h.grazed = true;
            pushArc(p.x, p.y, h.x, h.y, isShot ? '#f9a8d4' : '#e879f9');
            chargeGrazeShield();
            if (isShot) {
              bumpCombo(1, 3.2);
              const pts = 40 * e.combo;
              e.score += pts;
              addFeverEnergy(7);
              notifyGraze(1);
              if (e.grazeSoundCd <= 0) {
                sound.playSound('nearmiss');
                e.grazeSoundCd = 0.12;
                addFloatingText(p.x, p.y - 22, `${tr('GRAZE', 'SƯỢT')} +${pts}`, '#f9a8d4', 12);
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
              addFloatingText(p.x, p.y - 22, `${tr('NEAR MISS!', 'NÉ SÁT!')} +${grazePts}`, '#f0abfc', 15);
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
        syncHud();
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

      for (let i = e.grazeArcs.length - 1; i >= 0; i--) {
        e.grazeArcs[i].alpha -= dt * 5;
        if (e.grazeArcs[i].alpha <= 0) e.grazeArcs.splice(i, 1);
      }

      if (e.screenShake > 0) e.screenShake = Math.max(0, e.screenShake - 38 * dt);
      if (e.flashAlpha > 0) e.flashAlpha = Math.max(0, e.flashAlpha - 2.4 * dt);
    };

    // ---------- Rendering ----------
    const render = () => {
      const st = gameStateRef.current;
      renderScene(ctx, engineRef.current, st, st === 'MENU' ? null : getLevel(), getActiveShip());
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
    noteDashSmash,
    syncHud,
    novaBlast,
    openPerkSelect,
  ]);

  // ========================================================
  // TOUCH & POINTER GESTURES
  // ========================================================
  /** `touchId` is the finger's identifier, or -1 for the mouse. */
  const onPointerDown = useCallback(
    (clientX: number, clientY: number, touchId = -1) => {
      sound.ensureContext();
      if (gameStateRef.current !== 'PLAYING') return;

      const e = engineRef.current;
      // Only the first finger steers: extra fingers neither re-anchor the drag nor count as Dash taps
      if (touchId >= 0 && e.touchId >= 0) return;
      e.touchId = touchId;
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
    engineRef.current.touchId = -1;
  }, []);

  const lastTouchRef = useRef(0);

  /** Ends the drag only if the steering finger is among the touches that lifted. */
  const onTouchRelease = useCallback(
    (evt: React.TouchEvent) => {
      lastTouchRef.current = performance.now();
      if (findTouch(evt.changedTouches, engineRef.current.touchId)) onPointerUp();
    },
    [onPointerUp]
  );

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
        onTouchStart={(evt) => {
          lastTouchRef.current = performance.now();
          // A lone finger always takes over, so a lost touchend can never lock steering
          if (evt.touches.length === 1) engineRef.current.touchId = -1;
          const t = evt.changedTouches[0];
          if (t) onPointerDown(t.clientX, t.clientY, t.identifier);
        }}
        onTouchMove={(evt) => {
          const t = findTouch(evt.changedTouches, engineRef.current.touchId);
          if (t) onPointerMove(t.clientX, t.clientY);
        }}
        onTouchEnd={onTouchRelease}
        onTouchCancel={onTouchRelease}
        onMouseDown={(e) => {
          // Skip the emulated mousedown a tap fires, or it counts as a second tap and Dashes
          if (performance.now() - lastTouchRef.current > 800) onPointerDown(e.clientX, e.clientY);
        }}
        onMouseMove={(e) => onPointerMove(e.clientX, e.clientY)}
        onMouseUp={onPointerUp}
        onMouseLeave={onPointerUp}
      />

      {(gameState === 'PLAYING' || gameState === 'PERK_SELECT') && (
        <LiveHUD
          store={hudStore}
          gameMode={gameMode}
          level={gameMode === 'campaign' ? localLevel(LEVELS[levelIndex]) : null}
          comm={hudComm}
          currentQuest={currentQuest}
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
          level={localLevel(LEVELS[levelIndex])}
          kind={storyKind}
          isFinal={levelIndex === LEVELS.length - 1}
          onDone={onStoryDone}
          onBack={returnToMainMenu}
        />
      )}

      <PerkModal
        isOpen={gameState === 'PERK_SELECT'}
        options={perkOffer}
        owned={engineRef.current.activePerks}
        subtitle={perkSubtitle}
        onPick={pickPerk}
      />

      <PauseModal
        isOpen={gameState === 'PAUSED'}
        onResume={togglePause}
        onRestart={() => {
          bankAbandonedRun();
          startGame(false);
        }}
        onMainMenu={() => {
          bankAbandonedRun();
          returnToMainMenu();
        }}
        isMuted={isMuted}
        isBgmMuted={isBgmMuted}
        onToggleMute={toggleMute}
        onToggleBgm={toggleBgm}
      />

      <GameOverModal
        isOpen={gameState === 'GAMEOVER'}
        stats={gameOverStats}
        gameMode={gameMode}
        level={gameMode === 'campaign' ? localLevel(LEVELS[levelIndex]) : null}
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
