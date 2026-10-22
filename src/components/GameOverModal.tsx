import React, { useEffect, useState } from 'react';
import {
  CalendarDays,
  Check,
  ChevronDown,
  Crown,
  Flame,
  House,
  Play,
  RotateCcw,
  Share2,
  Skull,
  Star,
  Timer,
  Trophy,
  Waves,
  Wrench,
  Zap,
} from 'lucide-react';
import { ACTS, LevelDef, actIndexOf, isActFinale } from '../game/campaign';
import { ScoreSource } from '../game/engine';
import { tr, numLocale } from '../i18n';
import { localModifier, masteryRewardLabel } from '../i18n/content';
import { DailyModifierId, GameMode, PerkId } from '../types/game';
import { sound } from '../utils/audio';
import { DAILY_MODIFIERS, MASTERY_REWARDS, MASTERY_XP, MAX_MASTERY } from '../utils/constants';
import { ShardIcon } from './Icon';
import { PerkIcon, perkDef } from './PerkModal';

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
    /** Roster index the Rush started from (0 = full gauntlet). */
    start: number;
  } | null;
  /** Points per source this run. */
  scoreBy: Record<ScoreSource, number>;
  /** Ship Mastery XP this run earned. */
  mastery: {
    shipName: string;
    color: string;
    gained: number;
    total: number;
    prevLevel: number;
    level: number;
  } | null;
  /** Daily Challenge results, null in other modes. */
  daily: { bonus: number; streak: number; modifiers: DailyModifierId[]; date: string } | null;
  /** A revive was spent this run. */
  revived: boolean;
  /** How the run went, for the Run Report panel. */
  report: RunReport | null;
}

export interface RunReport {
  /** What dealt the killing blow ('' if the run didn't end in a crash). */
  killedBy: string;
  /** Score sampled every `interval` seconds, ending with the final score. */
  timeline: number[];
  interval: number;
  /** Run length in seconds. */
  duration: number;
  /** Run time of each boss kill. */
  bossKillTimes: number[];
  kills: number;
  parries: number;
  grazes: number;
  perks: { id: PerkId; level: number }[];
}

/** Score breakdown legend: label, colour and a coaching line for when that source is weakest. */
const SOURCES: { id: ScoreSource; label: () => string; color: string; tip: () => string }[] = [
  {
    id: 'graze',
    label: () => tr('Grazes', 'Sượt'),
    color: '#f472b6',
    tip: () => tr('Skim closer past bullets — grazes are worth more than kills at high combo.', 'Lượn sát đạn hơn — ở combo cao, sượt đáng giá hơn hạ địch.'),
  },
  {
    id: 'combat',
    label: () => tr('Combat', 'Chiến đấu'),
    color: '#22d3ee',
    tip: () => tr('Dash-smash enemies and hunt the gold Elites for big combat points.', 'Lướt húc địch và săn kẻ địch tinh nhuệ màu vàng để ăn điểm lớn.'),
  },
  {
    id: 'shards',
    label: () => tr('Shards', 'Mảnh'),
    color: '#fbbf24',
    tip: () => tr('Sweep up shard trails while your combo is hot — every pickup is multiplied.', 'Gom mảnh khi combo đang cao — mỗi mảnh đều được nhân điểm.'),
  },
  {
    id: 'boss',
    label: () => tr('Bosses', 'Boss'),
    color: '#fb7185',
    tip: () => tr('Boss kills pay out big. Learn each Warden’s weak spot from IRIS’s radio tips.', 'Hạ boss được thưởng lớn. Nghe mẹo của IRIS để biết điểm yếu từng Hộ Vệ.'),
  },
  {
    id: 'survival',
    label: () => tr('Survival', 'Sống sót'),
    color: '#94a3b8',
    tip: () => tr('Staying alive at a high combo ticks up points every second.', 'Sống sót với combo cao sẽ cộng điểm mỗi giây.'),
  },
  {
    id: 'bonus',
    label: () => tr('Bonuses', 'Thưởng'),
    color: '#a78bfa',
    tip: () => tr('Combo milestones (x10, x20, x30) and pickups add bonus points.', 'Mốc combo (x10, x20, x30) và vật phẩm cộng điểm thưởng.'),
  },
];

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
    daily: tr('Daily Challenge', 'Thử Thách Ngày'),
    tutorial: tr('Flight Training', 'Huấn luyện bay'),
  })[mode];

