import React from 'react';
import { Check, ChevronRight, Map as MapIcon, RotateCcw, X } from 'lucide-react';
import { LEVELS } from '../game/campaign';
import { tr } from '../i18n';
import { localLevel } from '../i18n/content';
import { sound } from '../utils/audio';
import { Stars } from './CampaignMap';
import { ShardIcon } from './Icon';

export interface LevelClearStats {
  levelId: number;
  stars: number;
  prevStars: number;
  score: number;
  shardsEarned: number;
  reward: number;
  firstClear: boolean;
  hitsTaken: number;
  bossTime: number;
  parTime: number;
  /** Started at the Warden via "Retry Boss": the no-hit star needs a full run. */
  skippedStage: boolean;
}

interface LevelClearModalProps {
  isOpen: boolean;
  stats: LevelClearStats | null;
  onNext: () => void;
  onReplay: () => void;
  onMap: () => void;
}

const Criterion: React.FC<{ ok: boolean; label: string; detail: string }> = ({ ok, label, detail }) => (
  <li className="flex items-center gap-2 text-xs">
    <span
      className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
        ok ? 'bg-amber-400 text-slate-950' : 'bg-slate-800 text-slate-500'
      }`}
    >
      {ok ? <Check size={12} strokeWidth={3} /> : <X size={12} />}
    </span>
    <span className={ok ? 'text-slate-100 font-semibold' : 'text-slate-400'}>{label}</span>
    <span className="ml-auto text-slate-400 tabular-nums">{detail}</span>
  </li>
);

export const LevelClearModal: React.FC<LevelClearModalProps> = ({ isOpen, stats, onNext, onReplay, onMap }) => {
  if (!isOpen || !stats) return null;
  const level = localLevel(LEVELS[stats.levelId]);
  const isFinal = stats.levelId === LEVELS.length - 1;
  const newBest = stats.stars > stats.prevStars && stats.prevStars > 0;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 backdrop-blur-md anim-fade">
      <div className="glass-panel w-full max-w-sm rounded-3xl p-5 sm:p-6 text-center flex flex-col anim-pop panel-glow-amber">
        <p className="text-[10px] uppercase tracking-[0.3em] font-bold" style={{ color: level.accent }}>
          {level.code} • {level.name}
        </p>
        <h2 className="text-2xl sm:text-3xl font-black text-white font-cyber uppercase neon-glow-amber mt-1">
          {isFinal ? tr('Campaign Complete', 'Hoàn thành chiến dịch') : tr('Sector Cleared', 'Đã giải phóng khu vực')}
        </h2>

        <div className="flex justify-center my-3 claim-bounce">
          <Stars count={stats.stars} size={34} />
        </div>
        {newBest && <p className="text-[11px] font-black text-amber-300 font-cyber -mt-1 mb-1">{tr('NEW BEST RATING!', 'ĐÁNH GIÁ CAO NHẤT MỚI!')}</p>}

        <ul className="text-left space-y-1.5 bg-slate-900/80 border border-slate-800 rounded-2xl p-3">
          <Criterion ok label={tr(`Defeat ${level.bossName}`, `Đánh bại ${level.bossName}`)} detail={tr('Done', 'Xong')} />
          <Criterion
            ok={stats.hitsTaken === 0 && !stats.skippedStage}
            label={
              stats.skippedStage
                ? tr('Take no hits (full run only)', 'Không trúng đòn (chỉ khi chơi trọn lượt)')
                : tr('Take no hits', 'Không trúng đòn')
            }
            detail={
              stats.skippedStage
                ? tr('Boss retry', 'Đánh lại boss')
                : tr(`${stats.hitsTaken} hit${stats.hitsTaken === 1 ? '' : 's'}`, `${stats.hitsTaken} lần trúng`)
            }
          />
          <Criterion
            ok={stats.bossTime <= stats.parTime}
            label={tr(`Boss under ${stats.parTime}s`, `Hạ boss dưới ${stats.parTime}s`)}
            detail={`${stats.bossTime.toFixed(1)}s`}
          />
        </ul>

        <div className="grid grid-cols-2 gap-2 mt-3">
          <div className="rounded-2xl bg-slate-900/80 border border-slate-800 py-2">
            <span className="block text-[10px] text-slate-500 uppercase tracking-wide">{tr('Score', 'Điểm')}</span>
            <span className="text-base font-black text-cyan-200 tabular-nums">{stats.score.toLocaleString('en-US')}</span>
          </div>
          <div className="rounded-2xl bg-slate-900/80 border border-slate-800 py-2">
            <span className="block text-[10px] text-slate-500 uppercase tracking-wide">{tr('Shards', 'Mảnh')}</span>
            <span className="inline-flex items-center gap-1 text-base font-black text-amber-300 tabular-nums">
              <ShardIcon size={13} />+{stats.shardsEarned + stats.reward}
            </span>
            <span className="block text-[9px] text-amber-200/70">
              {stats.firstClear
                ? tr('incl. first clear bonus', 'gồm thưởng lần đầu')
                : tr('incl. replay bonus', 'gồm thưởng chơi lại')}{' '}
              +{stats.reward}
            </span>
          </div>
        </div>

        <div className="space-y-2 mt-4">
          {!isFinal && (
            <button
              type="button"
              onClick={() => {
                sound.playSound('click');
                onNext();
              }}
              className="w-full py-3.5 rounded-2xl btn-primary text-slate-950 font-black text-base uppercase font-cyber tracking-wider btn-cyber animate-glow flex items-center justify-center gap-2"
            >
              {tr('Next Sector', 'Khu vực tiếp')} <ChevronRight size={18} />
            </button>
          )}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                sound.playSound('click');
                onReplay();
              }}
              className="py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-100 font-bold text-xs flex items-center justify-center gap-1.5 btn-cyber font-cyber"
            >
              <RotateCcw size={14} /> {tr('Replay', 'Chơi lại')}
            </button>
            <button
              type="button"
              onClick={() => {
                sound.playSound('click');
                onMap();
              }}
              className={`py-2.5 rounded-xl border font-bold text-xs flex items-center justify-center gap-1.5 btn-cyber font-cyber ${
                isFinal
                  ? 'btn-primary text-slate-950 border-transparent'
                  : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-300'
              }`}
            >
              <MapIcon size={14} /> {tr('Sector Map', 'Bản đồ')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
