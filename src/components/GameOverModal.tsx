import React, { useEffect, useState } from 'react';
import { Crown, Flame, House, Play, RotateCcw, Skull, Timer, Trophy, Waves, Wrench, Zap } from 'lucide-react';
import { LevelDef } from '../game/campaign';
import { tr } from '../i18n';
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
  reason: 'crashed' | 'timeup' | 'victory';
  /** Campaign: died during the Warden fight, so "retry from boss" is offered. */
  reachedBoss: boolean;
  /** Boss Rush progress, null in other modes. */
  bossRush: {
    cleared: number;
    total: number;
    /** Seconds this run lasted. */
    time: number;
    /** Fastest full clear (0 = none yet). */
    bestTime: number;
    newBestTime: boolean;
  } | null;
}

/** 83.4 → "1:23.4" */
export const formatRunTime = (sec: number) => {
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return `${m}:${s < 10 ? '0' : ''}${s.toFixed(1)}`;
};

interface GameOverModalProps {
  isOpen: boolean;
  stats: GameOverStats;
  gameMode: GameMode;
  level: LevelDef | null;
  onPlayAgain: () => void;
  onRetryBoss: () => void;
  onOpenShop: () => void;
  onMainMenu: () => void;
}

const modeName = (mode: GameMode) =>
  ({
    endless: tr('Endless', 'Vô Tận'),
    timed: tr('Blitz 60s', 'Tốc Chiến 60s'),
    hardcore: tr('Hardcore', 'Cực Hạn'),
    campaign: tr('Campaign', 'Chiến dịch'),
    bossrush: tr('Boss Rush', 'Boss Rush'),
  })[mode];

