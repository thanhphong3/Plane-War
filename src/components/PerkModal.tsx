import React, { useEffect, useRef, useState } from 'react';
import { Bomb, ChevronsUp, Crosshair, Flame, Gauge, Gem, Ghost, Repeat, Rocket, ShieldPlus, Skull, Sparkles, Sun, Zap } from 'lucide-react';
import { tr, useLang } from '../i18n';
import { localPerk } from '../i18n/content';
import { PerkDef, PerkId } from '../types/game';
import { PERKS, PERK_REWARDS } from '../utils/constants';

const ICONS: Record<string, React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>> = {
  zap: Zap,
  shield: ShieldPlus,
  bounce: Repeat,
  ghost: Ghost,
  sun: Sun,
  rocket: Rocket,
  gem: Gem,
  flame: Flame,
  crosshair: Crosshair,
  skull: Skull,
  gauge: Gauge,
  chevrons: ChevronsUp,
  bomb: Bomb,
};

export const perkDef = (id: PerkId): PerkDef =>
  localPerk(PERKS.find((p) => p.id === id) || PERK_REWARDS.find((p) => p.id === id) || PERKS[0]);

/** Lucide glyph for a perk (shared with the HUD). */
export const PerkIcon: React.FC<{ id: PerkId; size?: number; className?: string; style?: React.CSSProperties }> = ({
  id,
  size = 14,
  className,
  style,
}) => {
  const Icon = ICONS[perkDef(id).icon] || Sparkles;
  return <Icon size={size} className={className} style={style} />;
};

interface PerkModalProps {
  isOpen: boolean;
  options: PerkId[];
  owned: PerkId[];
  /** Level of each installed perk. */
  levels: Partial<Record<PerkId, number>>;
  /** Small context line, e.g. "Wave 4 cleared" or "Boss 3/7 down". */
  subtitle: string;
  onPick: (id: PerkId) => void;
}

/** Ignore input for a moment so a Dash double-tap in flight can't pick a card by accident. */
const ARM_DELAY_MS = 450;

export const PerkModal: React.FC<PerkModalProps> = ({ isOpen, options, owned, levels, subtitle, onPick }) => {
  useLang();
  const [armed, setArmed] = useState(false);
  const pickedRef = useRef(false);

  useEffect(() => {
    if (!isOpen) return;
    pickedRef.current = false;
    setArmed(false);
    const id = window.setTimeout(() => setArmed(true), ARM_DELAY_MS);
    return () => window.clearTimeout(id);
  }, [isOpen, options]);

  const choose = (id: PerkId) => {
    if (!armed || pickedRef.current) return;
    pickedRef.current = true;
    onPick(id);
  };

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (evt: KeyboardEvent) => {
      const n = ['Digit1', 'Digit2', 'Digit3', 'Numpad1', 'Numpad2', 'Numpad3'].indexOf(evt.code) % 3;
      if (n >= 0 && options[n]) {
        evt.preventDefault();
        choose(options[n]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 backdrop-blur-sm anim-fade">
      <div className="w-full max-w-3xl flex flex-col items-center">
        <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.35em] text-fuchsia-300 font-bold font-cyber">{subtitle}</p>
        <h2 className="text-2xl sm:text-4xl font-black text-white font-cyber uppercase tracking-wider neon-glow-cyan mt-1 text-center">
          {tr('Tactical Upgrade', 'Nâng Cấp Chiến Thuật')}
        </h2>
        <p className="text-xs text-slate-300 mt-1.5 text-center">
          {tr(
            'Pick one. It lasts for the rest of this run; picking one you own levels it up.',
            'Chọn một. Hiệu lực đến hết lượt chơi; chọn lại cái đã có sẽ nâng cấp nó.'
          )}
        </p>

        <div className="mt-5 w-full grid grid-cols-1 sm:grid-cols-3 gap-3">
          {options.map((id, i) => {
            const perk = perkDef(id);
            const lvl = levels[id] || 0;
            const tag = perk.reward
              ? { text: tr('Supply drop', 'Tiếp tế'), cls: 'bg-sky-500/20 text-sky-200 border-sky-400/50' }
              : perk.gambit
              ? { text: tr('Gambit · risk', 'Canh bạc · rủi ro'), cls: 'bg-rose-500/20 text-rose-200 border-rose-400/60' }
              : lvl > 0
              ? { text: `LV ${lvl} → ${lvl + 1}`, cls: 'bg-amber-400/20 text-amber-200 border-amber-300/60' }
              : { text: tr('New', 'Mới'), cls: 'bg-cyan-500/15 text-cyan-200 border-cyan-400/40' };
            return (
              <button
                key={id}
                type="button"
                onClick={() => choose(id)}
                disabled={!armed}
                className="group relative text-left sm:text-center rounded-2xl p-4 sm:p-5 bg-slate-950/85 border-2 btn-cyber anim-pop flex sm:flex-col items-center sm:items-center gap-3 sm:gap-2 overflow-hidden transition-transform hover:-translate-y-1 disabled:cursor-wait"
                style={{
                  borderColor: `${perk.color}88`,
                  boxShadow: `0 0 24px ${perk.color}33, inset 0 0 30px ${perk.color}14`,
                  animationDelay: `${i * 70}ms`,
                }}
              >
                <span
                  className="absolute inset-x-0 top-0 h-[2px] opacity-80"
                  style={{ background: `linear-gradient(90deg, transparent, ${perk.color}, transparent)` }}
                />
                <span
                  className="shrink-0 w-12 h-12 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center border"
                  style={{ backgroundColor: `${perk.color}1f`, borderColor: `${perk.color}66` }}
                >
                  <PerkIcon id={id} size={26} style={{ color: perk.color }} />
                </span>
                <span className="min-w-0 flex-1 sm:flex-none">
                  <span className={`inline-block text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border font-cyber ${tag.cls}`}>
                    {tag.text}
                  </span>
                  <span className="block text-sm sm:text-base font-black font-cyber uppercase tracking-wide mt-1" style={{ color: perk.color }}>
                    {perk.name}
                  </span>
                  <span className="block text-xs text-slate-300 leading-snug mt-1">
                    {lvl > 0 && perk.upgrade ? `${perk.upgrade}.` : perk.desc}
                  </span>
                </span>
                <span className="hidden sm:flex mt-2 w-7 h-7 rounded-lg border border-slate-600 bg-slate-900 text-slate-300 text-xs font-black font-cyber items-center justify-center group-hover:border-white group-hover:text-white">
                  {i + 1}
                </span>
              </button>
            );
          })}
        </div>

        {owned.length > 0 && (
          <div className="mt-5 flex items-center gap-2 flex-wrap justify-center">
            <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold font-cyber">{tr('Installed', 'Đã lắp')}</span>
            {owned.map((id) => {
              const perk = perkDef(id);
              return (
                <span
                  key={id}
                  title={perk.name}
                  className="relative w-7 h-7 rounded-lg flex items-center justify-center border"
                  style={{ borderColor: `${perk.color}66`, backgroundColor: `${perk.color}1a` }}
                >
                  <PerkIcon id={id} size={14} style={{ color: perk.color }} />
                  {(levels[id] || 0) > 1 && (
                    <span className="absolute -bottom-1 -right-1 px-0.5 rounded bg-amber-300 text-slate-950 text-[8px] font-black leading-none">
                      {levels[id]}
                    </span>
                  )}
                </span>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
