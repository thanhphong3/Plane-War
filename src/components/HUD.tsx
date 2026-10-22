import React from 'react';
import { Bomb, ChevronsUp, Hourglass, Magnet, Pause, Radio, Shield, Skull, Target, Timer, Zap } from 'lucide-react';
import { LevelDef, SPEAKERS, SpeakerId } from '../game/campaign';
import { questById } from '../game/progression';
import { tr, numLocale } from '../i18n';
import { localModifier, questLabel } from '../i18n/content';
import { DailyModifierId, DailyQuestState, GameMode, PerkId } from '../types/game';
import { DAILY_MODIFIERS, MAX_WEAPON_LEVEL } from '../utils/constants';
import { ShardIcon } from './Icon';
import { PerkIcon, perkDef } from './PerkModal';

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
  /** An enemy is in Dash range and the coach wants the pilot to ram it. */
  dashHint: boolean;
  bossHp: number;
  bossName: string;
  bossStatus: string;
  /** Seconds before an arcade boss retreats, -1 when it fights to the end. */
  bossEscape: number;
  /** 0..1 while flying through a campaign sector, -1 otherwise. */
  stageProgress: number;
  /** Tactical Perks installed this run. */
  perks: PerkId[];
  perkLevels: Partial<Record<PerkId, number>>;
  /** Kinetic Capacitor charge 0..1, or -1 without that perk. */
  grazeCharge: number;
  /** Boss Rush: current boss (1-based), -1 outside Boss Rush. */
  bossRush: number;
  level: LevelDef | null;
  comm: CommMessage | null;
  /** Today's missions (done flags) and their live progress. */
  quests: DailyQuestState;
  questProgress: number[];
  /** Daily Challenge rule twists, empty in other modes. */
  modifiers: DailyModifierId[];
  centerBannerText: string;
  isBannerVisible: boolean;
  bannerColorClass: string;
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
    className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-xl glass-panel before:absolute before:-inset-1.5 flex items-center justify-center btn-cyber text-slate-200 hover:text-white"
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
  dashHint,
  bossHp,
  bossName,
  bossStatus,
  bossEscape,
  stageProgress,
  perks,
  perkLevels,
  grazeCharge,
  bossRush,
  level,
  comm,
  quests,
  questProgress,
  modifiers,
  centerBannerText,
  isBannerVisible,
  bannerColorClass,
  onPause,
  onTriggerDash,
  onTriggerEmp,
}) => {
  const dashReady = dashCooldown <= 0;
  const dashProgress = dashMaxCooldown > 0 ? 1 - dashCooldown / dashMaxCooldown : 1;
  // Show the first mission still open today
  const openIdx = quests.ids.findIndex((_, i) => !quests.done[i]);
  const currentQuest = openIdx >= 0 ? questById(quests.ids[openIdx]) : null;
  const questClamped = currentQuest ? Math.min(currentQuest.target, Math.floor(questProgress[openIdx] || 0)) : 0;
  const hotCombo = combo >= 10;
  const timeLow = gameMode === 'timed' && timedRemaining < 10;
  const stageLabel = level
    ? level.code
    : bossRush > 0
    ? `BOSS ${bossRush}/7`
    : gameMode === 'daily'
    ? `${tr('DAILY', 'NGÀY')} · ${tr('LV', 'CẤP')} ${waveLevel}`
    : `${tr('LV', 'CẤP')} ${waveLevel}`;

  // SVG ring for the dash cooldown
  const ringR = 36;
  const ringC = 2 * Math.PI * ringR;

  return (
    <div className="fixed inset-0 pointer-events-none flex flex-col justify-between p-2.5 sm:p-5 z-20 select-none safe-area">
      {/* Top: one slim strip so the play field stays clear on phones */}
      <div className="w-full max-w-xl mx-auto">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-2xl sm:text-4xl font-black tracking-tight text-white font-cyber neon-glow-cyan tabular-nums leading-none">
                {Math.floor(score).toLocaleString(numLocale())}
              </span>
              {combo > 1 && (
                <span className="flex flex-col">
                  <span
                    className={`px-1.5 py-0.5 rounded-md text-xs sm:text-sm font-black font-cyber leading-none ${
                      hotCombo
                        ? 'bg-amber-400/25 border border-amber-300 text-amber-200 combo-hot'
                        : combo >= 5
                        ? 'bg-fuchsia-500/25 border border-fuchsia-400/70 text-fuchsia-200'
                        : 'bg-slate-800/70 border border-slate-600 text-slate-300'
                    }`}
                  >
                    x{combo}
                  </span>
                  <span className="h-[2px] mt-0.5 rounded-full bg-slate-800 overflow-hidden">
                    <span
                      className={`block h-full ${hotCombo ? 'bg-amber-300' : 'bg-fuchsia-400'}`}
                      style={{ width: `${Math.max(0, Math.min(1, comboTimer)) * 100}%` }}
                    />
                  </span>
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1 text-[10px] sm:text-[11px] font-bold font-cyber tracking-wider text-slate-400">
              <span className="flex items-center gap-1 text-amber-300 tabular-nums">
                <ShardIcon size={10} />
                {shards.toLocaleString(numLocale())}
              </span>
              <span>{stageLabel}</span>
              {gameMode === 'timed' && (
                <span className={`flex items-center gap-0.5 tabular-nums ${timeLow ? 'text-rose-400 animate-pulse' : 'text-rose-200'}`}>
                  <Timer size={11} />
                  {timedRemaining.toFixed(1)}s
                </span>
              )}
            </div>
          </div>

          {/* Audio toggles live in the Pause menu */}
          <div className="pointer-events-auto">
            <IconButton onClick={onPause} label={tr('Pause', 'Tạm dừng')}>
              <Pause size={16} />
            </IconButton>
          </div>
        </div>

        {/* Overdrive Energy: thin bar, labelled only while Overdrive burns */}
        <div className="flex items-center gap-1.5 mt-1.5">
          <Zap size={11} className={`shrink-0 ${isFeverActive ? 'text-amber-300 animate-pulse' : 'text-cyan-300'}`} />
          <div className="flex-1 h-1.5 sm:h-2.5 bg-slate-950/70 rounded-full overflow-hidden border border-slate-700/60">
            <div
              className={`h-full rounded-full transition-[width] duration-100 ${
                isFeverActive ? 'bar-fever' : 'bg-gradient-to-r from-cyan-400 via-fuchsia-500 to-amber-400'
              }`}
              style={{ width: `${Math.min(100, Math.max(0, feverEnergy))}%` }}
            />
          </div>
          <span
            className={`shrink-0 text-right text-[10px] font-bold font-cyber tabular-nums ${
              isFeverActive ? 'text-amber-200' : 'text-cyan-200/80'
            }`}
          >
            {isFeverActive ? tr('OVERDRIVE', 'QUÁ TẢI') : `${Math.round(feverEnergy)}%`}
          </span>
        </div>

        {/* One wrap row for buffs, daily rules, perks and the open mission */}
        {(weaponLevel > 1 ||
          shieldCount > 0 ||
          magnetTimer > 0 ||
          slowFieldTimer > 0 ||
          modifiers.length > 0 ||
          perks.length > 0 ||
          currentQuest) && (
          <div className="flex items-center gap-1 mt-1.5 flex-wrap opacity-90">
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
            {modifiers.map((id) => {
              const m = localModifier(DAILY_MODIFIERS.find((d) => d.id === id) || DAILY_MODIFIERS[0]);
              return (
                <span
                  key={id}
                  title={m.desc}
                  className="buff-chip"
                  style={{ color: m.color, borderColor: `${m.color}80`, backgroundColor: `${m.color}1f` }}
                >
                  {m.name}
                </span>
              );
            })}
            {perks.map((id) => {
              const def = perkDef(id);
              const charging = id === 'graze_shield' && grazeCharge >= 0;
              return (
                <span
                  key={id}
                  title={`${def.name}: ${def.desc}`}
                  className="relative w-5 h-5 rounded-md flex items-center justify-center border bg-slate-950/60 overflow-hidden"
                  style={{ borderColor: `${def.color}80` }}
                >
                  {charging && (
                    <span
                      className="absolute inset-x-0 bottom-0 transition-[height] duration-150"
                      style={{ height: `${grazeCharge * 100}%`, backgroundColor: `${def.color}40` }}
                    />
                  )}
                  <PerkIcon id={id} size={11} className="relative" style={{ color: def.color }} />
                  {(perkLevels[id] || 0) > 1 && (
                    <span className="absolute bottom-0 right-0 px-[2px] rounded-tl bg-amber-300 text-slate-950 text-[7px] font-black leading-none">
                      {perkLevels[id]}
                    </span>
                  )}
                </span>
              );
            })}
            {currentQuest && (
              <span
                title={`${questLabel(currentQuest)} (+${currentQuest.reward})`}
                className="buff-chip max-w-[11rem] bg-cyan-500/10 border-cyan-400/40 text-cyan-200"
              >
                <Target size={11} className="shrink-0" />
                <span className="hidden sm:inline truncate">{questLabel(currentQuest)}</span>
                <span className="tabular-nums shrink-0">
                  {questClamped.toLocaleString(numLocale())}/{currentQuest.target.toLocaleString(numLocale())}
                </span>
              </span>
            )}
          </div>
        )}

        {/* Campaign: distance to the sector's Warden (the boss bar takes over once it arrives) */}
        {level && stageProgress >= 0 && bossHp < 0 && (
          <div className="mt-1.5 flex items-center gap-1.5">
            <span className="text-[10px] font-bold font-cyber tracking-wider uppercase truncate max-w-[45%]" style={{ color: level.accent }}>
              {level.name}
            </span>
            <div className="flex-1 h-1 rounded-full bg-slate-950/70 overflow-hidden">
              <div
                className="h-full rounded-full transition-[width] duration-200"
                style={{ width: `${stageProgress * 100}%`, background: `linear-gradient(90deg, #22d3ee, ${level.accent})` }}
              />
            </div>
            <Skull size={11} className="shrink-0 text-slate-400" />
          </div>
        )}

        {/* Boss HP bar */}
        {bossHp >= 0 && (
          <div className="mt-2 anim-drop">
            <div className="flex justify-between items-end mb-0.5 gap-2">
              <span className="text-[10px] sm:text-[11px] font-black font-cyber tracking-[0.15em] text-rose-300 neon-glow-pink truncate">
                {bossName}
              </span>
              <span className="flex items-center gap-2 shrink-0 text-[10px] font-bold text-rose-200/80 tabular-nums">
                {bossEscape >= 0 && (
                  <span
                    title={tr('Escapes in', 'Rút lui sau')}
                    className={`flex items-center gap-0.5 ${bossEscape < 10 ? 'text-amber-300 animate-pulse' : 'text-slate-300'}`}
                  >
                    <Timer size={10} /> {Math.ceil(bossEscape)}s
                  </span>
                )}
                {Math.ceil(bossHp * 100)}%
              </span>
            </div>
            <div className="h-1.5 sm:h-2.5 rounded-full bg-slate-950/80 border border-rose-500/40 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-rose-500 via-fuchsia-500 to-pink-400 transition-[width] duration-150"
                style={{ width: `${bossHp * 100}%` }}
              />
            </div>
            {bossStatus && (
              <p className="mt-0.5 text-[10px] sm:text-[11px] font-bold text-amber-200/90 tracking-wide text-center leading-tight">{bossStatus}</p>
            )}
          </div>
        )}

        {/* Radio chatter */}
        {comm && (
          <div key={comm.id} className="mt-1.5 mx-auto max-w-sm anim-drop">
            <div
              className="flex items-start gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-950/70 border backdrop-blur-sm"
              style={{ borderColor: `${SPEAKERS[comm.who].color}55` }}
            >
              <Radio size={12} className="mt-0.5 shrink-0" style={{ color: SPEAKERS[comm.who].color }} />
              <p className="text-[11px] sm:text-xs leading-snug text-slate-100">
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

      {/* Bottom: only the thumb buttons, tucked into the right corner and see-through */}
      <div className="w-full max-w-xl mx-auto flex items-end justify-end pb-1 sm:pb-2">
        <div className="flex items-end gap-2.5 pointer-events-auto">
          <button
            type="button"
            onClick={onTriggerEmp}
            disabled={empBombs <= 0}
            aria-label={tr('EMP Bomb', 'Bom EMP')}
            className={`relative w-12 h-12 sm:w-16 sm:h-16 rounded-2xl border-2 flex flex-col items-center justify-center btn-cyber ${
              empBombs > 0
                ? 'bg-amber-500/15 border-amber-400/60 opacity-85'
                : 'bg-slate-900/40 border-slate-700/60 opacity-30 cursor-not-allowed'
            }`}
          >
            <Bomb size={18} className="text-amber-200" />
            <span className="text-[8px] sm:text-[10px] font-black uppercase text-amber-200 font-cyber leading-none mt-0.5">EMP</span>
            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-amber-400 text-slate-950 font-black text-[10px] sm:text-xs flex items-center justify-center shadow-md">
              {empBombs}
            </span>
          </button>

          <div className="relative">
            {/* Dash coach bubble: says what the button does right when it's worth pressing */}
            {dashHint && (
              <div className="absolute bottom-full right-0 mb-2 w-max max-w-[150px] px-2.5 py-1.5 rounded-xl bg-cyan-950/90 border border-cyan-300/70 shadow-lg shadow-cyan-500/30 text-right anim-pop">
                <p className="text-[11px] font-black font-cyber text-cyan-100 tracking-wider leading-tight">{tr('DASH NOW!', 'LƯỚT NGAY!')}</p>
                <p className="text-[10px] text-cyan-200/90 leading-tight mt-0.5">{tr('Ram the marked enemy', 'Húc kẻ địch được đánh dấu')}</p>
                <span className="absolute -bottom-1.5 right-6 w-3 h-3 rotate-45 bg-cyan-950 border-r border-b border-cyan-300/70" />
              </div>
            )}
            <button
              type="button"
              onClick={onTriggerDash}
              disabled={!dashReady}
              aria-label={tr(
                'Hyper Dash: short invincible burst that smashes enemies',
                'Siêu Lướt: lao vút bất tử trong chốc lát, húc nát kẻ địch'
              )}
              title={tr(
                'Hyper Dash (double-tap / Space): short invincible burst. Ram enemies to smash them, ram Plasma Cores to send them back.',
                'Siêu Lướt (chạm đúp / Space): lao vút bất tử trong chốc lát. Húc nát kẻ địch, húc Lõi Plasma để bắn ngược lại.'
              )}
              className={`relative w-16 h-16 sm:w-[84px] sm:h-[84px] rounded-full flex flex-col items-center justify-center btn-cyber ${
                dashReady ? 'bg-cyan-500/20 dash-ready opacity-90' : 'bg-slate-900/50 opacity-60'
              } ${dashHint ? 'ring-4 ring-cyan-300/60 opacity-100' : ''}`}
            >
              <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r={ringR} fill="none" stroke="rgba(51,65,85,0.7)" strokeWidth="4" />
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
              <Zap size={22} className={dashReady ? 'text-cyan-100' : 'text-slate-500'} fill={dashReady ? 'currentColor' : 'none'} />
              <span
                className={`text-[9px] sm:text-[10px] font-black font-cyber tabular-nums leading-none mt-0.5 ${
                  dashReady ? 'text-cyan-100' : 'text-slate-400'
                }`}
              >
                {dashReady ? tr('DASH', 'LƯỚT') : `${dashCooldown.toFixed(1)}s`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