/** Plain-text brag for the share sheet / clipboard. Daily runs name the date and rules so friends can compare. */
const shareText = (stats: GameOverStats, mode: GameMode) => {
  const loc = numLocale();
  const head = stats.daily
    ? `NEON BLITZ · ${modeName(mode)} ${stats.daily.date}`
    : `NEON BLITZ · ${modeName(mode)}`;
  const rules = stats.daily
    ? stats.daily.modifiers.map((id) => localModifier(DAILY_MODIFIERS.find((m) => m.id === id) || DAILY_MODIFIERS[0]).name).join(' + ')
    : '';
  const line = stats.bossRush
    ? tr(
        `${stats.score.toLocaleString(loc)} pts · ${stats.bossRush.cleared}/${stats.bossRush.total} bosses · ${formatRunTime(stats.bossRush.time)}`,
        `${stats.score.toLocaleString(loc)} điểm · ${stats.bossRush.cleared}/${stats.bossRush.total} boss · ${formatRunTime(stats.bossRush.time)}`
      )
    : tr(
        `${stats.score.toLocaleString(loc)} pts · Level ${stats.wave} · x${stats.maxCombo} combo`,
        `${stats.score.toLocaleString(loc)} điểm · Cấp ${stats.wave} · combo x${stats.maxCombo}`
      );
  return [head, rules, line, tr('Can you beat it?', 'Bạn vượt qua được không?')].filter(Boolean).join('\n');
};

/** Native share sheet where there is one, otherwise the clipboard. Resolves to what happened. */
async function shareRun(stats: GameOverStats, mode: GameMode): Promise<'shared' | 'copied' | 'failed'> {
  const text = shareText(stats, mode);
  const url = window.location.href.split('#')[0];
  try {
    if (navigator.share) {
      await navigator.share({ title: 'Neon Blitz', text, url });
      return 'shared';
    }
  } catch (err) {
    // The player closed the sheet: not an error worth a fallback
    if ((err as DOMException)?.name === 'AbortError') return 'failed';
  }
  try {
    await navigator.clipboard.writeText(`${text}\n${url}`);
    return 'copied';
  } catch {
    return 'failed';
  }
}

