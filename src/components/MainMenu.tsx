import React, { useState } from 'react';
import {
  BookOpen,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Crown,
  Flame,
  GraduationCap,
  Hand,
  InfinityIcon,
  Keyboard,
  ListChecks,
  Play,
  Settings,
  Skull,
  Star,
  Timer,
  Trophy,
  Volume2,
  VolumeX,
  Wrench,
  X,
  Zap,
} from 'lucide-react';
import { LEVELS } from '../game/campaign';
import { currentDaily, currentDailyQuests, dailyModifiers, msUntilTomorrow, prevDayKey, questById } from '../game/progression';
import { tr, useLang, numLocale } from '../i18n';
import { localLevel, localModifier, localShip, questLabel } from '../i18n/content';
import { useEscape } from '../hooks/useEscape';
import { GameMode, SaveData, ShipDef } from '../types/game';
import {
  BOSS_RUSH_ORDER,
  DAILY_MODIFIERS,
  DAILY_QUEST_BONUS,
  SHIPS,
  TUTORIAL_REWARD,
  UPGRADES,
  dailyBonus,
  hasClaimableAchievement,
  masteryLevel,
  paintedShip,
  upgradeCost,
} from '../utils/constants';
import { sound } from '../utils/audio';
import { formatRunTime } from './GameOverModal';
import { ShardIcon } from './Icon';
import { ShipPreview } from './ShipPreview';

interface MainMenuProps {
  saveData: SaveData;
  gameMode: GameMode;
  onSelectMode: (mode: GameMode) => void;
  onStartGame: () => void;
  onStartDaily: () => void;
  onStartTutorial: () => void;
  onOpenSettings: () => void;
  onOpenCampaign: () => void;
  onOpenShop: () => void;
  onOpenAchievements: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
}

const MODES: {
  id: GameMode;
  name: () => string;
  tag: () => string;
  Icon: React.ComponentType<{ size?: number; className?: string }>;
  accent: string;
  best: (s: SaveData) => number;
  /** Secondary record line (Boss Rush fastest clear). */
  extra?: (s: SaveData) => string | null;
}[] = [
  { id: 'endless', name: () => tr('Endless', 'Vô Tận'), tag: () => tr('Ramps up forever', 'Khó dần mãi mãi'), Icon: InfinityIcon, accent: 'cyan', best: (s) => s.bestEndless },
  { id: 'timed', name: () => tr('Blitz 60s', 'Tốc Chiến'), tag: () => tr('60s score attack', 'Săn điểm 60 giây'), Icon: Timer, accent: 'fuchsia', best: (s) => s.bestTimed },
  { id: 'hardcore', name: () => tr('Hardcore', 'Cực Hạn'), tag: () => tr('One life, x2 shards', 'Một mạng, x2 mảnh'), Icon: Skull, accent: 'amber', best: (s) => s.bestHardcore },
  {
    id: 'bossrush',
    name: () => tr('Boss Rush', 'Boss Rush'),
    tag: () => tr(`${BOSS_RUSH_ORDER.length} bosses in a row`, `${BOSS_RUSH_ORDER.length} boss liên hoàn`),
    Icon: Crown,
    accent: 'rose',
    best: (s) => s.bestBossRush,
    extra: (s) => (s.bestBossRushTime > 0 ? formatRunTime(s.bestBossRushTime) : null),
  },
];

const ACCENTS: Record<string, { on: string; text: string }> = {
  cyan: { on: 'bg-cyan-500/20 border-cyan-400/80', text: 'text-cyan-300' },
  fuchsia: { on: 'bg-fuchsia-500/20 border-fuchsia-400/80', text: 'text-fuchsia-300' },
  amber: { on: 'bg-amber-500/20 border-amber-400/80', text: 'text-amber-300' },
  rose: { on: 'bg-rose-500/20 border-rose-400/80', text: 'text-rose-300' },
};

