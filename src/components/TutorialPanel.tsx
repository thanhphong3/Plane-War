import React from 'react';
import { Check, GraduationCap } from 'lucide-react';
import { LESSONS, lessonAt } from '../game/tutorial';
import { tr, useLang } from '../i18n';

interface TutorialPanelProps {
  /** Current lesson index (past the end once training is complete). */
  step: number;
  progress: number;
}

/** Flight Training coach card: the current lesson, its goal and a step tracker. */
export const TutorialPanel: React.FC<TutorialPanelProps> = ({ step, progress }) => {
  useLang();
  const lesson = lessonAt(step);
  const pct = lesson ? Math.min(1, progress / lesson.target) : 1;
  const done = !lesson || pct >= 1;
  // Distance goals read better as a bar than as a pixel count
  const count = lesson && lesson.id !== 'move' ? `${Math.floor(progress)}/${lesson.target}` : `${Math.round(pct * 100)}%`;

  return (
    // Sits under the HUD strip: the lower half of the screen is where the ship flies
    <div className="fixed inset-x-0 top-24 sm:top-32 z-20 flex justify-center px-3 pointer-events-none select-none">
      <div
        className={`w-full max-w-sm rounded-2xl px-3.5 py-2.5 bg-slate-950/75 border backdrop-blur-[2px] shadow-xl anim-pop ${
          done ? 'border-emerald-400/70 shadow-emerald-500/20' : 'border-cyan-400/60 shadow-cyan-500/20'
        }`}
        key={step}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300 font-cyber">
            <GraduationCap size={13} />
            {tr('Flight Training', 'Huấn luyện bay')}
          </span>
          {/* Step tracker */}
          <span className="flex items-center gap-1" aria-label={tr(`Lesson ${step + 1} of ${LESSONS.length}`, `Bài ${step + 1}/${LESSONS.length}`)}>
            {LESSONS.map((l, i) => (
              <span
                key={l.id}
                className={`h-1.5 rounded-full transition-all ${
                  i < step || (i === step && done) ? 'w-3 bg-emerald-400' : i === step ? 'w-4 bg-cyan-300' : 'w-1.5 bg-slate-700'
                }`}
              />
            ))}
          </span>
        </div>

        {lesson ? (
          <>
            <p className="mt-1.5 flex items-center gap-2 text-base font-black text-white font-cyber uppercase tracking-wide">
              {done && <Check size={16} className="text-emerald-300" strokeWidth={3} />}
              {lesson.title()}
              <span className="ml-auto text-xs font-bold text-cyan-200 tabular-nums">{count}</span>
            </p>
            <p className="text-sm text-slate-100 leading-snug mt-0.5">{lesson.touch()}</p>
            <p className="text-xs text-slate-400 leading-snug">{lesson.keys()}</p>
            <div className="mt-2 h-1.5 rounded-full bg-slate-800 overflow-hidden">
              <div
                className={`h-full rounded-full transition-[width] duration-150 ${done ? 'bg-emerald-400' : 'bg-cyan-400'}`}
                style={{ width: `${pct * 100}%` }}
              />
            </div>
            <p className="mt-1 text-[11px] text-slate-400 leading-snug italic">{lesson.why()}</p>
          </>
        ) : (
          <p className="mt-1.5 text-base font-black text-emerald-300 font-cyber uppercase tracking-wide">
            {tr('All lessons cleared!', 'Đã xong mọi bài học!')}
          </p>
        )}
      </div>
    </div>
  );
};
