import React from 'react';
import { GameMode, QuestDef } from '../types/game';

interface HUDProps {
  score: number;
  combo: number;
  shards: number;
  waveLevel: number;
  gameMode: GameMode;
  timedRemaining: number;
  feverEnergy: number;
  isFeverActive: boolean;
  shieldCount: number;
  magnetTimer: number;
  slowFieldTimer: number;
  empBombs: number;
  dashCooldown: number;
  dashMaxCooldown: number;
  currentQuest: QuestDef;
  questProgress: number;
  centerBannerText: string;
  isBannerVisible: boolean;
  bannerColorClass: string;
  isMuted: boolean;
  isBgmMuted: boolean;
  onToggleMute: () => void;
  onToggleBgm: () => void;
  onPause: () => void;
  onTriggerDash: () => void;
  onTriggerEmp: () => void;
}

export const HUD: React.FC<HUDProps> = ({
  score,
  combo,
  shards,
  waveLevel,
  gameMode,
  timedRemaining,
  feverEnergy,
  isFeverActive,
  shieldCount,
  magnetTimer,
  slowFieldTimer,
  empBombs,
  dashCooldown,
  dashMaxCooldown,
  currentQuest,
  questProgress,
  centerBannerText,
  isBannerVisible,
  bannerColorClass,
  isMuted,
  isBgmMuted,
  onToggleMute,
  onToggleBgm,
  onPause,
  onTriggerDash,
  onTriggerEmp,
}) => {
  const dashCdRatio = dashCooldown > 0 && dashMaxCooldown > 0 ? (dashCooldown / dashMaxCooldown) * 100 : 0;
  const questClamped = Math.min(currentQuest.target, questProgress);

  return (
    <div className="fixed inset-0 pointer-events-none flex flex-col justify-between p-3 sm:p-5 z-20 select-none">
      {/* Top Bar */}
      <div className="flex items-start justify-between gap-2 w-full max-w-xl mx-auto pointer-events-none">
        {/* Score & Multiplier */}
        <div className="flex flex-col">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-black tracking-tight text-white font-cyber neon-glow-cyan tabular-nums">
              {Math.floor(score).toLocaleString('vi-VN')}
            </span>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs sm:text-sm font-black font-cyber transition-transform duration-150 ${
                combo > 5
                  ? 'bg-amber-500/25 border border-amber-400 text-amber-300 animate-pulse'
                  : 'bg-fuchsia-500/25 border border-fuchsia-400/60 text-fuchsia-300'
              }`}
            >
              x{combo}
            </span>
          </div>

          <div className="flex items-center gap-3 mt-0.5 text-xs font-semibold text-slate-300">
            <span className="flex items-center gap-1 text-amber-300 font-mono">
              <span>💎</span>
              <span className="tabular-nums font-bold">{shards.toLocaleString('vi-VN')}</span>
            </span>

            {gameMode === 'timed' && (
              <span className="flex items-center gap-1 text-rose-300 font-mono">
                <span>⏱️</span>
                <span className="tabular-nums font-black">{timedRemaining.toFixed(1)}s</span>
              </span>
            )}

            <span className="text-slate-400 font-cyber">Cấp {waveLevel}</span>
          </div>
        </div>

        {/* Center: Overdrive / Fever Energy Bar */}
        <div className="flex-1 max-w-[150px] sm:max-w-[210px] mx-2 mt-1">
          <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider mb-1 font-cyber">
            <span className={isFeverActive ? 'text-amber-300 animate-pulse' : 'text-cyan-300'}>
              {isFeverActive ? '🔥 CUỒNG NỘ' : 'Năng Lượng'}
            </span>
            <span className="text-cyan-200 tabular-nums">
              {isFeverActive ? 'BẤT TỬ!' : `${Math.round(feverEnergy)}%`}
            </span>
          </div>
          <div className="w-full h-2.5 bg-slate-900/90 rounded-full overflow-hidden border border-slate-700/80 p-0.5 shadow-inner">
            <div
              className={`h-full rounded-full transition-all duration-100 ${
                isFeverActive
                  ? 'bg-gradient-to-r from-amber-400 via-rose-500 to-amber-300 animate-pulse'
                  : 'bg-gradient-to-r from-cyan-400 via-fuchsia-500 to-amber-400'
              }`}
              style={{ width: `${Math.min(100, Math.max(0, feverEnergy))}%` }}
            />
          </div>

          {/* Active Buffs */}
          <div className="flex items-center gap-1.5 mt-1.5 min-h-[20px] flex-wrap">
            {shieldCount > 0 && (
              <span className="px-1.5 py-0.5 rounded bg-sky-500/25 border border-sky-400/50 text-[10px] font-bold text-sky-200">
                🛡️ x{shieldCount}
              </span>
            )}
            {magnetTimer > 0 && (
              <span className="px-1.5 py-0.5 rounded bg-purple-500/25 border border-purple-400/50 text-[10px] font-bold text-purple-200">
                🧲 {magnetTimer.toFixed(0)}s
              </span>
            )}
            {slowFieldTimer > 0 && (
              <span className="px-1.5 py-0.5 rounded bg-emerald-500/25 border border-emerald-400/50 text-[10px] font-bold text-emerald-200">
                ⏳ {slowFieldTimer.toFixed(0)}s
              </span>
            )}
          </div>
        </div>

        {/* Right Controls: Audio & Pause */}
        <div className="flex items-center gap-1.5 pointer-events-auto">
          <button
            type="button"
            onClick={onToggleBgm}
            aria-label="Nhạc nền"
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl glass-panel flex items-center justify-center text-sm btn-cyber text-slate-200 hover:text-white"
          >
            {isBgmMuted ? '🎵❌' : '🎵'}
          </button>
          <button
            type="button"
            onClick={onToggleMute}
            aria-label="Bật/Tắt Âm Thanh"
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl glass-panel flex items-center justify-center text-sm sm:text-base btn-cyber text-slate-200 hover:text-white"
          >
            {isMuted ? '🔇' : '🔊'}
          </button>
          <button
            type="button"
            onClick={onPause}
            aria-label="Tạm Dừng"
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl glass-panel flex items-center justify-center text-sm sm:text-base font-bold btn-cyber text-slate-200 hover:text-white"
          >
            ⏸
          </button>
        </div>
      </div>

      {/* Floating Center Notification */}
      <div className="flex flex-col items-center justify-center pointer-events-none my-auto">
        <div
          className={`transition-all duration-300 transform text-center px-4 py-2 rounded-full bg-slate-950/80 border border-white/20 backdrop-blur-md shadow-2xl ${
            isBannerVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-90'
          }`}
        >
          <p className={`text-sm sm:text-base font-black tracking-widest uppercase font-cyber ${bannerColorClass}`}>
            {centerBannerText}
          </p>
        </div>
      </div>

      {/* Bottom Area: Left Quick Quest + Right Thumb Action Buttons */}
      <div className="w-full max-w-xl mx-auto flex items-end justify-between pointer-events-none pb-1 sm:pb-2">
        {/* Left Quest tracker */}
        <div className="glass-panel px-3 py-2 rounded-2xl border border-slate-700/60 max-w-[200px] sm:max-w-xs pointer-events-none shadow-lg">
          <p className="text-[10px] uppercase tracking-wider text-cyan-400 font-bold font-cyber">Nhiệm Vụ Hiện Tại</p>
          <p className="text-xs font-semibold text-slate-200 truncate mt-0.5">
            {currentQuest.label} ({questClamped}/{currentQuest.target})
          </p>
          <span className="text-[10px] font-bold text-amber-300">Thưởng +{currentQuest.reward} 💎</span>
        </div>

        {/* Right Mobile Thumb Action Buttons */}
        <div className="flex items-center gap-2.5 pointer-events-auto">
          {/* EMP Bomb */}
          <button
            type="button"
            onClick={onTriggerEmp}
            disabled={empBombs <= 0}
            className={`relative w-14 h-14 sm:w-16 sm:h-16 rounded-2xl border-2 flex flex-col items-center justify-center btn-cyber shadow-lg ${
              empBombs > 0
                ? 'bg-gradient-to-br from-amber-500/30 to-rose-600/40 border-amber-400/80 shadow-amber-500/20'
                : 'bg-slate-900/80 border-slate-700 opacity-40 cursor-not-allowed'
            }`}
          >
            <span className="text-xl sm:text-2xl leading-none">💥</span>
            <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-tighter text-amber-200 mt-0.5 font-cyber">
              BÃO TỪ
            </span>
            <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center shadow-md">
              {empBombs}
            </span>
          </button>

          {/* Hyper Dash */}
          <button
            type="button"
            onClick={onTriggerDash}
            disabled={dashCooldown > 0}
            className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-cyan-500/40 to-fuchsia-600/40 border-2 border-cyan-300 flex flex-col items-center justify-center btn-cyber shadow-lg shadow-cyan-500/30 overflow-hidden"
          >
            {/* Cooldown shading */}
            <div
              className="absolute bottom-0 left-0 right-0 bg-slate-950/85 transition-all duration-75"
              style={{ height: `${dashCdRatio}%` }}
            />
            <span className="relative z-10 text-2xl sm:text-3xl leading-none">⚡</span>
            <span className="relative z-10 text-[10px] sm:text-[11px] font-black uppercase tracking-tight text-cyan-100 mt-0.5 font-cyber">
              LƯỚT PHÁ
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
