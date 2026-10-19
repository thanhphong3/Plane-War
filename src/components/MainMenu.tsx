import React from 'react';
import {
  ChevronRight,
  Flame,
  Hand,
  InfinityIcon,
  Keyboard,
  Music,
  Play,
  Skull,
  Timer,
  Trophy,
  Volume2,
  VolumeX,
  Wrench,
  Zap,
} from 'lucide-react';
import { GameMode, SaveData, ShipDef } from '../types/game';
import { SHIPS, UPGRADES, hasClaimableAchievement, upgradeCost } from '../utils/constants';
import { sound } from '../utils/audio';
import { ShardIcon } from './Icon';
import { ShipPreview } from './ShipPreview';

interface MainMenuProps {
  saveData: SaveData;
  gameMode: GameMode;
  onSelectMode: (mode: GameMode) => void;
  onStartGame: () => void;
  onOpenShop: () => void;
  onOpenAchievements: () => void;
  isMuted: boolean;
  isBgmMuted: boolean;
  onToggleMute: () => void;
  onToggleBgm: () => void;
}

const MODES: {
  id: GameMode;
  name: string;
  tag: string;
  Icon: React.ComponentType<{ size?: number; className?: string }>;
  accent: string;
  best: (s: SaveData) => number;
}[] = [
  { id: 'endless', name: 'Endless', tag: 'Ramps up forever', Icon: InfinityIcon, accent: 'cyan', best: (s) => s.bestEndless },
  { id: 'timed', name: 'Blitz 60s', tag: 'Score attack', Icon: Timer, accent: 'fuchsia', best: (s) => s.bestTimed },
  { id: 'hardcore', name: 'Hardcore', tag: 'x2 shards', Icon: Skull, accent: 'amber', best: (s) => s.bestHardcore },
];

const ACCENTS: Record<string, { on: string; text: string }> = {
  cyan: { on: 'border-cyan-400 bg-cyan-500/15 shadow-cyan-500/25', text: 'text-cyan-300' },
  fuchsia: { on: 'border-fuchsia-400 bg-fuchsia-500/15 shadow-fuchsia-500/25', text: 'text-fuchsia-300' },
  amber: { on: 'border-amber-400 bg-amber-500/15 shadow-amber-500/25', text: 'text-amber-300' },
};

export const MainMenu: React.FC<MainMenuProps> = ({
  saveData,
  gameMode,
  onSelectMode,
  onStartGame,
  onOpenShop,
  onOpenAchievements,
  isMuted,
  isBgmMuted,
  onToggleMute,
  onToggleBgm,
}) => {
  const currentShip: ShipDef = SHIPS.find((s) => s.id === saveData.selectedShip) || SHIPS[0];

  const canAffordSomething =
    SHIPS.some((s) => !saveData.unlockedShips.includes(s.id) && saveData.shards >= s.cost) ||
    UPGRADES.some((u) => {
      const lvl = saveData.upgrades[u.id] || 0;
      return lvl < u.maxLevel && saveData.shards >= upgradeCost(u.baseCost, lvl);
    });
  const canClaim = hasClaimableAchievement(saveData);

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-3 sm:p-5 bg-slate-950/55 backdrop-blur-[3px]">
      <div className="glass-panel w-full max-w-md rounded-3xl p-5 sm:p-6 flex flex-col max-h-[94vh] custom-scroll anim-pop panel-glow">
        {/* Header Bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-400/40 text-amber-200 text-sm font-bold">
            <ShardIcon size={14} />
            <span className="tabular-nums">{saveData.shards.toLocaleString('en-US')}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onToggleBgm}
              title={isBgmMuted ? 'Turn music on' : 'Turn music off'}
              className="relative w-9 h-9 rounded-full bg-slate-800/90 border border-slate-700 flex items-center justify-center btn-cyber text-slate-200"
            >
              <Music size={15} className={isBgmMuted ? 'opacity-40' : ''} />
              {isBgmMuted && <span className="absolute w-5 h-[2px] bg-rose-400 rotate-45" />}
            </button>
            <button
              type="button"
              onClick={onToggleMute}
              title={isMuted ? 'Turn sound on' : 'Turn sound off'}
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
            Dash <span className="text-cyan-400">•</span> Graze <span className="text-fuchsia-400">•</span> Overdrive
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
            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-cyber">Your ship</p>
            <p className="text-lg font-black text-white font-cyber leading-tight" style={{ color: currentShip.color }}>
              {currentShip.name}
            </p>
            <p className="text-xs text-slate-300">{currentShip.perk}</p>
          </div>
          <span className="flex items-center gap-0.5 text-xs font-bold text-cyan-300 group-hover:translate-x-0.5 transition-transform">
            Hangar <ChevronRight size={14} />
          </span>
          {canAffordSomething && (
            <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-amber-400 animate-ping" />
          )}
        </button>

        {/* Mode selector with personal bests */}
        <div className="mt-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 font-cyber">Game mode</p>
          <div className="grid grid-cols-3 gap-2">
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
                  <span className="text-xs font-bold">{m.name}</span>
                  <span className={`text-[10px] ${active ? accent.text : 'text-slate-500'}`}>{m.tag}</span>
                  <span className="mt-1 text-[10px] text-slate-400 flex items-center gap-1">
                    <Trophy size={10} />
                    <span className="tabular-nums font-bold text-slate-200">{m.best(saveData).toLocaleString('en-US')}</span>
                  </span>
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
            <span>
              <strong className="text-white">Drag anywhere</strong> to fly — your finger never blocks the view.
            </span>
          </div>
          <div className="flex items-start gap-2.5">
            <span className="how-icon bg-fuchsia-500/20 text-fuchsia-300">
              <Zap size={13} />
            </span>
            <span>
              <strong className="text-white">Double-tap</strong> or hit <strong className="text-cyan-300">DASH</strong> to
              smash straight through enemies.
            </span>
          </div>
          <div className="flex items-start gap-2.5">
            <span className="how-icon bg-amber-500/20 text-amber-300">
              <Flame size={13} />
            </span>
            <span>
              <strong className="text-white">Skim past danger</strong> for near-misses — fill the bar to trigger{' '}
              <strong className="text-amber-300">Overdrive</strong>.
            </span>
          </div>
          <div className="hidden sm:flex items-start gap-2.5 text-slate-400">
            <span className="how-icon bg-slate-700/40 text-slate-300">
              <Keyboard size={13} />
            </span>
            <span>WASD / Arrows to move • Space to Dash • E for EMP • P to pause</span>
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
            <Play size={20} fill="currentColor" /> Launch
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
              <Wrench size={14} className="text-cyan-300" /> Hangar
              {canAffordSomething && (
                <span className="absolute top-1.5 right-2 px-1.5 rounded-full bg-amber-400 text-slate-950 text-[9px] font-black">
                  NEW
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
              <Trophy size={14} className="text-amber-300" /> Achievements
              {canClaim && (
                <span className="absolute top-1.5 right-2 w-2.5 h-2.5 rounded-full bg-rose-500 shadow shadow-rose-500/60 animate-pulse" />
              )}
            </button>
          </div>

          <p className="text-center text-[10px] text-slate-500 mt-1">
            Best combo x{saveData.bestCombo} • Sentinels destroyed {saveData.totalBossKills} • Runs {saveData.totalRuns}
          </p>
        </div>
      </div>
    </div>
  );
};