/** Score-over-time sparkline with a marker at each boss kill. */
const RunGraph: React.FC<{ report: RunReport }> = ({ report }) => {
  const W = 300;
  const H = 64;
  const pts = report.timeline;
  const max = Math.max(1, ...pts);
  const span = Math.max(report.duration, report.interval);
  // Every sample sits on its own time, the last one (final score) at the very end of the run
  const xAt = (i: number) => (i === pts.length - 1 ? W : Math.min(W, ((i * report.interval) / span) * W));
  const yAt = (v: number) => H - 3 - (v / max) * (H - 8);
  const line = pts.map((v, i) => `${i ? 'L' : 'M'}${xAt(i).toFixed(1)},${yAt(v).toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-16" preserveAspectRatio="none" role="img" aria-label={tr('Score over time', 'Điểm theo thời gian')}>
      <defs>
        <linearGradient id="runFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#22d3ee" stopOpacity="0.35" />
          <stop offset="1" stopColor="#22d3ee" stopOpacity="0" />
        </linearGradient>
      </defs>
      {report.bossKillTimes.map((t, i) => {
        const x = Math.min(W, (t / span) * W);
        return <line key={i} x1={x} x2={x} y1={0} y2={H} stroke="#fb7185" strokeWidth="1.5" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />;
      })}
      {pts.length > 1 && <path d={`${line} L${W},${H} L0,${H} Z`} fill="url(#runFill)" />}
      {pts.length > 1 && <path d={line} fill="none" stroke="#67e8f9" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />}
    </svg>
  );
};

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
  [
    'Gold Elites take several hits but always drop Weapon Power or a shield.',
    'Kẻ địch tinh nhuệ màu vàng chịu nhiều đòn nhưng luôn rơi Hỏa Lực hoặc khiên.',
  ],
  [
    'Snipers lock their red sight line just before firing. Slide out of it.',
    'Xạ thủ khóa tia ngắm đỏ ngay trước khi bắn. Trượt ra khỏi tia đó.',
  ],
  [
    'Picking a perk you already own levels it up, up to Lv 3.',
    'Chọn lại perk đã có sẽ nâng cấp nó, tối đa cấp 3.',
  ],
  [
    'Own both halves of a pair (e.g. Holo Echo + Static Aftershock) and an Evolution shows up in the next picker.',
    'Có đủ một cặp perk (vd. Bóng Ảnh Holo + Dư Chấn Tĩnh Điện) thì lần chọn sau sẽ có thẻ Tiến Hóa.',
  ],
  [
    'Kill the green Mender first: while its beams are on, the enemies it links shrug off your bullets.',
    'Hạ Hộ Pháp màu xanh trước: khi tia của nó còn nối, kẻ địch được bảo vệ sẽ miễn nhiễm đạn.',
  ],
  [
    'A Bulwark only blocks shots from below. Dash through it, or let splash and lightning do the work.',
    'Thành Lũy chỉ chặn đạn từ phía dưới. Lướt xuyên qua, hoặc dùng sát thương lan và tia sét.',
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
  const [showReport, setShowReport] = useState(false);
  const [shareState, setShareState] = useState<'idle' | 'shared' | 'copied' | 'failed'>('idle');
  useEffect(() => {
    if (isOpen) setShareState('idle');
  }, [isOpen]);
  if (!isOpen) return null;
  const tip =
    level && stats.reachedBoss
      ? level.intel[(stats.score + stats.nearMisses) % level.intel.length]
      : tr(...TIPS[(stats.score + stats.wave + stats.nearMisses) % TIPS.length]);

  if (level) {
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 backdrop-blur-md anim-fade">
        <div className="glass-panel w-full max-w-sm rounded-3xl p-5 sm:p-6 text-center flex flex-col max-h-[94dvh] custom-scroll *:shrink-0 anim-pop panel-glow-pink">
          <p className="text-[10px] uppercase tracking-[0.3em] font-bold" style={{ color: level.accent }}>
            {level.code} • {level.name}
          </p>
          <h2 className="text-2xl sm:text-3xl font-black text-white font-cyber uppercase neon-glow-pink mt-1">
            {tr('Mission Failed', 'Nhiệm vụ thất bại')}
          </h2>
          <p className="text-xs text-slate-400 mt-1.5 italic">
            {stats.reachedBoss
              ? isActFinale(level.id)
                ? tr(`“${level.bossName} still stands.”`, `“${level.bossName} vẫn còn đứng vững.”`)
                : tr(
                    `“${level.bossName} still holds the ${ACTS[actIndexOf(level.id)].item[0]}.”`,
                    `“${level.bossName} vẫn đang giữ ${ACTS[actIndexOf(level.id)].item[1]}.”`
                  )
              : tr('“Signal lost. Rerouting you to the sector entrance.”', '“Mất tín hiệu. Đang đưa bạn về lối vào khu vực.”')}
          </p>

          <div className="my-4 py-3 px-4 rounded-2xl bg-slate-900/85 border border-slate-800 grid grid-cols-3 gap-y-2">
            <div>
              <span className="block text-[10px] text-slate-500 uppercase tracking-wide">{tr('Score', 'Điểm')}</span>
              <span className="text-sm font-black text-cyan-200 tabular-nums">{shown.toLocaleString(numLocale())}</span>
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
  const totalBy = SOURCES.reduce((sum, src) => sum + (stats.scoreBy[src.id] || 0), 0);
  const ranked = SOURCES.filter((src) => src.id !== 'survival' && src.id !== 'bonus').sort(
    (a, b) => (stats.scoreBy[a.id] || 0) - (stats.scoreBy[b.id] || 0)
  );
  // Coach on the weakest active source instead of a random tip once a run has some substance
  const coach = totalBy > 2000 ? ranked[0] : null;
  const m = stats.mastery;
  const mFloor = m ? MASTERY_XP[m.level] : 0;
  const mNext = m && m.level < MAX_MASTERY ? MASTERY_XP[m.level + 1] : 0;
  const cells = [
    { label: tr('Shards', 'Mảnh'), value: `+${stats.shardsEarned}`, icon: <ShardIcon size={13} />, color: 'text-amber-300' },
    { label: tr('Best combo', 'Combo cao nhất'), value: `x${stats.maxCombo}`, icon: <Flame size={13} />, color: 'text-fuchsia-300' },
    { label: tr('Near-misses', 'Né sát'), value: `${stats.nearMisses}`, icon: <Zap size={13} />, color: 'text-cyan-300' },
    rush
      ? { label: tr('Time', 'Thời gian'), value: formatRunTime(rush.time), icon: <Timer size={13} />, color: 'text-emerald-300' }
      : { label: tr('Level', 'Cấp độ'), value: `${stats.wave}`, icon: <Waves size={13} />, color: 'text-emerald-300' },
    rush
      ? { label: tr('Bosses', 'Boss'), value: `${rush.cleared}/${rush.total}`, icon: <Crown size={13} />, color: 'text-rose-300' }
      : { label: tr('Bosses', 'Boss'), value: `${stats.bossKills}`, icon: <Skull size={13} />, color: 'text-rose-300' },
    {
      label: tr('Best', 'Kỷ lục'),
      value: Math.max(stats.previousBest, stats.score).toLocaleString(numLocale()),
      icon: <Trophy size={13} />,
      color: 'text-slate-200',
    },
  ];

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 backdrop-blur-md anim-fade">
      <div className="glass-panel w-full max-w-sm rounded-3xl p-5 sm:p-6 text-center flex flex-col max-h-[94dvh] custom-scroll *:shrink-0 anim-pop panel-glow-pink">
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
        {stats.report?.killedBy && (
          <p className="text-xs text-slate-400 mt-1">
            {tr('Taken down by', 'Bị hạ bởi')} <span className="font-bold text-rose-300">{stats.report.killedBy}</span>
          </p>
        )}
        {rush && (
          <p className="text-xs text-slate-400 mt-1">
            {stats.reason === 'victory'
              ? rush.start > 0
                ? tr(`Gauntlet finished from boss ${rush.start + 1}!`, `Đã phá đảo từ boss ${rush.start + 1}!`)
                : tr(`All ${rush.total} bosses down. +250 shard bounty!`, `Hạ cả ${rush.total} boss. Thưởng +250 mảnh!`)
              : tr(`Fell at boss ${Math.min(rush.total, rush.cleared + 1)}/${rush.total}`, `Gục ngã ở boss ${Math.min(rush.total, rush.cleared + 1)}/${rush.total}`)}
            {rush.bestTime > 0 && ` • ${tr('Best', 'Kỷ lục')} ${formatRunTime(rush.bestTime)}`}
          </p>
        )}
        {rush && rush.start > 0 && (
          <p className="text-[11px] text-slate-500 mt-0.5">
            {tr(
              `Started at boss ${rush.start + 1}: records and the clear bounty need a full run.`,
              `Bắt đầu từ boss ${rush.start + 1}: kỷ lục và thưởng phá đảo chỉ tính khi chơi từ đầu.`
            )}
          </p>
        )}

        {/* Score block */}
        <div className="my-4 py-4 px-4 rounded-2xl bg-slate-900/85 border border-slate-800">
          <p className="text-[11px] uppercase tracking-widest text-slate-400 font-bold font-cyber">{tr('Score', 'Điểm')}</p>
          <p className="text-5xl font-black text-cyan-200 font-cyber neon-glow-cyan tabular-nums my-1">
            {shown.toLocaleString(numLocale())}
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

        {/* Where the points came from */}
        {totalBy > 0 && (
          <div className="mb-3 text-left">
            <div className="flex h-2.5 rounded-full overflow-hidden bg-slate-800 gap-[2px]">
              {SOURCES.map((src) => {
                const v = stats.scoreBy[src.id] || 0;
                if (v <= 0) return null;
                return (
                  <div
                    key={src.id}
                    title={`${src.label()} ${Math.round((v / totalBy) * 100)}%`}
                    style={{ width: `${(v / totalBy) * 100}%`, backgroundColor: src.color }}
                  />
                );
              })}
            </div>
            <div className="mt-1.5 grid grid-cols-3 gap-x-2 gap-y-0.5">
              {SOURCES.map((src) => (
                <span key={src.id} className="flex items-center gap-1 text-[10px] text-slate-400">
                  <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: src.color }} />
                  {src.label()}
                  <span className="ml-auto tabular-nums text-slate-200 font-bold">
                    {Math.round(((stats.scoreBy[src.id] || 0) / totalBy) * 100)}%
                  </span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Run Report: how the run unfolded */}
        {stats.report && (
          <div className="mb-3 rounded-xl bg-slate-900/80 border border-slate-800 text-left">
            <button
              type="button"
              onClick={() => {
                sound.playSound('click');
                setShowReport((v) => !v);
              }}
              aria-expanded={showReport}
              className="w-full px-3 py-2 flex items-center justify-between text-[11px] font-bold text-slate-200 font-cyber uppercase tracking-wider"
            >
              {tr('Run Report', 'Báo cáo trận đấu')}
              <ChevronDown size={14} className={`text-slate-500 transition-transform ${showReport ? 'rotate-180' : ''}`} />
            </button>
            {showReport && (
              <div className="px-3 pb-3 anim-drop">
                <RunGraph report={stats.report} />
                <div className="flex justify-between text-[9px] text-slate-500 tabular-nums -mt-0.5">
                  <span>0:00</span>
                  {stats.report.bossKillTimes.length > 0 && (
                    <span className="text-rose-300">┆ {tr('boss down', 'hạ boss')}</span>
                  )}
                  <span>{formatRunTime(stats.report.duration)}</span>
                </div>
                <div className="mt-2 grid grid-cols-4 gap-1 text-center">
                  {[
                    { label: tr('Time', 'Thời gian'), value: formatRunTime(stats.report.duration) },
                    { label: tr('Kills', 'Hạ địch'), value: stats.report.kills.toLocaleString(numLocale()) },
                    { label: tr('Grazes', 'Sượt'), value: stats.report.grazes.toLocaleString(numLocale()) },
                    { label: tr('Parries', 'Phản đòn'), value: `${stats.report.parries}` },
                  ].map((c) => (
                    <div key={c.label} className="rounded-lg bg-slate-950/60 py-1">
                      <span className="block text-[9px] text-slate-500 uppercase tracking-wide">{c.label}</span>
                      <span className="text-xs font-black text-slate-100 tabular-nums">{c.value}</span>
                    </div>
                  ))}
                </div>
                {stats.report.perks.length > 0 && (
                  <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                    <span className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">{tr('Perks', 'Nâng cấp')}</span>
                    {stats.report.perks.map(({ id, level }) => {
                      const def = perkDef(id);
                      return (
                        <span
                          key={id}
                          className="flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[10px] font-bold"
                          style={{ color: def.color, borderColor: `${def.color}66`, backgroundColor: `${def.color}14` }}
                        >
                          <PerkIcon id={id} size={11} />
                          {def.name}
                          {level > 1 && <span className="text-amber-300">{level}</span>}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Daily Challenge payout */}
        {stats.daily && (
          <p className="mb-3 flex items-center justify-center gap-1.5 text-xs text-amber-200 font-bold">
            <CalendarDays size={13} />
            {stats.daily.bonus > 0
              ? tr(
                  `Daily bonus +${stats.daily.bonus} shards · ${stats.daily.streak}-day streak`,
                  `Thưởng ngày +${stats.daily.bonus} mảnh · chuỗi ${stats.daily.streak} ngày`
                )
              : tr(`Streak: ${stats.daily.streak} days · bonus already claimed today`, `Chuỗi: ${stats.daily.streak} ngày · hôm nay đã nhận thưởng`)}
          </p>
        )}

        {/* Ship Mastery */}
        {m && (
          <div className="mb-3 px-3 py-2 rounded-xl bg-slate-900/80 border border-slate-800 text-left">
            <div className="flex items-center justify-between text-[11px] font-bold">
              <span className="flex items-center gap-1" style={{ color: m.color }}>
                <Star size={12} fill="currentColor" /> {m.shipName} · {tr('Mastery', 'Thông thạo')} {m.level}
                {m.level > m.prevLevel && (
                  <span className="ml-1 px-1.5 rounded bg-amber-300 text-slate-950 text-[9px] font-black">{tr('LEVEL UP', 'LÊN CẤP')}</span>
                )}
              </span>
              <span className="text-slate-300 tabular-nums">+{m.gained} XP</span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${mNext ? Math.min(100, ((m.total - mFloor) / (mNext - mFloor)) * 100) : 100}%`,
                  backgroundColor: m.color,
                }}
              />
            </div>
            <p className="mt-1 text-[10px] text-slate-400">
              {mNext
                ? `${tr('Next', 'Tiếp theo')}: ${masteryRewardLabel(MASTERY_REWARDS[m.level], m.level)} · ${(mNext - m.total).toLocaleString(numLocale())} XP`
                : tr('Fully mastered!', 'Đã thông thạo tối đa!')}
            </p>
          </div>
        )}

        <p className="text-xs text-slate-400 mb-4 leading-snug">
          <span className="text-cyan-300 font-bold">{tr('TIP:', 'MẸO:')}</span> {coach ? coach.tip() : tip}
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
          <div className="grid grid-cols-3 gap-2">
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
                shareRun(stats, gameMode).then(setShareState);
              }}
              className="py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-cyan-200 font-bold text-xs flex items-center justify-center gap-1.5 btn-cyber font-cyber"
            >
              {shareState === 'copied' ? (
                <>
                  <Check size={14} /> {tr('Copied', 'Đã chép')}
                </>
              ) : (
                <>
                  <Share2 size={14} /> {tr('Share', 'Chia sẻ')}
                </>
              )}
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
