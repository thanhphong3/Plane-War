import React, { useEffect, useState } from 'react';
import { Flame, House, Play, Skull, Trophy, Waves, Wrench, Zap } from 'lucide-react';
import { GameMode } from '../types/game';
import { sound } from '../utils/audio';
import { ShardIcon } from './Icon';

export interface GameOverStats {
  score: number;
  shardsEarned: number;
  maxCombo: number;
  nearMisses: number;
  wave: number;
  bossKills: number;
  isNewRecord: boolean;
  previousBest: number;
  reason: 'crashed' | 'timeup';
}

interface GameOverModalProps {
  isOpen: boolean;
  stats: GameOverStats;
  gameMode: GameMode;
  onPlayAgain: () => void;
  onOpenShop: () => void;
  onMainMenu: () => void;
}

const MODE_NAMES: Record<GameMode, string> = {
  endless: 'Endless',
  timed: 'Blitz 60s',
  hardcore: 'Hardcore',
};

const TIPS = [
  'Dash through enemies to smash them and boost your combo.',
  'Near-misses fill Overdrive 3x faster than shards.',
  'Laser columns flash before they fire — slide out sideways.',
  'Enemy bullets have a tiny hitbox. Graze them for points!',
  'Save your EMP for when a Sentinel fills the screen.',
  'At x5 combo your ship auto-fires. At x12 it double-fires.',
];

/** Score counter that ticks up when the modal opens. */
function useCountUp(target: number, active: boolean) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    const start = performance.now();
    const dur = 900;
    const tick = (now: number) => {
      const k = Math.min(1, (now - start) / dur);
      setValue(Math.round(target * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, active]);
  return value;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  isOpen,
  stats,
  gameMode,
  onPlayAgain,
  onOpenShop,
  onMainMenu,
}) => {
  const shown = useCountUp(stats.score, isOpen);
  if (!isOpen) return null;
  const tip = TIPS[(stats.score + stats.wave + stats.nearMisses) % TIPS.length];

  const cells = [
    { label: 'Shards', value: `+${stats.shardsEarned}`, icon: <ShardIcon size={13} />, color: 'text-amber-300' },
    { label: 'Best combo', value: `x${stats.maxCombo}`, icon: <Flame size={13} />, color: 'text-fuchsia-300' },
    { label: 'Near-misses', value: `${stats.nearMisses}`, icon: <Zap size={13} />, color: 'text-cyan-300' },
    { label: 'Level', value: `${stats.wave}`, icon: <Waves size={13} />, color: 'text-emerald-300' },
    { label: 'Sentinels', value: `${stats.bossKills}`, icon: <Skull size={13} />, color: 'text-rose-300' },
    {
      label: 'Best',
      value: Math.max(stats.previousBest, stats.score).toLocaleString('en-US'),
      icon: <Trophy size={13} />,
      color: 'text-slate-200',
    },
  ];

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 backdrop-blur-md anim-fade">
      <div className="glass-panel w-full max-w-sm rounded-3xl p-5 sm:p-6 text-center flex flex-col anim-pop panel-glow-pink">
        {stats.isNewRecord && (
          <div className="mx-auto mb-2 px-3.5 py-1 rounded-full bg-gradient-to-r from-amber-300 to-amber-500 text-slate-950 text-xs font-black uppercase font-cyber tracking-wider animate-bounce shadow-lg shadow-amber-400/30 flex items-center gap-1.5">
            <Trophy size={13} /> New Record!
          </div>
        )}

        <p className="text-[10px] uppercase tracking-[0.3em] text-slate-400 font-bold">{MODE_NAMES[gameMode]}</p>
        <h2 className="text-2xl sm:text-3xl font-black text-white font-cyber uppercase neon-glow-pink mt-0.5">
          {stats.reason === 'timeup' ? "Time's Up!" : 'Ship Destroyed'}
        </h2>

        {/* Score block */}
        <div className="my-4 py-4 px-4 rounded-2xl bg-slate-900/85 border border-slate-800">
          <p className="text-[11px] uppercase tracking-widest text-slate-400 font-bold font-cyber">Score</p>
          <p className="text-5xl font-black text-cyan-200 font-cyber neon-glow-cyan tabular-nums my-1">
            {shown.toLocaleString('en-US')}
          </p>
          <div className="grid grid-cols-3 gap-y-3 mt-3 pt-3 border-t border-slate-800">
            {cells.map((c) => (
              <div key={c.label} className="text-center">
                <span className="block text-[10px] text-slate-500 uppercase tracking-wide">{c.label}</span>
                <span className={`inline-flex items-center gap-1 text-sm font-black ${c.color}`}>
                  {c.icon}
                  <span className="tabular-nums">{c.value}</span>
                </span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-slate-400 mb-4 leading-snug">
          <span className="text-cyan-300 font-bold">TIP:</span> {tip}
        </p>

        <div className="space-y-2.5">
          <button
            type="button"
            onClick={() => {
              sound.playSound('click');
              onPlayAgain();
            }}
            className="w-full py-3.5 rounded-2xl btn-primary text-slate-950 font-black text-base uppercase font-cyber tracking-wider btn-cyber animate-glow flex items-center justify-center gap-2"
          >
            <Play size={18} fill="currentColor" /> Play Again
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                sound.playSound('click');
                onOpenShop();
              }}
              className="py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-amber-200 font-bold text-xs flex items-center justify-center gap-1.5 btn-cyber font-cyber"
            >
              <Wrench size={14} /> Hangar
            </button>
            <button
              type="button"
              onClick={() => {
                sound.playSound('click');
                onMainMenu();
              }}
              className="py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 font-bold text-xs flex items-center justify-center gap-1.5 btn-cyber font-cyber"
            >
              <House size={14} /> Menu
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
