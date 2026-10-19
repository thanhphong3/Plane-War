import React from 'react';
import { ChevronRight, KeyRound, Lock, Skull, Star, X } from 'lucide-react';
import { LEVELS } from '../game/campaign';
import { SaveData } from '../types/game';
import { sound } from '../utils/audio';

interface CampaignMapProps {
  isOpen: boolean;
  saveData: SaveData;
  onClose: () => void;
  onSelectLevel: (index: number) => void;
}

export const Stars: React.FC<{ count: number; size?: number }> = ({ count, size = 12 }) => (
  <span className="flex items-center gap-0.5">
    {[0, 1, 2].map((i) => (
      <Star
        key={i}
        size={size}
        className={i < count ? 'text-amber-300 drop-shadow-[0_0_4px_rgba(251,191,36,0.7)]' : 'text-slate-700'}
        fill={i < count ? 'currentColor' : 'none'}
      />
    ))}
  </span>
);

export const CampaignMap: React.FC<CampaignMapProps> = ({ isOpen, saveData, onClose, onSelectLevel }) => {
  if (!isOpen) return null;
  const keys = LEVELS.slice(0, 5).filter((l) => (saveData.campaignStars[l.id] || 0) > 0).length;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-md anim-fade">
      <div className="glass-panel w-full max-w-md rounded-3xl p-4 sm:p-6 flex flex-col max-h-[94vh] anim-pop panel-glow-pink">
        <div className="flex items-start justify-between pb-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-rose-300 font-bold font-cyber">Campaign</p>
            <h2 className="text-2xl font-black text-white font-cyber tracking-wide leading-none mt-0.5">GRIDFALL</h2>
            <p className="text-xs text-slate-400 mt-1">Recover the Root Keys. Reach the Core. Reboot NULL.</p>
          </div>
          <button
            type="button"
            onClick={() => {
              sound.playSound('click');
              onClose();
            }}
            aria-label="Close"
            className="w-8 h-8 shrink-0 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center btn-cyber border border-slate-700"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex items-center gap-2 mb-2 text-[11px] font-bold text-amber-200">
          <KeyRound size={13} className="text-amber-300" />
          Root Keys
          <span className="flex gap-1 ml-1">
            {[0, 1, 2, 3, 4].map((i) => (
              <span
                key={i}
                className={`w-3.5 h-1.5 rounded-full ${i < keys ? 'bg-amber-300 shadow shadow-amber-400/60' : 'bg-slate-700'}`}
              />
            ))}
          </span>
        </div>

        <div className="custom-scroll flex-1 py-1 pr-1">
          <ol className="relative space-y-2.5">
            {LEVELS.map((lvl, i) => {
              const locked = i > saveData.campaignUnlocked;
              const stars = saveData.campaignStars[lvl.id] || 0;
              const current = !locked && stars === 0;
              return (
                <li key={lvl.id} className="relative">
                  {i < LEVELS.length - 1 && (
                    <span
                      className="absolute left-[22px] top-12 w-[2px] h-[calc(100%-1.5rem)]"
                      style={{ background: locked ? '#1e293b' : `linear-gradient(${lvl.accent}, ${LEVELS[i + 1].accent})` }}
                    />
                  )}
                  <button
                    type="button"
                    disabled={locked}
                    onClick={() => {
                      sound.playSound('click');
                      onSelectLevel(i);
                    }}
                    className={`relative w-full flex items-center gap-3 p-2.5 rounded-2xl border text-left btn-cyber ${
                      locked
                        ? 'border-slate-800 bg-slate-900/40 opacity-55 cursor-not-allowed'
                        : current
                        ? 'bg-slate-900/90 shadow-lg'
                        : 'border-slate-700/80 bg-slate-900/70 hover:border-slate-500'
                    }`}
                    style={current ? { borderColor: lvl.accent, boxShadow: `0 0 22px ${lvl.accent}33` } : undefined}
                  >
                    <span
                      className="relative z-10 w-11 h-11 shrink-0 rounded-xl flex items-center justify-center font-black font-cyber text-sm border"
                      style={
                        locked
                          ? { borderColor: '#334155', color: '#64748b', background: '#0f172a' }
                          : { borderColor: lvl.accent, color: lvl.accent, background: `${lvl.accent}1f` }
                      }
                    >
                      {locked ? <Lock size={16} /> : String(i + 1).padStart(2, '0')}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-bold tracking-[0.2em] text-slate-500 font-cyber">{lvl.code}</p>
                      <p className="text-sm font-black text-white leading-tight truncate">{lvl.name}</p>
                      <p className="text-[11px] text-slate-400 flex items-center gap-1 truncate">
                        <Skull size={10} className="shrink-0" />
                        {locked ? 'Unknown signal' : lvl.bossName}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Stars count={stars} />
                      {!locked && (
                        <span className="flex items-center text-[10px] font-bold" style={{ color: lvl.accent }}>
                          {current ? 'Start' : 'Replay'} <ChevronRight size={12} />
                        </span>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>

        <p className="text-[10px] text-slate-500 text-center mt-3 leading-snug">
          ★ Clear the sector &nbsp;★ Take no hits &nbsp;★ Beat the boss under par time
        </p>
      </div>
    </div>
  );
};
