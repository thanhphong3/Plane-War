import React from 'react';
import { sound } from '../utils/audio';

interface GameOverModalProps {
  isOpen: boolean;
  score: number;
  shardsEarned: number;
  maxCombo: number;
  nearMisses: number;
  isNewRecord: boolean;
  reason: 'crashed' | 'timeup';
  onPlayAgain: () => void;
  onOpenShop: () => void;
  onMainMenu: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  isOpen,
  score,
  shardsEarned,
  maxCombo,
  nearMisses,
  isNewRecord,
  reason,
  onPlayAgain,
  onOpenShop,
  onMainMenu,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-md animate-in fade-in zoom-in-95 duration-200">
      <div className="glass-panel w-full max-w-sm rounded-3xl p-5 sm:p-6 text-center border border-fuchsia-500/40 shadow-2xl flex flex-col">
        {isNewRecord && (
          <div className="mx-auto mb-2 px-3.5 py-1 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 text-xs font-black uppercase font-cyber tracking-wider animate-bounce shadow-lg shadow-amber-400/30">
            🏆 KỶ LỤC MỚI ĐƯỢC THIẾT LẬP!
          </div>
        )}

        <h2 className="text-2xl sm:text-3xl font-black text-white font-cyber uppercase neon-glow-pink">
          {reason === 'timeup' ? 'HẾT GIỜ TỬ CHIẾN!' : 'VA CHẠM NĂNG LƯỢNG!'}
        </h2>
        <p className="text-xs text-slate-300 mt-0.5">
          {reason === 'timeup'
            ? '60 giây nghẹt thở vừa khép lại! Phản xạ xuất sắc!'
            : 'Mẹo: Dùng Lướt Phá (⚡) hoặc Bão Từ (💥) để thoát hiểm!'}
        </p>

        {/* Score block */}
        <div className="my-4 py-3.5 px-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-inner">
          <p className="text-[11px] uppercase tracking-widest text-slate-400 font-bold font-cyber">
            Điểm Đạt Được
          </p>
          <p className="text-4xl sm:text-5xl font-black text-cyan-300 font-cyber neon-glow-cyan tabular-nums my-1">
            {Math.floor(score).toLocaleString('vi-VN')}
          </p>
          <div className="grid grid-cols-3 gap-2 mt-2 pt-2.5 border-t border-slate-800 text-xs font-bold">
            <div className="text-center">
              <span className="block text-[10px] text-slate-400">Thu Thập</span>
              <span className="text-amber-300">💎 +{shardsEarned}</span>
            </div>
            <div className="text-center border-x border-slate-800">
              <span className="block text-[10px] text-slate-400">Combo Đỉnh</span>
              <span className="text-fuchsia-300">x{maxCombo}</span>
            </div>
            <div className="text-center">
              <span className="block text-[10px] text-slate-400">Né Sát Nút</span>
              <span className="text-emerald-300">⚡ {nearMisses}</span>
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div className="space-y-2.5">
          <button
            type="button"
            onClick={() => {
              sound.playSound('click');
              onPlayAgain();
            }}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-cyan-400 via-fuchsia-500 to-amber-400 text-slate-950 font-black text-base uppercase font-cyber tracking-wider btn-cyber animate-glow shadow-xl"
          >
            🚀 CHƠI LẠI NGAY
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                sound.playSound('click');
                onOpenShop();
              }}
              className="py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-amber-300 font-bold text-xs flex items-center justify-center gap-1.5 btn-cyber font-cyber"
            >
              <span>🛠️</span> Xưởng Chiến Hạm
            </button>
            <button
              type="button"
              onClick={() => {
                sound.playSound('click');
                onMainMenu();
              }}
              className="py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 font-bold text-xs flex items-center justify-center gap-1.5 btn-cyber font-cyber"
            >
              <span>🏠</span> Sảnh Chính
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
