import React from 'react';
import { Bomb, ChevronsUp, Hourglass, Magnet, Music, Pause, Radio, Shield, Skull, Target, Timer, Volume2, VolumeX, Zap } from 'lucide-react';
import { LevelDef, SPEAKERS, SpeakerId } from '../game/campaign';
import { GameMode, QuestDef } from '../types/game';
import { MAX_WEAPON_LEVEL } from '../utils/constants';
import { ShardIcon } from './Icon';

export interface CommMessage {
  id: number;
  who: SpeakerId;
  text: string;
}

interface HUDProps {
  score: number;
  combo: number;
  comboTimer: number;
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
  /** Auto-blaster Weapon Power, 1..MAX_WEAPON_LEVEL. */
  weaponLevel: number;
  dashCooldown: number;
  dashMaxCooldown: number;
  bossHp: number;
  bossName: string;
  bossStatus: string;
  /** 0..1 while flying through a campaign sector, -1 otherwise. */
  stageProgress: number;
  level: LevelDef | null;
  comm: CommMessage | null;
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

const IconButton: React.FC<{ onClick: () => void; label: string; children: React.ReactNode }> = ({
  onClick,
  label,
  children,
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={label}
    title={label}
    className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl glass-panel flex items-center justify-center btn-cyber text-slate-200 hover:text-white"
  >
    {children}
  </button>
);

export const HUD: React.FC<HUDProps> = ({
  score,
  combo,
  comboTimer,
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
  weaponLevel,
  dashCooldown,
  dashMaxCooldown,
  bossHp,
  bossName,
  bossStatus,
  stageProgress,
  level,
  comm,
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
  const dashReady = dashCooldown <= 0;
  const dashProgress = dashMaxCooldown > 0 ? 1 - dashCooldown / dashMaxCooldown : 1;
  const questClamped = Math.min(currentQuest.target, questProgress);
  const hotCombo = combo >= 10;
  const timeLow = gameMode === 'timed' && timedRemaining < 10;

  // SVG ring for the dash cooldown
  const ringR = 36;
  const ringC = 2 * Math.PI * ringR;

  return (
    <div className="fixed inset-0 pointer-events-none flex flex-col justify-between p-3 sm:p-5 z-20 select-none safe-area">
      {/* Top Bar */}
      <div className="w-full max-w-xl mx-auto">
        <div className="flex items-start justify-between gap-2">
          {/* Score & Combo */}
          <div className="flex flex-col min-w-0">
            <span className="text-3xl sm:text-4xl font-black tracking-tight text-white font-cyber neon-glow-cyan tabular-nums leading-none">
              {Math.floor(score).toLocaleString('en-US')}
            </span>
            <div className="flex items-center gap-2 mt-1.5">
              <div className="flex flex-col">
                <span
                  className={`px-2 py-0.5 rounded-md text-xs sm:text-sm font-black font-cyber leading-none ${
                    hotCombo
                      ? 'bg-amber-400/25 border border-amber-300 text-amber-200 combo-hot'
                      : combo >= 5
                      ? 'bg-fuchsia-500/25 border border-fuchsia-400/70 text-fuchsia-200'
                      : 'bg-slate-800/80 border border-slate-600 text-slate-300'
                  }`}
                >
                  x{combo}
                </span>
                <div className="h-[3px] mt-0.5 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full ${hotCombo ? 'bg-amber-300' : 'bg-fuchsia-400'}`}
                    style={{ width: `${Math.max(0, Math.min(1, comboTimer)) * 100}%` }}
                  />
                </div>
              </div>
              <span className="flex items-center gap-1 text-amber-300 text-xs font-bold tabular-nums">
                <ShardIcon size={12} />
                {shards.toLocaleString('en-US')}
              </span>
              <span className="text-slate-400 text-[11px] font-bold font-cyber tracking-wider">
                {level ? level.code : `LV ${waveLevel}`}
              </span>
              {gameMode === 'timed' && (
                <span
                  className={`flex items-center gap-1 text-[11px] font-bold font-cyber tabular-nums ${
                    timeLow ? 'text-rose-400 animate-pulse' : 'text-rose-200'
                  }`}
                >
                  <Timer size={12} />
                  {timedRemaining.toFixed(1)}s
                </span>
              )}
            </div>
          </div>

          {/* Audio & Pause */}
          <div className="flex items-center gap-1.5 pointer-events-auto">
            <IconButton onClick={onToggleBgm} label={isBgmMuted ? 'Music on' : 'Music off'}>
              <span className={`relative ${isBgmMuted ? 'opacity-40' : ''}`}>
                <Music size={16} />
                {isBgmMuted && <span className="absolute left-1/2 top-1/2 w-5 h-[2px] bg-rose-400 -translate-x-1/2 -translate-y-1/2 rotate-45" />}
              </span>
            </IconButton>
            <IconButton onClick={onToggleMute} label={isMuted ? 'Sound on' : 'Sound off'}>
              {isMuted ? <VolumeX size={16} className="text-rose-300" /> : <Volume2 size={16} />}
            </IconButton>
            <IconButton onClick={onPause} label="Pause">
              <Pause size={16} />
            </IconButton>
          </div>
        </div>

        {/* Overdrive Energy */}
        <div className="flex items-center gap-2 mt-2.5">
          <span
            className={`w-[74px] shrink-0 text-[10px] font-bold uppercase tracking-wider font-cyber ${
              isFeverActive ? 'text-amber-300 animate-pulse' : 'text-cyan-300'
            }`}
          >
            {isFeverActive ? 'Overdrive' : 'Energy'}
          </span>
          <div className="flex-1 h-3 bg-slate-950/90 rounded-full overflow-hidden border border-slate-700/80 p-[2px]">
            <div
              className={`h-full rounded-full transition-[width] duration-100 ${
                isFeverActive ? 'bar-fever' : 'bg-gradient-to-r from-cyan-400 via-fuchsia-500 to-amber-400'
              }`}
              style={{ width: `${Math.min(100, Math.max(0, feverEnergy))}%` }}
            />
          </div>
          <span
            className={`w-9 shrink-0 text-right text-[10px] font-bold font-cyber tabular-nums ${
              isFeverActive ? 'text-amber-200' : 'text-cyan-200'
            }`}
          >
            {Math.round(feverEnergy)}%
          </span>
        </div>

        {/* Active Buffs */}
        {(weaponLevel > 1 || shieldCount > 0 || magnetTimer > 0 || slowFieldTimer > 0) && (
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            {weaponLevel > 1 && (
              <span className="buff-chip bg-orange-500/20 border-orange-400/50 text-orange-200">
                <ChevronsUp size={11} /> {weaponLevel >= MAX_WEAPON_LEVEL ? 'MAX' : `LV ${weaponLevel}`}
              </span>
            )}
            {shieldCount > 0 && (
              <span className="buff-chip bg-sky-500/20 border-sky-400/50 text-sky-200">
                <Shield size={11} /> x{shieldCount}
              </span>
            )}
            {magnetTimer > 0 && (
              <span className="buff-chip bg-purple-500/20 border-purple-400/50 text-purple-200">
                <Magnet size={11} /> {magnetTimer.toFixed(0)}s
              </span>
            )}
            {slowFieldTimer > 0 && (
              <span className="buff-chip bg-emerald-500/20 border-emerald-400/50 text-emerald-200">
                <Hourglass size={11} /> {slowFieldTimer.toFixed(0)}s
              </span>
            )}
          </div>
        )}

        {/* Campaign: distance to the sector's Warden */}
        {level && stageProgress >= 0 && (
          <div className="mt-2.5">
            <div className="flex justify-between items-end mb-1">
              <span className="text-[10px] font-bold font-cyber tracking-[0.18em] uppercase" style={{ color: level.accent }}>
                {level.name}
              </span>
              <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                <Skull size={10} /> {level.bossName}
              </span>
            </div>
            <div className="relative h-1.5 rounded-full bg-slate-950/90 border border-slate-700/80 overflow-hidden">
              <div
                className="h-full rounded-full transition-[width] duration-200"
                style={{ width: `${stageProgress * 100}%`, background: `linear-gradient(90deg, #22d3ee, ${level.accent})` }}
              />
            </div>
          </div>
        )}

        {/* Boss HP bar */}
        {bossHp >= 0 && (
          <div className="mt-3 anim-drop">
            <div className="flex justify-between items-end mb-1">
              <span className="text-[11px] font-black font-cyber tracking-[0.2em] text-rose-300 neon-glow-pink">
                {bossName}
              </span>
              <span className="text-[10px] font-bold text-rose-200/80 tabular-nums">{Math.ceil(bossHp * 100)}%</span>
            </div>
            <div className="h-2.5 rounded-full bg-slate-950/90 border border-rose-500/50 overflow-hidden p-[2px]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-rose-500 via-fuchsia-500 to-pink-400 transition-[width] duration-150"
                style={{ width: `${bossHp * 100}%` }}
              />
            </div>
            {bossStatus && (
              <p className="mt-1 text-[10px] sm:text-[11px] font-bold text-amber-200/90 tracking-wide text-center leading-tight">
                {bossStatus}
              </p>
            )}
          </div>
        )}

        {/* Radio chatter */}
        {comm && (
          <div key={comm.id} className="mt-2 mx-auto max-w-sm anim-drop">
            <div
              className="flex items-start gap-2 px-3 py-2 rounded-xl bg-slate-950/80 border backdrop-blur-sm"
              style={{ borderColor: `${SPEAKERS[comm.who].color}66` }}
            >
              <Radio size={13} className="mt-0.5 shrink-0" style={{ color: SPEAKERS[comm.who].color }} />
              <p className="text-xs leading-snug text-slate-100">
                <span className="font-black font-cyber text-[10px] tracking-wider mr-1.5" style={{ color: SPEAKERS[comm.who].color }}>
                  {SPEAKERS[comm.who].name}
                </span>
                {comm.text}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Floating Center Banner */}
      <div className="flex flex-col items-center justify-center pointer-events-none my-auto">
        <div
          className={`transition-all duration-300 text-center px-5 py-2.5 rounded-2xl bg-slate-950/75 border border-white/15 backdrop-blur-md shadow-2xl ${
            isBannerVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-75'
          }`}
        >
          <p className={`text-sm sm:text-lg font-black tracking-[0.15em] uppercase font-cyber ${bannerColorClass}`}>
            {centerBannerText}
          </p>
        </div>
      </div>

      {/* Bottom Area */}
      <div className="w-full max-w-xl mx-auto flex items-end justify-between gap-3 pb-1 sm:pb-2">
        {/* Quest tracker */}
        <div className="glass-panel px-3 py-2 rounded-2xl max-w-[190px] sm:max-w-xs">
          <p className="text-[10px] uppercase tracking-wider text-cyan-400 font-bold font-cyber flex items-center gap-1">
            <Target size={11} /> Mission
          </p>
          <p className="text-xs font-semibold text-slate-200 leading-tight mt-0.5">{currentQuest.label}</p>
          <div className="flex items-center gap-2 mt-1">
            <div className="flex-1 h-1 rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-cyan-400 transition-[width] duration-300"
                style={{ width: `${(questClamped / currentQuest.target) * 100}%` }}
              />
            </div>
            <span className="text-[10px] font-bold text-slate-300 tabular-nums">
              {questClamped}/{currentQuest.target}
            </span>
          </div>
          <span className="text-[10px] font-bold text-amber-300 flex items-center gap-1 mt-0.5">
            Reward +{currentQuest.reward} <ShardIcon size={10} />
          </span>
        </div>

        {/* Thumb Action Buttons */}
        <div className="flex items-end gap-3 pointer-events-auto">
          <button
            type="button"
            onClick={onTriggerEmp}
            disabled={empBombs <= 0}
            aria-label="EMP Bomb"
            className={`relative w-14 h-14 sm:w-16 sm:h-16 rounded-2xl border-2 flex flex-col items-center justify-center btn-cyber ${
              empBombs > 0
                ? 'bg-gradient-to-br from-amber-500/30 to-rose-600/40 border-amber-400/80 shadow-lg shadow-amber-500/25'
                : 'bg-slate-900/80 border-slate-700 opacity-40 cursor-not-allowed'
            }`}
          >
            <Bomb size={22} className="text-amber-200" />
            <span className="text-[9px] sm:text-[10px] font-black uppercase text-amber-200 mt-0.5 font-cyber">EMP</span>
            <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center shadow-md">
              {empBombs}
            </span>
          </button>

          <button
            type="button"
            onClick={onTriggerDash}
            disabled={!dashReady}
            aria-label="Hyper Dash"
            className={`relative w-[76px] h-[76px] sm:w-[84px] sm:h-[84px] rounded-full flex flex-col items-center justify-center btn-cyber ${
              dashReady ? 'bg-cyan-500/25 dash-ready' : 'bg-slate-900/80'
            }`}
          >
            <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 80 80">
              <circle cx="40" cy="40" r={ringR} fill="none" stroke="rgba(51,65,85,0.9)" strokeWidth="4" />
              <circle
                cx="40"
                cy="40"
                r={ringR}
                fill="none"
                stroke={dashReady ? '#67e8f9' : '#22d3ee'}
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={ringC}
                strokeDashoffset={ringC * (1 - Math.max(0, Math.min(1, dashProgress)))}
              />
            </svg>
            <Zap size={26} className={dashReady ? 'text-cyan-100' : 'text-slate-500'} fill={dashReady ? 'currentColor' : 'none'} />
            <span className={`text-[10px] font-black uppercase font-cyber ${dashReady ? 'text-cyan-100' : 'text-slate-500'}`}>
              Dash
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