const TIPS: [en: string, vi: string][] = [
  [
    'Dash makes you invincible for a split second. Ram enemies with it to smash them and boost your combo.',
    'Lướt giúp bạn bất tử trong tích tắc. Húc nát kẻ địch bằng nó để tăng combo.',
  ],
  [
    'Dash INTO a Plasma Core (cyan target ring) to fire it back at the boss.',
    'Lướt VÀO Lõi Plasma (vòng mục tiêu xanh) để bắn ngược nó về phía boss.',
  ],
  ['Near-misses fill Overdrive 3x faster than shards.', 'Né sát nạp Quá Tải nhanh gấp 3 lần nhặt mảnh.'],
  ['Laser columns flash before they fire — slide out sideways.', 'Cột laser nhấp nháy trước khi bắn — trượt ngang ra ngoài.'],
  ['Enemy bullets have a tiny hitbox. Graze them for points!', 'Đạn địch có vùng va chạm rất nhỏ. Sượt qua chúng để ăn điểm!'],
  ['Save your EMP for when a Sentinel fills the screen.', 'Để dành EMP cho lúc Lính Canh phủ kín màn hình.'],
  [
    'At x5 combo your blaster fires at full rate. At x12 it double-fires.',
    'Ở combo x5, súng bắn tốc độ tối đa. Ở x12, súng bắn đôi.',
  ],
  [
    'Every ship has a signature gun: Phoenix splashes, Quantum pierces, Phantom homes in.',
    'Mỗi tàu có súng riêng: Phoenix nổ lan, Quantum xuyên giáp, Phantom tự bám mục tiêu.',
  ],
  [
    'Tactical Perks stack. Holo Echo + Static Aftershock turns every Dash into a trap.',
    'Các Nâng Cấp Chiến Thuật cộng dồn. Bóng Ảnh Holo + Dư Chấn Tĩnh Điện biến mỗi cú Lướt thành bẫy.',
  ],
  [
    'Retry Boss skips the flight, so the no-hit star needs a full run.',
    'Đánh Lại Boss sẽ bỏ qua chặng bay, nên sao không trúng đòn cần chơi trọn lượt.',
  ],
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
  level,
  onPlayAgain,
  onRetryBoss,
  onOpenShop,
  onMainMenu,
}) => {
  const shown = useCountUp(stats.score, isOpen);
  if (!isOpen) return null;
  const tip =
    level && stats.reachedBoss
      ? level.intel[(stats.score + stats.nearMisses) % level.intel.length]
      : tr(...TIPS[(stats.score + stats.wave + stats.nearMisses) % TIPS.length]);

  if (level) {
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 backdrop-blur-md anim-fade">
        <div className="glass-panel w-full max-w-sm rounded-3xl p-5 sm:p-6 text-center flex flex-col anim-pop panel-glow-pink">
          <p className="text-[10px] uppercase tracking-[0.3em] font-bold" style={{ color: level.accent }}>
            {level.code} • {level.name}
          </p>
          <h2 className="text-2xl sm:text-3xl font-black text-white font-cyber uppercase neon-glow-pink mt-1">
            {tr('Mission Failed', 'Nhiệm vụ thất bại')}
          </h2>
          <p className="text-xs text-slate-400 mt-1.5 italic">
            {stats.reachedBoss
              ? tr(`“${level.bossName} still holds the Root Key.”`, `“${level.bossName} vẫn đang giữ Khóa Gốc.”`)
              : tr('“Signal lost. Rerouting you to the sector entrance.”', '“Mất tín hiệu. Đang đưa bạn về lối vào khu vực.”')}
          </p>

          <div className="my-4 py-3 px-4 rounded-2xl bg-slate-900/85 border border-slate-800 grid grid-cols-3 gap-y-2">
            <div>
              <span className="block text-[10px] text-slate-500 uppercase tracking-wide">{tr('Score', 'Điểm')}</span>
              <span className="text-sm font-black text-cyan-200 tabular-nums">{shown.toLocaleString('en-US')}</span>
            </div>
            <div>
              <span className="block text-[10px] text-slate-500 uppercase tracking-wide">{tr('Shards', 'Mảnh')}</span>
              <span className="inline-flex items-center gap-1 text-sm font-black text-amber-300">
                <ShardIcon size={12} />+{stats.shardsEarned}
              </span>
            </div>
            <div>
              <span className="block text-[10px] text-slate-500 uppercase tracking-wide">{tr('Best combo', 'Combo cao nhất')}</span>
              <span className="text-sm font-black text-fuchsia-300">x{stats.maxCombo}</span>
            </div>
          </div>

          <p className="text-xs text-slate-300 mb-4 leading-snug">
            <span className="font-bold" style={{ color: level.accent }}>
              {tr('INTEL:', 'TÌNH BÁO:')}
            </span>{' '}
            {tip}
          </p>

          <div className="space-y-2.5">
            {stats.reachedBoss && (
              <button
                type="button"
                onClick={() => {
                  sound.playSound('click');
                  onRetryBoss();
                }}
                className="w-full py-3.5 rounded-2xl btn-primary text-slate-950 font-black text-base uppercase font-cyber tracking-wider btn-cyber animate-glow flex items-center justify-center gap-2"
              >
                <Skull size={18} /> {tr('Retry Boss', 'Đánh lại Boss')}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                sound.playSound('click');
                onPlayAgain();
              }}
              className={`w-full rounded-2xl font-black uppercase font-cyber tracking-wider btn-cyber flex items-center justify-center gap-2 ${
                stats.reachedBoss
                  ? 'py-2.5 text-xs bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-100'
                  : 'py-3.5 text-base btn-primary text-slate-950 animate-glow'
              }`}
            >
              <RotateCcw size={stats.reachedBoss ? 14 : 18} /> {tr('Restart Sector', 'Chơi lại khu vực')}
            </button>
            <button
              type="button"
              onClick={() => {
                sound.playSound('click');
                onMainMenu();
              }}
              className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 font-bold text-xs flex items-center justify-center gap-1.5 btn-cyber font-cyber"
            >
              <House size={14} /> {tr('Menu', 'Menu')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const rush = stats.bossRush;
  const cells = [
    { label: tr('Shards', 'Mảnh'), value: `+${stats.shardsEarned}`, icon: <ShardIcon size={13} />, color: 'text-amber-300' },
    { label: tr('Best combo', 'Combo cao nhất'), value: `x${stats.maxCombo}`, icon: <Flame size={13} />, color: 'text-fuchsia-300' },
    { label: tr('Near-misses', 'Né sát'), value: `${stats.nearMisses}`, icon: <Zap size={13} />, color: 'text-cyan-300' },
    rush
      ? { label: tr('Time', 'Thời gian'), value: formatRunTime(rush.time), icon: <Timer size={13} />, color: 'text-emerald-300' }
      : { label: tr('Level', 'Cấp độ'), value: `${stats.wave}`, icon: <Waves size={13} />, color: 'text-emerald-300' },
    rush
      ? { label: tr('Bosses', 'Boss'), value: `${rush.cleared}/${rush.total}`, icon: <Crown size={13} />, color: 'text-rose-300' }
      : { label: tr('Sentinels', 'Lính Canh'), value: `${stats.bossKills}`, icon: <Skull size={13} />, color: 'text-rose-300' },
    {
      label: tr('Best', 'Kỷ lục'),
      value: Math.max(stats.previousBest, stats.score).toLocaleString('en-US'),
      icon: <Trophy size={13} />,
      color: 'text-slate-200',
    },
  ];

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 backdrop-blur-md anim-fade">
      <div className="glass-panel w-full max-w-sm rounded-3xl p-5 sm:p-6 text-center flex flex-col anim-pop panel-glow-pink">
        {rush?.newBestTime && (
          <div className="mx-auto mb-2 px-3.5 py-1 rounded-full bg-gradient-to-r from-emerald-300 to-cyan-400 text-slate-950 text-xs font-black uppercase font-cyber tracking-wider shadow-lg shadow-emerald-400/30 flex items-center gap-1.5">
            <Timer size={13} /> {tr('Fastest clear!', 'Phá đảo nhanh nhất!')} {formatRunTime(rush.time)}
          </div>
        )}
        {stats.isNewRecord && (
          <div className="mx-auto mb-2 px-3.5 py-1 rounded-full bg-gradient-to-r from-amber-300 to-amber-500 text-slate-950 text-xs font-black uppercase font-cyber tracking-wider animate-bounce shadow-lg shadow-amber-400/30 flex items-center gap-1.5">
            <Trophy size={13} /> {tr('New Record!', 'Kỷ lục mới!')}
          </div>
        )}

        <p className="text-[10px] uppercase tracking-[0.3em] text-slate-400 font-bold">{modeName(gameMode)}</p>
        <h2 className="text-2xl sm:text-3xl font-black text-white font-cyber uppercase neon-glow-pink mt-0.5">
          {stats.reason === 'victory'
            ? tr('Gauntlet Cleared!', 'Phá Đảo Liên Hoàn!')
            : stats.reason === 'timeup'
            ? tr("Time's Up!", 'Hết giờ!')
            : tr('Ship Destroyed', 'Tàu bị phá hủy')}
        </h2>
        {rush && (
          <p className="text-xs text-slate-400 mt-1">
            {stats.reason === 'victory'
              ? tr('All 7 bosses down. +250 shard bounty!', 'Hạ cả 7 boss. Thưởng +250 mảnh!')
              : tr(`Fell at boss ${Math.min(rush.total, rush.cleared + 1)}/${rush.total}`, `Gục ngã ở boss ${Math.min(rush.total, rush.cleared + 1)}/${rush.total}`)}
            {rush.bestTime > 0 && ` • ${tr('Best', 'Kỷ lục')} ${formatRunTime(rush.bestTime)}`}
          </p>
        )}

        {/* Score block */}
        <div className="my-4 py-4 px-4 rounded-2xl bg-slate-900/85 border border-slate-800">
          <p className="text-[11px] uppercase tracking-widest text-slate-400 font-bold font-cyber">{tr('Score', 'Điểm')}</p>
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
          <span className="text-cyan-300 font-bold">{tr('TIP:', 'MẸO:')}</span> {tip}
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
            <Play size={18} fill="currentColor" /> {tr('Play Again', 'Chơi lại')}
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
              <Wrench size={14} /> {tr('Hangar', 'Xưởng tàu')}
            </button>
            <button
              type="button"
              onClick={() => {
                sound.playSound('click');
                onMainMenu();
              }}
              className="py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 font-bold text-xs flex items-center justify-center gap-1.5 btn-cyber font-cyber"
            >
              <House size={14} /> {tr('Menu', 'Menu')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
