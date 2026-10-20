import React, { useEffect, useRef, useState } from 'react';
import { HeartPulse, X } from 'lucide-react';
import { tr, useLang } from '../i18n';
import { sound } from '../utils/audio';
import { ShardIcon } from './Icon';

interface ReviveModalProps {
  isOpen: boolean;
  cost: number;
  /** Banked shards plus what this run has earned so far. */
  shards: number;
  score: number;
  onRevive: () => void;
  onGiveUp: () => void;
}

/** Seconds to decide before the run ends on its own. */
const DECIDE_TIME = 8;
/** Ignore input for a moment so a frantic Dash double-tap can't buy a revive by accident. */
const ARM_DELAY_MS = 600;

export const ReviveModal: React.FC<ReviveModalProps> = ({ isOpen, cost, shards, score, onRevive, onGiveUp }) => {
  useLang();
  const [left, setLeft] = useState(DECIDE_TIME);
  const [armed, setArmed] = useState(false);
  const doneRef = useRef(false);

  useEffect(() => {
    if (!isOpen) return;
    doneRef.current = false;
    setArmed(false);
    setLeft(DECIDE_TIME);
    const start = performance.now();
    const arm = window.setTimeout(() => setArmed(true), ARM_DELAY_MS);
    const id = window.setInterval(() => {
      const remaining = Math.max(0, DECIDE_TIME - (performance.now() - start) / 1000);
      setLeft(remaining);
      if (remaining <= 0 && !doneRef.current) {
        doneRef.current = true;
        onGiveUp();
      }
    }, 100);
    return () => {
      window.clearTimeout(arm);
      window.clearInterval(id);
    };
  }, [isOpen, onGiveUp]);

  const choose = (revive: boolean) => {
    if (!armed || doneRef.current) return;
    doneRef.current = true;
    sound.playSound('click');
    if (revive) onRevive();
    else onGiveUp();
  };

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (evt: KeyboardEvent) => {
      if (evt.code === 'Enter' || evt.code === 'KeyR') choose(true);
      else if (evt.code === 'Escape') choose(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!isOpen) return null;
  const ringR = 44;
  const ringC = 2 * Math.PI * ringR;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm anim-fade">
      <div className="glass-panel w-full max-w-xs rounded-3xl p-6 text-center anim-pop panel-glow">
        <div className="relative w-28 h-28 mx-auto">
          <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r={ringR} fill="none" stroke="rgba(51,65,85,0.9)" strokeWidth="5" />
            <circle
              cx="50"
              cy="50"
              r={ringR}
              fill="none"
              stroke="#67e8f9"
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={ringC}
              strokeDashoffset={ringC * (1 - left / DECIDE_TIME)}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <HeartPulse size={30} className="text-cyan-300" />
            <span className="text-xl font-black font-cyber text-white tabular-nums">{Math.ceil(left)}</span>
          </div>
        </div>
        <h2 className="mt-3 text-2xl font-black text-white font-cyber uppercase tracking-wider neon-glow-cyan">
          {tr('Hull Breach!', 'Thủng Thân Tàu!')}
        </h2>
        <p className="text-xs text-slate-300 mt-1">
          {tr('Reboot your systems and keep the run going?', 'Khởi động lại hệ thống và tiếp tục lượt chơi?')}
        </p>
        <p className="text-[11px] text-slate-400 mt-1">
          {tr('Score so far', 'Điểm hiện tại')}{' '}
          <span className="font-black text-cyan-200 tabular-nums">{score.toLocaleString('en-US')}</span>
        </p>

        <div className="mt-4 space-y-2">
          <button
            type="button"
            disabled={!armed}
            onClick={() => choose(true)}
            className="w-full py-3.5 rounded-2xl btn-primary text-slate-950 font-black text-base uppercase font-cyber tracking-wider btn-cyber animate-glow flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {tr('Revive', 'Hồi sinh')} · <ShardIcon size={15} className="!text-slate-950 !drop-shadow-none" /> {cost}
          </button>
          <p className="text-[10px] text-slate-500">
            {tr('You have', 'Bạn có')} {shards.toLocaleString('en-US')} {tr('shards · one revive per run', 'mảnh · mỗi lượt một lần')}
          </p>
          <button
            type="button"
            disabled={!armed}
            onClick={() => choose(false)}
            className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 font-bold text-xs flex items-center justify-center gap-1.5 btn-cyber font-cyber"
          >
            <X size={14} /> {tr('End run', 'Kết thúc')}
          </button>
        </div>
      </div>
    </div>
  );
};
