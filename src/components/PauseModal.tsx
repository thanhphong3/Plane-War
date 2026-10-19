import React from 'react';
import { sound } from '../utils/audio';

interface PauseModalProps {
  isOpen: boolean;
  onResume: () => void;
  onRestart: () => void;
  onMainMenu: () => void;
  isMuted: boolean;
  isBgmMuted: boolean;
  onToggleMute: () => void;
  onToggleBgm: () => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({
  isOpen,
  onResume,
  onRestart,
  onMainMenu,
  isMuted,
  isBgmMuted,
  onToggleMute,
  onToggleBgm,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="glass-panel w-full max-w-xs rounded-3xl p-6 text-center space-y-4 border border-cyan-500/30 shadow-2xl">
        <div className="w-12 h-12 mx-auto rounded-2xl bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 flex items-center justify-center text-2xl">
          ⏸️
        </div>
        <div>
          <h2 className="text-2xl font-black text-white font-cyber tracking-wide">TẠM DỪNG</h2>
          <p className="text-xs text-slate-300 mt-1">Thả lỏng ngón tay trước khi tiếp tục bứt tốc!</p>
        </div>

        {/* Audio controls */}
        <div className="grid grid-cols-2 gap-2 bg-slate-900/80 p-2 rounded-2xl border border-slate-800">
          <button
            type="button"
            onClick={onToggleMute}
            className="flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 btn-cyber border border-slate-700"
          >
            <span>{isMuted ? '🔇' : '🔊'}</span>
            <span>{isMuted ? 'Tắt Hiệu Ứng' : 'Bật Hiệu Ứng'}</span>
          </button>
          <button
            type="button"
            onClick={onToggleBgm}
            className="flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 btn-cyber border border-slate-700"
          >
            <span>{isBgmMuted ? '🎵❌' : '🎵'}</span>
            <span>{isBgmMuted ? 'Tắt Nhạc' : 'Bật Nhạc'}</span>
          </button>
        </div>

        {/* Actions */}
        <div className="space-y-2.5 pt-1">
          <button
            type="button"
            onClick={() => {
              sound.playSound('click');
              onResume();
            }}
            className="w-full py-3 rounded-2xl bg-gradient-to-r from-cyan-400 to-cyan-500 text-slate-950 font-black text-sm uppercase font-cyber btn-cyber shadow-lg shadow-cyan-500/20"
          >
            ▶ Tiếp Tục Bay
          </button>
          <button
            type="button"
            onClick={() => {
              sound.playSound('click');
              onRestart();
            }}
            className="w-full py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs uppercase font-cyber border border-slate-700 btn-cyber"
          >
            🔄 Chơi Lại Ván Mới
          </button>
          <button
            type="button"
            onClick={() => {
              sound.playSound('click');
              onMainMenu();
            }}
            className="w-full py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 font-semibold text-xs border border-slate-800 btn-cyber"
          >
            🏠 Về Sảnh Chính
          </button>
        </div>
      </div>
    </div>
  );
};