const HeaderButton: React.FC<{ onClick: () => void; label: string; children: React.ReactNode }> = ({ onClick, label, children }) => (
  <button
    type="button"
    onClick={() => {
      sound.playSound('click');
      onClick();
    }}
    title={label}
    aria-label={label}
    className="w-9 h-9 rounded-full bg-slate-800/80 border border-slate-700 flex items-center justify-center btn-cyber text-slate-200 hover:text-white"
  >
    {children}
  </button>
);

/** Controls and the visual grammar, tucked behind the "?" button so the menu stays clean. */
const HowToPlay: React.FC<{ onClose: () => void; onStartTutorial: () => void }> = ({ onClose, onStartTutorial }) => {
  const lang = useLang();
  useEscape(true, onClose);
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md anim-fade" onClick={onClose}>
      <div
        className="glass-panel w-full max-w-sm rounded-3xl p-5 flex flex-col max-h-[90dvh] anim-pop panel-glow"
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black text-white font-cyber tracking-wide">{tr('HOW TO PLAY', 'CÁCH CHƠI')}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={tr('Close', 'Đóng')}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center btn-cyber border border-slate-700"
          >
            <X size={16} />
          </button>
        </div>

        <div className="custom-scroll mt-4 space-y-3 text-sm text-slate-300 pr-1">
          <div className="flex items-start gap-2.5">
            <span className="how-icon bg-cyan-500/20 text-cyan-300">
              <Hand size={13} />
            </span>
            {lang === 'vi' ? (
              <span>
                <strong className="text-white">Kéo ở bất kỳ đâu</strong> để bay — ngón tay không bao giờ che tầm nhìn.
              </span>
            ) : (
              <span>
                <strong className="text-white">Drag anywhere</strong> to fly — your finger never blocks the view.
              </span>
            )}
          </div>
          <div className="flex items-start gap-2.5">
            <span className="how-icon bg-fuchsia-500/20 text-fuchsia-300">
              <Zap size={13} />
            </span>
            {lang === 'vi' ? (
              <span>
                <strong className="text-white">Chạm đúp</strong> hoặc bấm <strong className="text-cyan-300">LƯỚT</strong> để lao vút{' '}
                <strong className="text-white">bất tử</strong>: húc nát kẻ địch, húc Lõi Plasma để bắn ngược lại.
              </span>
            ) : (
              <span>
                <strong className="text-white">Double-tap</strong> or hit <strong className="text-cyan-300">DASH</strong> for a short{' '}
                <strong className="text-white">invincible burst</strong>: ram enemies, ram Plasma Cores to fire them back.
              </span>
            )}
          </div>
          <div className="flex items-start gap-2.5">
            <span className="how-icon bg-amber-500/20 text-amber-300">
              <Flame size={13} />
            </span>
            {lang === 'vi' ? (
              <span>
                <strong className="text-white">Lướt sát nguy hiểm</strong> để nạp thanh năng lượng và kích hoạt{' '}
                <strong className="text-amber-300">Quá Tải</strong>.
              </span>
            ) : (
              <span>
                <strong className="text-white">Skim past danger</strong> to fill the energy bar and trigger{' '}
                <strong className="text-amber-300">Overdrive</strong>.
              </span>
            )}
          </div>

          {/* Visual grammar legend: what to grab, what to dodge, what to dash into */}
          <div className="grid grid-cols-3 gap-1.5 pt-1 text-xs">
            <span className="flex flex-col items-center gap-1 rounded-lg bg-amber-400/10 border border-amber-300/30 px-1.5 py-2 text-center">
              <span className="w-4 h-4 rounded-full border-2 border-white bg-amber-300/60 shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
              <strong className="text-amber-200 text-[11px]">{tr('GRAB', 'NHẶT')}</strong>
              <span className="text-[10px] text-slate-400 leading-tight">{tr('white rim', 'viền trắng')}</span>
            </span>
            <span className="flex flex-col items-center gap-1 rounded-lg bg-rose-500/10 border border-rose-400/30 px-1.5 py-2 text-center">
              <span className="w-4 h-4 rounded-full border-2 border-[#ff2d55] bg-pink-400/70 shadow-[0_0_8px_rgba(255,45,85,0.9)]" />
              <strong className="text-rose-300 text-[11px]">{tr('DODGE', 'NÉ')}</strong>
              <span className="text-[10px] text-slate-400 leading-tight">{tr('red rim', 'viền đỏ')}</span>
            </span>
            <span className="flex flex-col items-center gap-1 rounded-lg bg-cyan-500/10 border border-cyan-400/30 px-1.5 py-2 text-center">
              <span className="w-4 h-4 rounded-full border-2 border-dashed border-cyan-300 bg-orange-400/70" />
              <strong className="text-cyan-200 text-[11px]">{tr('DASH IN', 'LƯỚT VÀO')}</strong>
              <span className="text-[10px] text-slate-400 leading-tight">{tr('cyan target', 'mục tiêu xanh')}</span>
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              sound.playSound('click');
              onClose();
              onStartTutorial();
            }}
            className="w-full py-2.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-400/60 text-cyan-100 font-bold text-xs flex items-center justify-center gap-1.5 btn-cyber font-cyber"
          >
            <GraduationCap size={14} /> {tr('Play Flight Training', 'Vào Huấn Luyện Bay')}
          </button>

          <div className="hidden sm:flex items-start gap-2.5 text-slate-400 text-xs">
            <span className="how-icon bg-slate-700/40 text-slate-300">
              <Keyboard size={13} />
            </span>
            <span>
              {tr(
                'WASD / Arrows to move • Space to Dash • E for EMP • P to pause',
                'WASD / Mũi tên để bay • Space để Lướt • E để EMP • P để tạm dừng'
              )}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export const MainMenu: React.FC<MainMenuProps> = ({
  saveData,
  gameMode,
  onSelectMode,
  onStartGame,
  onStartDaily,
  onStartTutorial,
  onOpenSettings,
  onOpenCampaign,
  onOpenShop,
  onOpenAchievements,
  isMuted,
  onToggleMute,
}) => {
  useLang();
  const [showHelp, setShowHelp] = useState(false);
  const [showMissions, setShowMissions] = useState(false);
  const currentShip: ShipDef = localShip(paintedShip(SHIPS.find((s) => s.id === saveData.selectedShip) || SHIPS[0], saveData));
  const shipMastery = masteryLevel(saveData.shipXp[currentShip.id] || 0);

  // Daily Challenge & missions (both roll over at local midnight)
  const daily = currentDaily(saveData);
  const mods = dailyModifiers().map((id) => localModifier(DAILY_MODIFIERS.find((m) => m.id === id) || DAILY_MODIFIERS[0]));
  const dq = currentDailyQuests(saveData);
  const questsDone = dq.done.filter(Boolean).length;
  const resetMins = Math.ceil(msUntilTomorrow() / 60000);
  const resetIn = `${Math.floor(resetMins / 60)}h ${resetMins % 60}m`;
  // A streak survives only if the last Daily was today or yesterday
  const playedToday = daily.lastPlayed === daily.date;
  const streakAlive = playedToday || daily.lastPlayed === prevDayKey(daily.date);
  const streakNow = streakAlive ? daily.streak : 0;
  const streakIfPlayed = playedToday ? daily.streak : streakNow + 1;
  const campaignDone = (saveData.campaignStars[LEVELS.length - 1] || 0) > 0;
  const nextSector = localLevel(LEVELS[Math.min(LEVELS.length - 1, saveData.campaignUnlocked)]);
  const totalStars = saveData.campaignStars.reduce((s, n) => s + (n || 0), 0);

  const canAffordSomething =
    SHIPS.some((s) => !saveData.unlockedShips.includes(s.id) && saveData.shards >= s.cost) ||
    UPGRADES.some((u) => {
      const lvl = saveData.upgrades[u.id] || 0;
      return lvl < u.maxLevel && saveData.shards >= upgradeCost(u.baseCost, lvl);
    });
  const canClaim = hasClaimableAchievement(saveData);

  const mode = MODES.find((m) => m.id === gameMode) || MODES[0];
  const modeAccent = ACCENTS[mode.accent];
  const modeExtra = mode.extra?.(saveData);

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-3 sm:p-5 bg-slate-950/55 backdrop-blur-[3px]">
      <div className="glass-panel w-full max-w-md rounded-3xl p-4 sm:p-6 flex flex-col gap-3 max-h-[94dvh] custom-scroll *:shrink-0 anim-pop panel-glow">
        {/* Header: currency left, utility icons right */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-400/40 text-amber-200 text-sm font-bold">
            <ShardIcon size={14} />
            <span className="tabular-nums">{saveData.shards.toLocaleString(numLocale())}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <HeaderButton onClick={() => setShowHelp(true)} label={tr('How to play', 'Cách chơi')}>
              <CircleHelp size={16} />
            </HeaderButton>
            <HeaderButton onClick={onToggleMute} label={isMuted ? tr('Turn sound on', 'Bật âm thanh') : tr('Turn sound off', 'Tắt âm thanh')}>
              {isMuted ? <VolumeX size={16} className="text-rose-300" /> : <Volume2 size={16} />}
            </HeaderButton>
            <HeaderButton onClick={onOpenSettings} label={tr('Settings', 'Cài đặt')}>
              <Settings size={16} />
            </HeaderButton>
          </div>
        </div>

        {/* Title */}
        <div className="text-center">
          <h1 className="title-logo text-[2.5rem] sm:text-[3.2rem] font-black italic tracking-tight font-cyber leading-none py-1 whitespace-nowrap">
            NEON BLITZ
          </h1>
          <p className="text-[10px] sm:text-[11px] text-slate-400 font-bold mt-1 tracking-[0.3em] uppercase">
            {tr('Dash', 'Lướt')} <span className="text-cyan-400">•</span> {tr('Graze', 'Sượt')}{' '}
            <span className="text-fuchsia-400">•</span> {tr('Overdrive', 'Quá Tải')}
          </p>
        </div>

        {/* New pilots: Flight Training first (it stays in How to Play afterwards) */}
        {!saveData.tutorialDone && (
          <button
            type="button"
            onClick={() => {
              sound.playSound('click');
              onStartTutorial();
            }}
            className="flex items-center gap-3 p-3 rounded-2xl border border-cyan-400/60 bg-cyan-500/10 hover:border-cyan-300 btn-cyber text-left animate-glow"
          >
            <span className="shrink-0 w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-400/50 flex items-center justify-center text-cyan-200">
              <GraduationCap size={20} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-black text-white font-cyber leading-tight">
                {saveData.totalRuns === 0 ? tr('New pilot? Start here', 'Phi công mới? Bắt đầu ở đây') : tr('Flight Training', 'Huấn luyện bay')}
              </span>
              <span className="block text-[11px] text-slate-300 leading-tight mt-0.5">
                {tr('7 quick lessons · about 2 minutes', '7 bài ngắn · khoảng 2 phút')}
              </span>
            </span>
            <span className="flex items-center gap-1 text-xs font-black text-amber-300 shrink-0">
              +{TUTORIAL_REWARD} <ShardIcon size={12} />
            </span>
          </button>
        )}

        {/* Ship: tap to open the Hangar */}
        <button
          type="button"
          onClick={() => {
            sound.playSound('click');
            onOpenShop();
          }}
          className="group relative flex items-center gap-3 p-2.5 pr-3 rounded-2xl bg-slate-900/60 border border-slate-700/70 hover:border-slate-500 btn-cyber text-left"
        >
          <div className="relative shrink-0">
            <div className="absolute inset-2 rounded-full blur-xl opacity-60" style={{ backgroundColor: currentShip.color }} />
            <ShipPreview ship={currentShip} size={56} animate />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-base font-black font-cyber leading-tight truncate" style={{ color: currentShip.color }}>
              {currentShip.name}
            </p>
            <p className="text-xs text-slate-400 truncate">
              {tr('Mastery', 'Thông thạo')} {shipMastery} · {currentShip.perk}
            </p>
          </div>
          <span className="flex items-center gap-1 text-xs font-bold text-cyan-300 group-hover:translate-x-0.5 transition-transform">
            <Wrench size={13} /> <span className="hidden min-[400px]:inline">{tr('Hangar', 'Xưởng tàu')}</span> <ChevronRight size={14} />
          </span>
          {canAffordSomething && (
            <span className="absolute -top-1.5 right-3 px-1.5 rounded-full bg-amber-400 text-slate-950 text-[9px] font-black">
              {tr('NEW', 'MỚI')}
            </span>
          )}
        </button>

        {/* Arcade: pick a mode, then launch */}
        <div className="p-3 rounded-2xl bg-slate-900/60 border border-slate-800/80">
          <div role="tablist" aria-label={tr('Arcade modes', 'Chế độ arcade')} className="grid grid-cols-4 gap-1.5">
            {MODES.map((m) => {
              const active = gameMode === m.id;
              const accent = ACCENTS[m.accent];
              return (
                <button
                  key={m.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    sound.playSound('click');
                    onSelectMode(m.id);
                  }}
                  className={`py-2 px-1 rounded-xl border flex flex-col items-center gap-1 btn-cyber ${
                    active ? `${accent.on} text-white` : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <m.Icon size={18} className={active ? accent.text : ''} />
                  <span className="text-[11px] font-bold leading-none whitespace-nowrap">{m.name()}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-2.5 flex items-center justify-between gap-2 px-1 text-xs">
            <span className={`truncate ${modeAccent.text}`}>{mode.tag()}</span>
            <span className="flex items-center gap-2 shrink-0 text-slate-400">
              <span className="flex items-center gap-1">
                <Trophy size={11} />
                <span className="tabular-nums font-bold text-slate-100">{mode.best(saveData).toLocaleString(numLocale())}</span>
              </span>
              {modeExtra && (
                <span className="flex items-center gap-1">
                  <Timer size={11} />
                  <span className="tabular-nums font-bold text-emerald-300">{modeExtra}</span>
                </span>
              )}
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              sound.playSound('click');
              onStartGame();
            }}
            className="mt-3 w-full py-3.5 rounded-xl btn-primary text-slate-950 font-black text-lg tracking-[0.15em] uppercase font-cyber btn-cyber animate-glow flex items-center justify-center gap-2"
          >
            <Play size={20} fill="currentColor" /> {tr('Launch', 'Xuất kích')}
          </button>
        </div>

        {/* Campaign & Daily side by side */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              sound.playSound('click');
              onOpenCampaign();
            }}
            className="group flex flex-col gap-1 p-3 rounded-2xl border border-rose-400/40 bg-rose-500/10 hover:border-rose-300 btn-cyber text-left"
          >
            <span className="flex items-center justify-between">
              <BookOpen size={18} className="text-rose-300" />
              <span className="flex items-center gap-1 text-[11px] font-bold text-amber-300 tabular-nums">
                <Star size={11} fill="currentColor" /> {totalStars}/{LEVELS.length * 3}
              </span>
            </span>
            <span className="text-sm font-black text-white font-cyber leading-tight">{tr('Campaign', 'Chiến dịch')}</span>
            <span className="text-[11px] text-slate-400 leading-tight truncate">
              {campaignDone ? tr('Replay for 3 stars', 'Chơi lại lấy 3 sao') : `${nextSector.code} · ${nextSector.name}`}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              sound.playSound('click');
              onStartDaily();
            }}
            title={mods.map((m) => `${m.name}: ${m.desc}`).join('\n')}
            className="group flex flex-col gap-1 p-3 rounded-2xl border border-amber-400/40 bg-amber-500/10 hover:border-amber-300 btn-cyber text-left"
          >
            <span className="flex items-center justify-between">
              <CalendarDays size={18} className="text-amber-300" />
              <span className="flex items-center gap-1 text-[11px] font-bold text-amber-200 tabular-nums">
                <Flame size={11} /> {streakNow}
              </span>
            </span>
            <span className="text-sm font-black text-white font-cyber leading-tight">{tr('Daily', 'Thử thách ngày')}</span>
            <span className="text-[11px] text-slate-400 leading-tight truncate">
              {daily.rewarded
                ? `${tr('Best', 'Kỷ lục')} ${daily.best.toLocaleString(numLocale())} · ${resetIn}`
                : tr(`+${dailyBonus(streakIfPlayed, 1)} shards today`, `+${dailyBonus(streakIfPlayed, 1)} mảnh hôm nay`)}
            </span>
          </button>
        </div>

        {/* Secondary: missions (expandable) and achievements */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              sound.playSound('click');
              setShowMissions((v) => !v);
            }}
            aria-expanded={showMissions}
            className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-slate-900/70 hover:bg-slate-800 border border-slate-700/70 text-slate-200 text-xs font-bold btn-cyber"
          >
            <ListChecks size={14} className="text-cyan-300" />
            {tr('Missions', 'Nhiệm vụ')}
            <span className="tabular-nums text-slate-400">{questsDone}/3</span>
            <ChevronDown size={13} className={`text-slate-500 transition-transform ${showMissions ? 'rotate-180' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => {
              sound.playSound('click');
              onOpenAchievements();
            }}
            className="relative flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-slate-900/70 hover:bg-slate-800 border border-slate-700/70 text-slate-200 text-xs font-bold btn-cyber"
          >
            <Trophy size={14} className="text-amber-300" /> {tr('Achievements', 'Thành tựu')}
            {canClaim && <span className="absolute top-1.5 right-2 w-2 h-2 rounded-full bg-rose-500 animate-pulse" />}
          </button>
        </div>

        {showMissions && (
          <div className="-mt-1 p-3 rounded-2xl bg-slate-900/60 border border-slate-800/80 anim-drop space-y-1.5">
            {dq.ids.map((id, i) => {
              const q = questById(id);
              const done = dq.done[i];
              const prog = Math.min(q.target, Math.floor(dq.progress[i] || 0));
              return (
                <div key={id} className="flex items-center gap-2 text-xs">
                  <span
                    className={`w-4 h-4 shrink-0 rounded-full border flex items-center justify-center ${
                      done ? 'bg-emerald-400 border-emerald-300 text-slate-950' : 'border-slate-600'
                    }`}
                  >
                    {done && <Check size={10} strokeWidth={3} />}
                  </span>
                  <span className={`min-w-0 flex-1 truncate ${done ? 'text-slate-500 line-through' : 'text-slate-200'}`}>{questLabel(q)}</span>
                  <span className="text-[10px] tabular-nums text-slate-400">
                    {done ? '' : `${prog.toLocaleString(numLocale())}/${q.target.toLocaleString(numLocale())} · `}
                    <span className="text-amber-300 font-bold">+{q.reward}</span>
                  </span>
                </div>
              );
            })}
            <p className="pt-1 text-[10px] text-slate-500 flex items-center justify-between">
              <span>
                {tr('Resets in', 'Làm mới sau')} {resetIn}
              </span>
              <span className="text-amber-300 font-bold flex items-center gap-1">
                {dq.bonusPaid ? (
                  <>
                    <Check size={11} /> {tr('Bonus earned', 'Đã nhận thưởng')}
                  </>
                ) : (
                  <>
                    {tr('All 3', 'Cả 3')}: +{DAILY_QUEST_BONUS} <ShardIcon size={10} />
                  </>
                )}
              </span>
            </p>
          </div>
        )}
      </div>

      {showHelp && <HowToPlay onClose={() => setShowHelp(false)} onStartTutorial={onStartTutorial} />}
    </div>
  );
};
