import React from 'react';
import {
  BookOpen,
  ChevronRight,
  Crown,
  Flame,
  Hand,
  InfinityIcon,
  Keyboard,
  Music,
  Play,
  Skull,
  Star,
  Timer,
  Trophy,
  Volume2,
  VolumeX,
  Wrench,
  Zap,
} from 'lucide-react';
import { LEVELS } from '../game/campaign';
import { setLang, tr, useLang } from '../i18n';
import { localLevel, localShip } from '../i18n/content';
import { GameMode, SaveData, ShipDef } from '../types/game';
import { SHIPS, UPGRADES, hasClaimableAchievement, upgradeCost } from '../utils/constants';
import { sound } from '../utils/audio';
import { formatRunTime } from './GameOverModal';
import { ShardIcon } from './Icon';
import { ShipPreview } from './ShipPreview';

interface MainMenuProps {
  saveData: SaveData;
  gameMode: GameMode;
  onSelectMode: (mode: GameMode) => void;
  onStartGame: () => void;
  onOpenCampaign: () => void;
  onOpenShop: () => void;
  onOpenAchievements: () => void;
  isMuted: boolean;
  isBgmMuted: boolean;
  onToggleMute: () => void;
  onToggleBgm: () => void;
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
  { id: 'timed', name: () => tr('Blitz 60s', 'Tốc Chiến 60s'), tag: () => tr('Score attack', 'Săn điểm'), Icon: Timer, accent: 'fuchsia', best: (s) => s.bestTimed },
  { id: 'hardcore', name: () => tr('Hardcore', 'Cực Hạn'), tag: () => tr('x2 shards', 'x2 mảnh'), Icon: Skull, accent: 'amber', best: (s) => s.bestHardcore },
  {
    id: 'bossrush',
    name: () => tr('Boss Rush', 'Boss Rush'),
    tag: () => tr('7 bosses in a row', '7 boss liên hoàn'),
    Icon: Crown,
    accent: 'rose',
    best: (s) => s.bestBossRush,
    extra: (s) => (s.bestBossRushTime > 0 ? formatRunTime(s.bestBossRushTime) : null),
  },
];

const ACCENTS: Record<string, { on: string; text: string }> = {
  cyan: { on: 'border-cyan-400 bg-cyan-500/15 shadow-cyan-500/25', text: 'text-cyan-300' },
  fuchsia: { on: 'border-fuchsia-400 bg-fuchsia-500/15 shadow-fuchsia-500/25', text: 'text-fuchsia-300' },
  amber: { on: 'border-amber-400 bg-amber-500/15 shadow-amber-500/25', text: 'text-amber-300' },
  rose: { on: 'border-rose-400 bg-rose-500/15 shadow-rose-500/25', text: 'text-rose-300' },
};

