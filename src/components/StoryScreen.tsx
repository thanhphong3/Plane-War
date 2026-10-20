import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, ChevronsRight, KeyRound, Play, Skull } from 'lucide-react';
import { LevelDef, SPEAKERS } from '../game/campaign';
import { tr } from '../i18n';
import { sound } from '../utils/audio';

interface StoryScreenProps {
  level: LevelDef;
  kind: 'briefing' | 'debrief';
  isFinal: boolean;
  onDone: () => void;
  onBack: () => void;
}

const TYPE_MS = 22;

/** Visual-novel style comms: briefing before a sector, debrief after its Warden falls. */
export const StoryScreen: React.FC<StoryScreenProps> = ({ level, kind, isFinal, onDone, onBack }) => {
  const lines = kind === 'briefing' ? level.briefing : level.debrief;
  const [idx, setIdx] = useState(0);
  const [typed, setTyped] = useState(0);
  const [showIntel, setShowIntel] = useState(false);

  const line = lines[Math.min(idx, lines.length - 1)];
  const speaker = SPEAKERS[line.who];
  const done = typed >= line.text.length;

  // Typewriter
  useEffect(() => {
    if (showIntel || done) return;
    const id = window.setInterval(() => setTyped((n) => n + 1), TYPE_MS);
    return () => window.clearInterval(id);
  }, [idx, done, showIntel]);

  useEffect(() => {
    if (!showIntel) sound.playSound('comm');
  }, [idx, showIntel]);

  const finish = useCallback(() => {
    if (kind === 'briefing') setShowIntel(true);
    else onDone();
  }, [kind, onDone]);

  const advance = useCallback(() => {
    if (showIntel) return;
    if (!done) {
      setTyped(line.text.length);
      return;
    }
    if (idx < lines.length - 1) {
      setIdx(idx + 1);
      setTyped(0);
    } else {
      finish();
    }
  }, [showIntel, done, line.text.length, idx, lines.length, finish]);

  useEffect(() => {
    const onKey = (evt: KeyboardEvent) => {
      if (evt.code === 'Space' || evt.code === 'Enter') {
        evt.preventDefault();
        if (showIntel) onDone();
        else advance();
      } else if (evt.code === 'Escape' && !showIntel) {
        finish();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [advance, finish, onDone, showIntel]);

  const keyNumber = level.id + 1;

  return (
    <div
      className="fixed inset-0 z-30 flex flex-col justify-between p-3 sm:p-6 bg-gradient-to-b from-slate-950/70 via-slate-950/30 to-slate-950/90 anim-fade safe-area"
      onClick={advance}
    >
      {/* Top bar */}
      <div className="w-full max-w-xl mx-auto flex items-center justify-between">
        {kind === 'briefing' ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              sound.playSound('click');
              onBack();
            }}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full glass-panel text-xs font-bold text-slate-300 btn-cyber"
          >
            <ArrowLeft size={14} /> {tr('Menu', 'Menu')}
          </button>
        ) : (
          <span />
        )}
        {!showIntel && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              sound.playSound('click');
              finish();
            }}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full glass-panel text-xs font-bold text-slate-300 btn-cyber"
          >
            {tr('Skip', 'Bỏ qua')} <ChevronsRight size={14} />
          </button>
        )}
      </div>

      {/* Sector title card */}
      <div className="text-center anim-pop pointer-events-none">
        {kind === 'briefing' ? (
          <>
            <p className="text-xs font-bold tracking-[0.4em] font-cyber" style={{ color: level.accent }}>
              {level.code}
            </p>
            <h1 className="text-3xl sm:text-5xl font-black font-cyber text-white uppercase mt-1" style={{ textShadow: `0 0 24px ${level.accent}` }}>
              {level.name}
            </h1>
            <p className="text-sm text-slate-300 italic mt-1">{level.tagline}</p>
          </>
        ) : (
          <>
            <p className="text-xs font-bold tracking-[0.4em] font-cyber text-amber-300">
              {isFinal ? tr('CORE REBOOTED', 'LÕI ĐÃ KHỞI ĐỘNG LẠI') : tr('SECTOR CLEARED', 'ĐÃ GIẢI PHÓNG KHU VỰC')}
            </p>
            <h1 className="text-3xl sm:text-5xl font-black font-cyber text-white uppercase mt-1 neon-glow-amber">
              {isFinal ? tr('The Grid Lives', 'Lưới Hồi Sinh') : tr(`${level.bossName} Falls`, `${level.bossName} Gục Ngã`)}
            </h1>
            {!isFinal && (
              <p className="text-sm text-amber-200 mt-2 flex items-center justify-center gap-1.5 font-bold">
                <KeyRound size={15} /> {tr(`Root Key ${keyNumber}/5 recovered`, `Đã thu hồi Khóa Gốc ${keyNumber}/5`)}
              </p>
            )}
          </>
        )}
      </div>

      {/* Dialogue / intel */}
      <div className="w-full max-w-xl mx-auto">
        {showIntel ? (
          <div className="glass-panel rounded-3xl p-4 sm:p-5 anim-pop" style={{ borderColor: `${level.accent}88` }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <span
                className="w-12 h-12 shrink-0 rounded-2xl flex items-center justify-center border"
                style={{ borderColor: level.accent, background: `${level.accent}22`, color: level.accent }}
              >
                <Skull size={22} />
              </span>
              <div>
                <p className="text-[10px] font-bold tracking-[0.25em] text-slate-400 font-cyber">{tr('TARGET', 'MỤC TIÊU')}</p>
                <p className="text-lg font-black text-white font-cyber leading-tight">{level.bossName}</p>
                <p className="text-xs text-slate-400">{level.bossTitle}</p>
              </div>
            </div>
            <p className="mt-3 text-[10px] font-bold tracking-[0.25em] font-cyber" style={{ color: level.accent }}>
              {tr('HOW TO TAKE IT DOWN', 'CÁCH HẠ GỤC')}
            </p>
            <ul className="mt-1.5 space-y-1.5">
              {level.intel.map((tip) => (
                <li key={tip} className="flex gap-2 text-xs sm:text-sm text-slate-200 leading-snug">
                  <span className="mt-1.5 w-1.5 h-1.5 shrink-0 rounded-full" style={{ background: level.accent }} />
                  {tip}
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => {
                sound.playSound('click');
                onDone();
              }}
              className="mt-4 w-full py-3.5 rounded-2xl btn-primary text-slate-950 font-black text-base uppercase font-cyber tracking-[0.15em] btn-cyber animate-glow flex items-center justify-center gap-2"
            >
              <Play size={18} fill="currentColor" /> {tr('Launch', 'Xuất kích')}
            </button>
          </div>
        ) : (
          <div className="glass-panel rounded-3xl p-4 sm:p-5 cursor-pointer" style={{ borderColor: `${speaker.color}66` }}>
            <div className="flex items-start gap-3">
              <span
                className="w-12 h-12 shrink-0 rounded-2xl flex items-center justify-center font-black font-cyber text-xl border-2"
                style={{
                  borderColor: speaker.color,
                  color: speaker.color,
                  background: `${speaker.color}1a`,
                  boxShadow: `0 0 18px ${speaker.color}55`,
                }}
              >
                {speaker.glyph}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-black tracking-[0.2em] font-cyber" style={{ color: speaker.color }}>
                  {speaker.name}
                </p>
                <p className="mt-1 text-sm sm:text-base text-slate-100 leading-snug min-h-[3.75rem]">
                  {line.text.slice(0, typed)}
                  {!done && <span className="inline-block w-2 h-4 align-middle ml-0.5 bg-slate-300 animate-pulse" />}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="flex gap-1">
                {lines.map((_, i) => (
                  <span key={i} className={`h-1 rounded-full ${i <= idx ? 'w-4' : 'w-2 bg-slate-700'}`} style={i <= idx ? { background: speaker.color } : undefined} />
                ))}
              </span>
              <span className={`text-[10px] font-bold text-slate-400 uppercase tracking-wider ${done ? 'animate-pulse' : 'opacity-0'}`}>
                {tr('Tap to continue ▸', 'Chạm để tiếp tục ▸')}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
