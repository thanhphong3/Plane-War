import React from 'react';
import { SaveData } from '../types/game';
import { SHIPS, UPGRADES } from '../utils/constants';
import { sound } from '../utils/audio';

interface ShopModalProps {
  isOpen: boolean;
  onClose: () => void;
  saveData: SaveData;
  onUpdateSave: (newSave: SaveData) => void;
  onShowToast: (msg: string) => void;
}

export const ShopModal: React.FC<ShopModalProps> = ({
  isOpen,
  onClose,
  saveData,
  onUpdateSave,
  onShowToast,
}) => {
  if (!isOpen) return null;

  const handleSelectOrBuyShip = (shipId: string) => {
    const ship = SHIPS.find((s) => s.id === shipId);
    if (!ship) return;

    if (saveData.unlockedShips.includes(shipId)) {
      sound.playSound('click');
      const updated = { ...saveData, selectedShip: shipId };
      onUpdateSave(updated);
      onShowToast(`Đã trang bị phi thuyền: ${ship.name}`);
    } else if (saveData.shards >= ship.cost) {
      sound.playSound('powerup');
      const updated: SaveData = {
        ...saveData,
        shards: saveData.shards - ship.cost,
        unlockedShips: [...saveData.unlockedShips, shipId],
        selectedShip: shipId,
      };
      onUpdateSave(updated);
      onShowToast(`🎉 Mở khóa thành công: ${ship.name}!`);
    } else {
      sound.playSound('click');
      onShowToast(`Cần thêm ${(ship.cost - saveData.shards).toLocaleString()} 💎 để mở khóa!`);
    }
  };

  const handleUpgrade = (upgradeId: keyof SaveData['upgrades']) => {
    const def = UPGRADES.find((u) => u.id === upgradeId);
    if (!def) return;

    const currentLevel = saveData.upgrades[upgradeId] || 0;
    if (currentLevel >= def.maxLevel) return;

    const cost = Math.round(def.baseCost * Math.pow(1.5, currentLevel));
    if (saveData.shards >= cost) {
      sound.playSound('powerup');
      const updated: SaveData = {
        ...saveData,
        shards: saveData.shards - cost,
        upgrades: {
          ...saveData.upgrades,
          [upgradeId]: currentLevel + 1,
        },
      };
      onUpdateSave(updated);
      onShowToast(`🚀 Nâng cấp thành công: ${def.name} lên Cấp ${currentLevel + 1}!`);
    } else {
      sound.playSound('click');
      onShowToast(`Chưa đủ Tinh Thể! Cần thêm ${(cost - saveData.shards).toLocaleString()} 💎.`);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="glass-panel w-full max-w-lg rounded-3xl p-4 sm:p-6 flex flex-col max-h-[92vh] border border-cyan-500/30 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-white font-cyber flex items-center gap-2">
              <span className="text-cyan-400">⚡</span> XƯỞNG CHIẾN HẠM
            </h2>
            <p className="text-xs text-slate-400">Nâng cấp và mở khóa phi thuyền chiến đấu bằng Tinh Thể Neon</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-xs sm:text-sm font-black">
              <span>💎</span>
              <span className="tabular-nums font-mono">{saveData.shards.toLocaleString('vi-VN')}</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-sm flex items-center justify-center btn-cyber border border-slate-700"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content list */}
        <div className="custom-scroll flex-1 py-3 space-y-5 pr-1">
          {/* Ships section */}
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-cyan-300 font-cyber mb-2.5 flex items-center gap-1.5">
              <span>🚀</span> Danh Sách Phi Thuyền Siêu Tốc
            </h3>
            <div className="space-y-2.5">
              {SHIPS.map((ship) => {
                const isUnlocked = saveData.unlockedShips.includes(ship.id);
                const isSelected = saveData.selectedShip === ship.id;

                return (
                  <div
                    key={ship.id}
                    className={`p-3 rounded-2xl border transition-all ${
                      isSelected
                        ? 'bg-cyan-950/40 border-cyan-400/80 shadow-md shadow-cyan-500/10'
                        : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl shrink-0 border"
                          style={{
                            backgroundColor: `${ship.color}20`,
                            borderColor: `${ship.color}60`,
                            color: ship.color,
                          }}
                        >
                          {ship.icon}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-black text-white">{ship.name}</span>
                            <span
                              className="text-[10px] font-bold px-2 py-0.5 rounded-full border"
                              style={{
                                color: ship.color,
                                borderColor: `${ship.color}50`,
                                backgroundColor: `${ship.color}15`,
                              }}
                            >
                              {ship.perk}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5 leading-snug">{ship.desc}</p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleSelectOrBuyShip(ship.id)}
                        className={`shrink-0 px-3.5 py-2 rounded-xl font-bold text-xs btn-cyber ${
                          isSelected
                            ? 'bg-cyan-400/20 text-cyan-300 border border-cyan-400/60 cursor-default'
                            : isUnlocked
                            ? 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700'
                            : saveData.shards >= ship.cost
                            ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/20'
                            : 'bg-slate-900 text-slate-500 border border-slate-800 cursor-not-allowed'
                        }`}
                      >
                        {isSelected ? 'Đang Dùng' : isUnlocked ? 'Trang Bị' : `💎 ${ship.cost}`}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Upgrades section */}
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-fuchsia-300 font-cyber mb-2.5 flex items-center gap-1.5">
              <span>🛠️</span> Nâng Cấp Hệ Thống Chiến Đấu
            </h3>
            <div className="space-y-2.5">
              {UPGRADES.map((upgrade) => {
                const currentLevel = saveData.upgrades[upgrade.id] || 0;
                const isMax = currentLevel >= upgrade.maxLevel;
                const cost = Math.round(upgrade.baseCost * Math.pow(1.5, currentLevel));
                const canAfford = saveData.shards >= cost;

                return (
                  <div
                    key={upgrade.id}
                    className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{upgrade.icon}</span>
                        <p className="text-sm font-black text-white">{upgrade.name}</p>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/30">
                          Lv.{currentLevel}/{upgrade.maxLevel}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">{upgrade.desc}</p>
                      {/* Level gauge dots */}
                      <div className="flex items-center gap-1 mt-1.5">
                        {Array.from({ length: upgrade.maxLevel }).map((_, idx) => (
                          <div
                            key={idx}
                            className={`h-1.5 flex-1 rounded-full transition-colors ${
                              idx < currentLevel ? 'bg-fuchsia-400 shadow-sm shadow-fuchsia-500/50' : 'bg-slate-800'
                            }`}
                          />
                        ))}
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={isMax}
                      onClick={() => handleUpgrade(upgrade.id)}
                      className={`shrink-0 px-3.5 py-2 rounded-xl font-bold text-xs btn-cyber ${
                        isMax
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 cursor-default'
                          : canAfford
                          ? 'bg-fuchsia-500 hover:bg-fuchsia-400 text-white font-black shadow-lg shadow-fuchsia-500/20'
                          : 'bg-slate-900 text-slate-500 border border-slate-800 cursor-not-allowed'
                      }`}
                    >
                      {isMax ? 'Tối Đa' : `💎 ${cost}`}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <button
          type="button"
          onClick={onClose}
          className="mt-3 w-full py-3 rounded-2xl bg-gradient-to-r from-cyan-400 via-fuchsia-500 to-amber-400 text-slate-950 font-black text-sm uppercase font-cyber tracking-wider btn-cyber shadow-lg"
        >
          Xác Nhận & Quay Lại Sảnh Chính
        </button>
      </div>
    </div>
  );
};