export const MainMenu: React.FC<MainMenuProps> = ({
  saveData,
  gameMode,
  onSelectMode,
  onStartGame,
  onOpenCampaign,
  onOpenShop,
  onOpenAchievements,
  isMuted,
  isBgmMuted,
  onToggleMute,
  onToggleBgm,
}) => {
  const lang = useLang();
  const currentShip: ShipDef = localShip(SHIPS.find((s) => s.id === saveData.selectedShip) || SHIPS[0]);
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

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-3 sm:p-5 bg-slate-950/55 backdrop-blur-[3px]">
      <div className="glass-panel w-full max-w-md rounded-3xl p-5 sm:p-6 flex flex-col max-h-[94vh] custom-scroll *:shrink-0 anim-pop panel-glow">
        {/* Header Bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-400/40 text-amber-200 text-sm font-bold">
            <ShardIcon size={14} />
            <span className="tabular-nums">{saveData.shards.toLocaleString('en-US')}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                sound.playSound('click');
                setLang(lang === 'vi' ? 'en' : 'vi');
              }}
              title={tr('Switch language', 'Đổi ngôn ngữ')}
              aria-label={tr('Switch language', 'Đổi ngôn ngữ')}
              className="h-9 p-1 rounded-full bg-slate-800/90 border border-slate-700 flex items-center btn-cyber text-[10px] font-black font-cyber"
            >
              {(['en', 'vi'] as const).map((l) => (
                <span
                  key={l}
                  className={`px-2 py-1 rounded-full transition-colors ${
                    lang === l ? 'bg-cyan-400 text-slate-950' : 'text-slate-400'
                  }`}
                >
                  {l.toUpperCase()}
                </span>
              ))}
            </button>
            <button
              type="button"
              onClick={onToggleBgm}
              title={isBgmMuted ? tr('Turn music on', 'Bật nhạc') : tr('Turn music off', 'Tắt nhạc')}
              className="relative w-9 h-9 rounded-full bg-slate-800/90 border border-slate-700 flex items-center justify-center btn-cyber text-slate-200"
            >
              <Music size={15} className={isBgmMuted ? 'opacity-40' : ''} />
              {isBgmMuted && <span className="absolute w-5 h-[2px] bg-rose-400 rotate-45" />}
            </button>
            <button
              type="button"
              onClick={onToggleMute}
              title={isMuted ? tr('Turn sound on', 'Bật âm thanh') : tr('Turn sound off', 'Tắt âm thanh')}
              className="w-9 h-9 rounded-full bg-slate-800/90 border border-slate-700 flex items-center justify-center btn-cyber text-slate-200"
            >
              {isMuted ? <VolumeX size={15} className="text-rose-300" /> : <Volume2 size={15} />}
            </button>
          </div>
        </div>

        {/* Title */}
        <div className="text-center mt-3">
          <h1 className="title-logo text-[2.6rem] sm:text-[3.3rem] font-black italic tracking-tight font-cyber leading-none py-1 whitespace-nowrap">
            NEON BLITZ
          </h1>
          <p className="text-[11px] sm:text-xs text-slate-300 font-bold mt-1.5 tracking-[0.3em] uppercase">
            {tr('Dash', 'Lướt')} <span className="text-cyan-400">•</span> {tr('Graze', 'Sượt')}{' '}
            <span className="text-fuchsia-400">•</span> {tr('Overdrive', 'Quá Tải')}
          </p>
        </div>

        {/* Hangar preview */}
        <button
          type="button"
          onClick={() => {
            sound.playSound('click');
            onOpenShop();
          }}
          className="group mt-4 relative flex items-center gap-3 p-3 rounded-2xl bg-slate-900/70 border border-slate-700/70 hover:border-slate-500 btn-cyber text-left"
        >
          <div className="relative shrink-0">
            <div
              className="absolute inset-2 rounded-full blur-xl opacity-60"
              style={{ backgroundColor: currentShip.color }}
            />
            <ShipPreview ship={currentShip} size={72} animate />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-cyber">{tr('Your ship', 'Tàu của bạn')}</p>
            <p className="text-lg font-black text-white font-cyber leading-tight" style={{ color: currentShip.color }}>
              {currentShip.name}
            </p>
            <p className="text-xs text-slate-300">{currentShip.perk}</p>
            <p className="text-[11px] text-slate-400 leading-snug mt-0.5">{currentShip.weapon}</p>
          </div>
          <span className="flex items-center gap-0.5 text-xs font-bold text-cyan-300 group-hover:translate-x-0.5 transition-transform">
            {tr('Hangar', 'Xưởng tàu')} <ChevronRight size={14} />
          </span>
          {canAffordSomething && (
            <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-amber-400 animate-ping" />
          )}
        </button>

        {/* Story campaign */}
        <button
          type="button"
          onClick={() => {
            sound.playSound('click');
            onOpenCampaign();
          }}
          className="group mt-3 relative overflow-hidden flex items-center gap-3 p-3 rounded-2xl border-2 border-rose-400/50 bg-gradient-to-r from-rose-500/15 via-fuchsia-500/10 to-indigo-500/15 hover:border-rose-300 btn-cyber text-left shadow-lg shadow-rose-500/10"
        >
          <span className="w-11 h-11 shrink-0 rounded-xl bg-rose-500/20 border border-rose-400/50 flex items-center justify-center text-rose-200">
            <BookOpen size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] text-rose-300 uppercase tracking-[0.2em] font-cyber font-bold">{tr('Campaign', 'Chiến dịch')}</p>
            <p className="text-base font-black text-white font-cyber leading-tight">GRIDFALL</p>
            <p className="text-[11px] text-slate-300 truncate">
              {campaignDone
                ? tr('Grid restored. Replay for 3 stars', 'Lưới đã hồi sinh. Chơi lại để lấy 3 sao')
                : `${tr('Next', 'Tiếp theo')}: ${nextSector.code} · ${nextSector.name}`}
            </p>
          </div>
          <div className="flex flex-col items-end gap-0.5">
            <span className="flex items-center gap-1 text-xs font-bold text-amber-300 tabular-nums">
              <Star size={12} fill="currentColor" /> {totalStars}/{LEVELS.length * 3}
            </span>
            <span className="flex items-center gap-0.5 text-xs font-bold text-rose-200 group-hover:translate-x-0.5 transition-transform">
              {tr('Play', 'Chơi')} <ChevronRight size={14} />
            </span>
          </div>
        </button>

        {/* Mode selector with personal bests */}
        <div className="mt-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 font-cyber">{tr('Arcade modes', 'Chế độ arcade')}</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {MODES.map((m) => {
              const active = gameMode === m.id;
              const accent = ACCENTS[m.accent];
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    sound.playSound('click');
                    onSelectMode(m.id);
                  }}
                  className={`py-2.5 px-1.5 rounded-xl border-2 flex flex-col items-center gap-0.5 btn-cyber ${
                    active
                      ? `${accent.on} shadow-lg text-white`
                      : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                  }`}
                >
                  <m.Icon size={18} className={active ? accent.text : ''} />
                  <span className="text-xs font-bold">{m.name()}</span>
                  <span className={`text-[10px] ${active ? accent.text : 'text-slate-500'}`}>{m.tag()}</span>
                  <span className="mt-1 text-[10px] text-slate-400 flex items-center gap-1">
                    <Trophy size={10} />
                    <span className="tabular-nums font-bold text-slate-200">{m.best(saveData).toLocaleString('en-US')}</span>
                  </span>
                  {m.extra?.(saveData) && (
                    <span className="text-[10px] text-slate-400 flex items-center gap-1">
                      <Timer size={10} />
                      <span className="tabular-nums font-bold text-emerald-300">{m.extra(saveData)}</span>
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Quick Instructions */}
        <div className="mt-4 bg-slate-900/60 rounded-2xl p-3 border border-slate-800/80 text-xs text-slate-300 space-y-2">
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
                <strong className="text-white">Chạm đúp</strong> hoặc bấm <strong className="text-cyan-300">LƯỚT</strong> để
                lao vút <strong className="text-white">bất tử trong chốc lát</strong>: húc nát kẻ địch (+combo), húc Lõi
                Plasma để bắn ngược lại. Hồi chiêu ~2s.
              </span>
            ) : (
              <span>
                <strong className="text-white">Double-tap</strong> or hit <strong className="text-cyan-300">DASH</strong> for a
                short <strong className="text-white">invincible burst</strong>: ram enemies to smash them (+combo), ram
                Plasma Cores to fire them back. Recharges in ~2s.
              </span>
            )}
          </div>
          <div className="flex items-start gap-2.5">
            <span className="how-icon bg-amber-500/20 text-amber-300">
              <Flame size={13} />
            </span>
            {lang === 'vi' ? (
              <span>
                <strong className="text-white">Lướt sát nguy hiểm</strong> để né sát — nạp đầy thanh để kích hoạt{' '}
                <strong className="text-amber-300">Quá Tải</strong>.
              </span>
            ) : (
              <span>
                <strong className="text-white">Skim past danger</strong> for near-misses — fill the bar to trigger{' '}
                <strong className="text-amber-300">Overdrive</strong>.
              </span>
            )}
          </div>
          {/* Visual grammar legend: what to grab, what to dodge, what to dash into */}
          <div className="grid grid-cols-3 gap-1.5 pt-1">
            <span className="flex items-center gap-1.5 rounded-lg bg-amber-400/10 border border-amber-300/30 px-2 py-1.5">
              <span className="relative w-4 h-4 shrink-0 rounded-full border-2 border-white bg-amber-300/60 shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
              <span className="leading-tight">
                <strong className="text-amber-200 block text-[11px]">{tr('GRAB', 'NHẶT')}</strong>
                <span className="text-[10px] text-slate-400">{tr('white rim, sparkles', 'viền trắng, lấp lánh')}</span>
              </span>
            </span>
            <span className="flex items-center gap-1.5 rounded-lg bg-rose-500/10 border border-rose-400/30 px-2 py-1.5">
              <span className="w-4 h-4 shrink-0 rounded-full border-2 border-[#ff2d55] bg-pink-400/70 shadow-[0_0_8px_rgba(255,45,85,0.9)]" />
              <span className="leading-tight">
                <strong className="text-rose-300 block text-[11px]">{tr('DODGE', 'NÉ')}</strong>
                <span className="text-[10px] text-slate-400">{tr('red rim = hurts', 'viền đỏ = gây sát thương')}</span>
              </span>
            </span>
            <span className="flex items-center gap-1.5 rounded-lg bg-cyan-500/10 border border-cyan-400/30 px-2 py-1.5">
              <span className="w-4 h-4 shrink-0 rounded-full border-2 border-dashed border-cyan-300 bg-orange-400/70" />
              <span className="leading-tight">
                <strong className="text-cyan-200 block text-[11px]">{tr('DASH IN', 'LƯỚT VÀO')}</strong>
                <span className="text-[10px] text-slate-400">{tr('cyan target', 'mục tiêu xanh')}</span>
              </span>
            </span>
          </div>
          <div className="hidden sm:flex items-start gap-2.5 text-slate-400">
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

        {/* CTAs */}
        <div className="flex flex-col gap-2 mt-4">
          <button
            type="button"
            onClick={() => {
              sound.playSound('click');
              onStartGame();
            }}
            className="w-full py-4 rounded-2xl btn-primary text-slate-950 font-black text-lg tracking-[0.15em] uppercase font-cyber btn-cyber animate-glow flex items-center justify-center gap-2"
          >
            <Play size={20} fill="currentColor" /> {tr('Launch', 'Xuất kích')}
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                sound.playSound('click');
                onOpenShop();
              }}
              className="relative py-3 rounded-2xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 text-slate-100 font-bold text-xs flex items-center justify-center gap-1.5 btn-cyber font-cyber"
            >
              <Wrench size={14} className="text-cyan-300" /> {tr('Hangar', 'Xưởng tàu')}
              {canAffordSomething && (
                <span className="absolute top-1.5 right-2 px-1.5 rounded-full bg-amber-400 text-slate-950 text-[9px] font-black">
                  {tr('NEW', 'MỚI')}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                sound.playSound('click');
                onOpenAchievements();
              }}
              className="relative py-3 rounded-2xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 text-amber-200 font-bold text-xs flex items-center justify-center gap-1.5 btn-cyber font-cyber"
            >
              <Trophy size={14} className="text-amber-300" /> {tr('Achievements', 'Thành tựu')}
              {canClaim && (
                <span className="absolute top-1.5 right-2 w-2.5 h-2.5 rounded-full bg-rose-500 shadow shadow-rose-500/60 animate-pulse" />
              )}
            </button>
          </div>

          <p className="text-center text-[10px] text-slate-500 mt-1">
            {tr('Best combo', 'Combo cao nhất')} x{saveData.bestCombo} • {tr('Bosses destroyed', 'Boss đã hạ')}{' '}
            {saveData.totalBossKills} • {tr('Runs', 'Lượt chơi')} {saveData.totalRuns}
          </p>
        </div>
      </div>
    </div>
  );
};
