import React from 'react';
import { SaveData } from '../types/game';
import { ACHIEVEMENTS } from '../utils/constants';
import { sound } from '../utils/audio';

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
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="glass-panel w-full max-w-md rounded-3xl p-4 sm:p-6 flex flex-col max-h-[90vh] border border-amber-400/30 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-white font-cyber flex items-center gap-2">
              <span className="text-amber-400">🏆</span> THÀNH TỰU & HUY CHƯƠNG
            </h2>
            <p className="text-xs text-slate-400">Hoàn thành thử thách để nhận thưởng Tinh Thể quý giá</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-sm flex items-center justify-center btn-cyber border border-slate-700"
          >
            ✕
          </button>
        </div>

        {/* List */}
        <div className="custom-scroll flex-1 py-3 space-y-2.5 pr-1">
          {ACHIEVEMENTS.map((ach) => {
            const isUnlocked = saveData.unlockedAchievements.includes(ach.id);

            // Criteria check
            let isEligible = isUnlocked;
            if (!isUnlocked) {
              if (ach.id === 'first_blood' && saveData.totalRuns >= 1) isEligible = true;
              if (ach.id === 'graze_master' && saveData.totalNearMisses >= 20) isEligible = true;
              if (ach.id === 'combo_king' && saveData.bestCombo >= 15) isEligible = true;
              if (ach.id === 'shard_collector' && saveData.shards >= 1000) isEligible = true;
              if (ach.id === 'score_legend' && Math.max(saveData.bestEndless, saveData.bestTimed, saveData.bestHardcore) >= 10000) {
                isEligible = true;
              }
            }

            return (
              <div
                key={ach.id}
                className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                  isUnlocked
                    ? 'bg-amber-950/20 border-amber-500/40 text-slate-200'
                    : isEligible
                    ? 'bg-cyan-950/40 border-cyan-400 shadow-md shadow-cyan-500/20'
                    : 'bg-slate-900/60 border-slate-800/80 opacity-65'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-11 h-11 rounded-2xl flex items-center justify-center text-xl shrink-0 border ${
                      isUnlocked
                        ? 'bg-amber-400/20 border-amber-400/50 text-amber-300'
                        : isEligible
                        ? 'bg-cyan-400/20 border-cyan-400/50 text-cyan-300 animate-pulse'
                        : 'bg-slate-800 border-slate-700 text-slate-500'
                    }`}
                  >
                    {ach.icon}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-black text-white">{ach.title}</p>
                    <p className="text-xs text-slate-400 leading-snug">{ach.desc}</p>
                  </div>
                </div>

                <div className="shrink-0">
                  {isUnlocked ? (
                    <span className="px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 font-bold text-xs flex items-center gap-1">
                      <span>✓</span> Đã Nhận
                    </span>
                  ) : isEligible ? (
                    <button
                      type="button"
                      onClick={() => {
                        sound.playSound('powerup');
                        onClaimAchievement(ach.id, ach.rewardShards);
                      }}
                      className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black text-xs btn-cyber shadow-lg shadow-amber-500/30 animate-bounce"
                    >
                      Nhận 💎 {ach.rewardShards}
                    </button>
                  ) : (
                    <span className="px-2.5 py-1 rounded-xl bg-slate-800 text-slate-500 font-semibold text-xs border border-slate-700">
                      💎 {ach.rewardShards}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <button
          type="button"
          onClick={onClose}
          className="mt-2 w-full py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs uppercase font-cyber btn-cyber border border-slate-700"
        >
          Đóng
        </button>
      </div>
    </div>
  );
};
