import React from 'react';
import { Check, X } from 'lucide-react';
import { SaveData } from '../types/game';
import { tr } from '../i18n';
import { localAchievement } from '../i18n/content';
import { ACHIEVEMENTS } from '../utils/constants';
import { sound } from '../utils/audio';
import { Icon, ShardIcon } from './Icon';
import { useEscape } from '../hooks/useEscape';

interface AchievementsModalProps {
  isOpen: boolean;
  onClose: () => void;
  saveData: SaveData;
  onClaimAchievement: (achievementId: string, reward: number) => void;
}

export const AchievementsModal: React.FC<AchievementsModalProps> = ({
  isOpen,
  onClose,
  saveData,
  onClaimAchievement,
}) => {
  useEscape(isOpen, onClose);
  if (!isOpen) return null;

  const claimed = ACHIEVEMENTS.filter((a) => saveData.unlockedAchievements.includes(a.id)).length;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-md anim-fade">
      <div className="glass-panel w-full max-w-md rounded-3xl p-4 sm:p-6 flex flex-col max-h-[92dvh] anim-pop panel-glow-amber">
        {/* Header */}
        <div className="flex items-center justify-between pb-3">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-white font-cyber tracking-wide">{tr('ACHIEVEMENTS', 'THÀNH TỰU')}</h2>
            <p className="text-xs text-slate-400">
              {tr('Complete challenges to earn bonus shards', 'Hoàn thành thử thách để nhận thêm mảnh')}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={tr('Close', 'Đóng')}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center btn-cyber border border-slate-700"
          >
            <X size={16} />
          </button>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-3 mb-1">
          <div className="flex-1 h-2 rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-300 to-amber-500"
              style={{ width: `${(claimed / ACHIEVEMENTS.length) * 100}%` }}
            />
          </div>
          <span className="text-xs font-bold text-amber-200 tabular-nums">
            {claimed}/{ACHIEVEMENTS.length}
          </span>
        </div>

        <div className="custom-scroll flex-1 py-3 space-y-2.5 pr-1">
          {ACHIEVEMENTS.map(localAchievement).map((ach) => {
            const isUnlocked = saveData.unlockedAchievements.includes(ach.id);
            const isEligible = isUnlocked || ach.isEligible(saveData);

            return (
              <div
                key={ach.id}
                className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                  isUnlocked
                    ? 'bg-amber-950/20 border-amber-500/40'
                    : isEligible
                    ? 'bg-cyan-950/40 border-cyan-400 shadow-md shadow-cyan-500/20'
                    : 'bg-slate-900/60 border-slate-800/80 opacity-70'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 border ${
                      isUnlocked
                        ? 'bg-amber-400/20 border-amber-400/50 text-amber-300'
                        : isEligible
                        ? 'bg-cyan-400/20 border-cyan-400/50 text-cyan-300 animate-pulse'
                        : 'bg-slate-800 border-slate-700 text-slate-500'
                    }`}
                  >
                    <Icon name={ach.icon} size={20} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-black text-white">{ach.title}</p>
                    <p className="text-xs text-slate-400 leading-snug">{ach.desc}</p>
                  </div>
                </div>

                <div className="shrink-0">
                  {isUnlocked ? (
                    <span className="px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 font-bold text-xs flex items-center gap-1">
                      <Check size={13} /> {tr('Claimed', 'Đã nhận')}
                    </span>
                  ) : isEligible ? (
                    <button
                      type="button"
                      onClick={() => {
                        sound.playSound('powerup');
                        onClaimAchievement(ach.id, ach.rewardShards);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-300 to-amber-500 text-slate-950 font-black text-xs btn-cyber shadow-lg shadow-amber-500/30 flex items-center gap-1 claim-bounce"
                    >
                      {tr('Claim', 'Nhận')} <ShardIcon size={12} className="!text-slate-900 !drop-shadow-none" /> {ach.rewardShards}
                    </button>
                  ) : (
                    <span className="px-2.5 py-1 rounded-xl bg-slate-800 text-slate-400 font-semibold text-xs border border-slate-700 flex items-center gap-1">
                      <ShardIcon size={12} /> {ach.rewardShards}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-1 w-full py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs uppercase font-cyber btn-cyber border border-slate-700"
        >
          {tr('Close', 'Đóng')}
        </button>
      </div>
    </div>
  );
};
