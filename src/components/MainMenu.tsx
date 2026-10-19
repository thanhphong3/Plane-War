import React from 'react';
import { GameMode, SaveData, ShipDef } from '../types/game';
import { SHIPS, UPGRADES } from '../utils/constants';
import { sound } from '../utils/audio';

interface MainMenuProps {
  saveData: SaveData;
  gameMode: GameMode;
  onSelectMode: (mode: GameMode) => void;
  onStartGame: () => void;
  onOpenShop: () => void;
  onOpenAchievements: () => void;
  isMuted: boolean;
  isBgmMuted: boolean;
  onToggleMute: () => void;
  onToggleBgm: () => void;
}

export const MainMenu: React.FC<MainMenuProps> = ({
  saveData,
  gameMode,
  onSelectMode,
  onStartGame,
  onOpenShop,
  onOpenAchievements,
  isMuted,
  isBgmMuted,
  onToggleMute,
  onToggleBgm,
}) => {
  const currentShip: ShipDef =
    SHIPS.find((s) => s.id === saveData.selectedShip) || SHIPS[0];

  // Check if player has enough shards to buy any upgrade or ship
  const canAffordSomething =
    SHIPS.some((s) => !saveData.unlockedShips.includes(s.id) && saveData.shards >= s.cost) ||
    UPGRADES.some((u) => {
      const lvl = saveData.upgrades[u.id] || 0;
      const cost = Math.round(u.baseCost * Math.pow(1.5, lvl));
      return lvl < u.maxLevel && saveData.shards >= cost;
    });

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-3 sm:p-5 bg-slate-950/75 backdrop-blur-md">
      <div className="glass-panel w-full max-w-md rounded-3xl p-5 sm:p-6 flex flex-col max-h-[92vh] custom-scroll border border-cyan-500/30 shadow-2xl">
        {/* Header Bar */}
        <div className="flex items-center justify-between mb-2">
          <span className="px-2.5 py-1 rounded-full text-[10px] sm:text-[11px] font-black uppercase tracking-wider bg-cyan-500/15 text-cyan-300 border border-cyan-400/30 font-cyber">
            ⚡ Phản Xạ 1 Ngón Mượt Mà
          </span>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-400/40 text-amber-300 text-xs font-bold">
              <span>💎</span>
              <span className="tabular-nums font-mono font-bold">{saveData.shards.toLocaleString('vi-VN')}</span>
            </div>

            <button
              type="button"
              onClick={onToggleBgm}
              title="Bật/Tắt Nhạc Nền Synth"
              className="w-8 h-8 rounded-full bg-slate-800/90 border border-slate-700 flex items-center justify-center text-xs btn-cyber"
            >
              {isBgmMuted ? '🎵❌' : '🎵'}
            </button>

            <button
              type="button"
              onClick={onToggleMute}
              title="Bật/Tắt Hiệu Ứng Âm Thanh"
              className="w-8 h-8 rounded-full bg-slate-800/90 border border-slate-700 flex items-center justify-center text-xs btn-cyber"
            >
              {isMuted ? '🔇' : '🔊'}
            </button>
          </div>
        </div>

        {/* Title */}
        <div className="text-center my-2">
          <h1 className="text-4xl sm:text-5xl font-black italic tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-fuchsia-400 to-amber-300 font-cyber neon-glow-cyan leading-none py-1">
            NEON BLITZ
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 font-medium mt-1">
            Lướt Siêu Tốc • Né Sát Nút • Kích Hoạt Cuồng Nộ
          </p>
        </div>

        {/* Record Stats */}
        <div className="grid grid-cols-3 gap-2 my-2.5 bg-slate-900/80 p-2.5 rounded-2xl border border-slate-800 shadow-inner">
          <div className="text-center">
            <p className="text-[10px] uppercase text-slate-400 font-bold font-cyber">Vô Tận</p>
            <p className="text-base sm:text-lg font-black text-cyan-300 tabular-nums font-mono">
              {saveData.bestEndless.toLocaleString('vi-VN')}
            </p>
          </div>
          <div className="text-center border-x border-slate-800">
            <p className="text-[10px] uppercase text-slate-400 font-bold font-cyber">Tử Chiến 60s</p>
            <p className="text-base sm:text-lg font-black text-fuchsia-300 tabular-nums font-mono">
              {saveData.bestTimed.toLocaleString('vi-VN')}
            </p>
          </div>
          <div className="text-center">
            <p className="text-[10px] uppercase text-slate-400 font-bold font-cyber">Combo Đỉnh</p>
            <p className="text-base sm:text-lg font-black text-amber-300 tabular-nums font-mono">
              x{saveData.bestCombo}
            </p>
          </div>
        </div>

        {/* Mode Selector Tabs */}
        <div className="mb-3">
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 font-cyber">
            Chọn Chế Độ Chơi
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => {
                sound.playSound('click');
                onSelectMode('endless');
              }}
              className={`py-2 px-2 rounded-xl border text-xs flex flex-col items-center gap-0.5 btn-cyber ${
                gameMode === 'endless'
                  ? 'border-2 border-cyan-400 bg-cyan-500/20 text-white font-bold shadow-md shadow-cyan-500/20'
                  : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:text-slate-200'
              }`}
            >
              <span className="text-base">🔥</span>
              <span className="font-bold">Vô Tận</span>
              <span className="text-[10px] text-cyan-200">Tăng tốc dần</span>
            </button>

            <button
              type="button"
              onClick={() => {
                sound.playSound('click');
                onSelectMode('timed');
              }}
              className={`py-2 px-2 rounded-xl border text-xs flex flex-col items-center gap-0.5 btn-cyber ${
                gameMode === 'timed'
                  ? 'border-2 border-fuchsia-400 bg-fuchsia-500/20 text-white font-bold shadow-md shadow-fuchsia-500/20'
                  : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:text-slate-200'
              }`}
            >
              <span className="text-base">⏱️</span>
              <span className="font-bold">Tử Chiến 60s</span>
              <span className="text-[10px] text-fuchsia-200">Đua điểm gấp</span>
            </button>

            <button
              type="button"
              onClick={() => {
                sound.playSound('click');
                onSelectMode('hardcore');
              }}
              className={`py-2 px-2 rounded-xl border text-xs flex flex-col items-center gap-0.5 btn-cyber ${
                gameMode === 'hardcore'
                  ? 'border-2 border-amber-400 bg-amber-500/20 text-white font-bold shadow-md shadow-amber-500/20'
                  : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:text-slate-200'
              }`}
            >
              <span className="text-base">💀</span>
              <span className="font-bold">Siêu Khó</span>
              <span className="text-[10px] text-amber-300">x2 Tinh Thể</span>
            </button>
          </div>
        </div>

        {/* Current Ship Preview Badge */}
        <div
          onClick={onOpenShop}
          className="mb-3 p-2.5 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 cursor-pointer flex items-center justify-between gap-3 btn-cyber"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0 border"
              style={{
                backgroundColor: `${currentShip.color}20`,
                borderColor: `${currentShip.color}60`,
                color: currentShip.color,
              }}
            >
              {currentShip.icon}
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-400 uppercase font-cyber">Chiến hạm xuất kích</p>
              <p className="text-sm font-black text-white truncate">{currentShip.name}</p>
            </div>
          </div>
          <span className="text-[11px] font-bold text-cyan-300 shrink-0 flex items-center gap-1">
            Đổi <span>➔</span>
          </span>
        </div>

        {/* Quick Instructions */}
        <div className="bg-slate-900/60 rounded-2xl p-2.5 sm:p-3 border border-slate-800/80 mb-3 text-xs text-slate-300 space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-lg bg-cyan-500/20 text-cyan-300 flex items-center justify-center font-bold shrink-0 text-xs">
              👆
            </span>
            <span>
              <strong className="text-white">Chạm & Kéo bất kỳ đâu</strong> để lái chiến hạm mượt mà (ngón tay không che tầm nhìn).
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-lg bg-fuchsia-500/20 text-fuchsia-300 flex items-center justify-center font-bold shrink-0 text-xs">
              ⚡
            </span>
            <span>
              <strong className="text-white">Chạm đúp (Double-Tap)</strong> hoặc bấm nút <strong className="text-cyan-300">LƯỚT PHÁ</strong> để húc nổ kẻ địch!
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-lg bg-amber-500/20 text-amber-300 flex items-center justify-center font-bold shrink-0 text-xs">
              🔥
            </span>
            <span>
              <strong className="text-white">Lách sát vật cản</strong> để kích hoạt <em>Né Sát Nút</em>, tăng Combo và bật <strong className="text-amber-300">Cuồng Nộ Bất Tử</strong>!
            </span>
          </div>
        </div>

        {/* CTAs */}
        <div className="flex flex-col gap-2 mt-auto">
          <button
            type="button"
            onClick={() => {
              sound.playSound('click');
              onStartGame();
            }}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-cyan-400 via-fuchsia-500 to-amber-400 text-slate-950 font-black text-base sm:text-lg tracking-wider uppercase font-cyber btn-cyber animate-glow shadow-xl"
          >
            🚀 BẮT ĐẦU CHƠI NGAY
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                sound.playSound('click');
                onOpenShop();
              }}
              className="relative py-2.5 rounded-2xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 text-slate-100 font-bold text-xs flex items-center justify-center gap-1.5 btn-cyber font-cyber"
            >
              <span>🛠️</span>
              <span>Xưởng Chiến Hạm</span>
              {canAffordSomething && (
                <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                sound.playSound('click');
                onOpenAchievements();
              }}
              className="py-2.5 rounded-2xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 text-amber-300 font-bold text-xs flex items-center justify-center gap-1.5 btn-cyber font-cyber"
            >
              <span>🏆</span>
              <span>Thành Tựu</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
