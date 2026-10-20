import React, { useState } from 'react';
import { Check, Lock, Star, X } from 'lucide-react';
import { SaveData, ShipDef } from '../types/game';
import { tr } from '../i18n';
import { localShip, localUpgrade, masteryRewardLabel, skinName } from '../i18n/content';
import {
  MASTERY_REWARDS,
  MASTERY_XP,
  MAX_MASTERY,
  SHIPS,
  SHIP_SKINS,
  UPGRADES,
  masteryLevel,
  paintedShip,
  upgradeCost,
} from '../utils/constants';
import { sound } from '../utils/audio';
import { Icon, ShardIcon } from './Icon';
import { ShipPreview } from './ShipPreview';

interface ShopModalProps {
  isOpen: boolean;
  onClose: () => void;
  saveData: SaveData;
  onUpdateSave: (newSave: SaveData) => void;
  onShowToast: (msg: string) => void;
}

/** Normalised 0..1 stat values for the comparison bars. */
function shipStats(ship: ShipDef) {
  return [
    { label: tr('Speed', 'Tốc độ'), value: (ship.stats.speed - 0.9) / 0.3 },
    { label: tr('Dash', 'Lướt'), value: (1.1 - ship.stats.dashCd) / 0.3 },
    { label: tr('Graze', 'Sượt'), value: (ship.stats.grazeRadius - 24) / 16 },
    { label: tr('Shards', 'Mảnh'), value: ((ship.stats.shardMultiplier || 1) - 0.9) / 0.65 },
  ];
}

export const ShopModal: React.FC<ShopModalProps> = ({ isOpen, onClose, saveData, onUpdateSave, onShowToast }) => {
  const [tab, setTab] = useState<'ships' | 'upgrades'>('ships');
  if (!isOpen) return null;

  const handleSelectOrBuyShip = (ship: ShipDef) => {
    if (saveData.unlockedShips.includes(ship.id)) {
      if (saveData.selectedShip === ship.id) return;
      sound.playSound('click');
      onUpdateSave({ ...saveData, selectedShip: ship.id });
      onShowToast(tr(`${ship.name} equipped`, `Đã trang bị ${ship.name}`));
    } else if (saveData.shards >= ship.cost) {
      sound.playSound('powerup');
      onUpdateSave({
        ...saveData,
        shards: saveData.shards - ship.cost,
        unlockedShips: [...saveData.unlockedShips, ship.id],
        selectedShip: ship.id,
      });
      onShowToast(tr(`Unlocked: ${ship.name}!`, `Đã mở khóa: ${ship.name}!`));
    } else {
      sound.playSound('click');
      const missing = (ship.cost - saveData.shards).toLocaleString('en-US');
      onShowToast(tr(`Need ${missing} more shards`, `Cần thêm ${missing} mảnh`));
    }
  };

  const handleSkin = (ship: ShipDef, idx: number) => {
    if ((saveData.shipSkin[ship.id] || 0) === idx) return;
    sound.playSound('click');
    onUpdateSave({ ...saveData, shipSkin: { ...saveData.shipSkin, [ship.id]: idx } });
  };

  const handleUpgrade = (upgradeId: keyof SaveData['upgrades']) => {
    const found = UPGRADES.find((u) => u.id === upgradeId);
    if (!found) return;
    const def = localUpgrade(found);
    const currentLevel = saveData.upgrades[upgradeId] || 0;
    if (currentLevel >= def.maxLevel) return;

    const cost = upgradeCost(def.baseCost, currentLevel);
    if (saveData.shards >= cost) {
      sound.playSound('powerup');
      onUpdateSave({
        ...saveData,
        shards: saveData.shards - cost,
        upgrades: { ...saveData.upgrades, [upgradeId]: currentLevel + 1 },
      });
      onShowToast(tr(`${def.name} upgraded to Lv.${currentLevel + 1}!`, `${def.name} đã lên Lv.${currentLevel + 1}!`));
    } else {
      sound.playSound('click');
      const missing = (cost - saveData.shards).toLocaleString('en-US');
      onShowToast(tr(`Need ${missing} more shards`, `Cần thêm ${missing} mảnh`));
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-md anim-fade">
      <div className="glass-panel w-full max-w-lg rounded-3xl p-4 sm:p-6 flex flex-col max-h-[94vh] anim-pop panel-glow">
        {/* Header */}
        <div className="flex items-center justify-between pb-3">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-white font-cyber tracking-wide">{tr('HANGAR', 'XƯỞNG TÀU')}</h2>
            <p className="text-xs text-slate-400">
              {tr('Unlock ships and upgrade your systems with Neon Shards', 'Mở khóa tàu và nâng cấp hệ thống bằng Mảnh Neon')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-200 text-sm font-black">
              <ShardIcon size={14} />
              <span className="tabular-nums">{saveData.shards.toLocaleString('en-US')}</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={tr('Close', 'Đóng')}
              className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center btn-cyber border border-slate-700"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-slate-900/80 border border-slate-800">
          {(['ships', 'upgrades'] as const).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                sound.playSound('click');
                setTab(id);
              }}
              className={`py-2 rounded-lg text-xs font-black uppercase tracking-wider font-cyber btn-cyber ${
                tab === id ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/50' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {id === 'ships' ? tr('Ships', 'Tàu') : tr('Upgrades', 'Nâng cấp')}
            </button>
          ))}
        </div>

        <div className="custom-scroll flex-1 py-3 pr-1 space-y-2.5">
          {tab === 'ships' &&
            SHIPS.map(localShip).map((ship) => {
              const isUnlocked = saveData.unlockedShips.includes(ship.id);
              const isSelected = saveData.selectedShip === ship.id;
              const canAfford = saveData.shards >= ship.cost;
              const painted = paintedShip(ship, saveData);
              const xp = saveData.shipXp[ship.id] || 0;
              const mLvl = masteryLevel(xp);
              const mNext = mLvl < MAX_MASTERY ? MASTERY_XP[mLvl + 1] : 0;
              const mFloor = MASTERY_XP[mLvl];
              const skins = SHIP_SKINS[ship.id] || [];
              const skinIdx = saveData.shipSkin[ship.id] || 0;

              return (
                <div
                  key={ship.id}
                  className={`p-3 rounded-2xl border transition-all ${
                    isSelected ? 'bg-slate-900/90 shadow-lg' : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                  }`}
                  style={isSelected ? { borderColor: `${ship.color}aa`, boxShadow: `0 0 24px ${ship.color}22` } : undefined}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="relative shrink-0 w-16 h-16 rounded-2xl flex items-center justify-center border"
                      style={{ backgroundColor: `${ship.color}12`, borderColor: `${ship.color}40` }}
                    >
                      <ShipPreview ship={painted} size={60} locked={!isUnlocked} animate={isSelected} />
                      {!isUnlocked && <Lock size={14} className="absolute bottom-1 right-1 text-slate-400" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-black font-cyber" style={{ color: ship.color }}>
                          {ship.name}
                        </span>
                        <span
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full border"
                          style={{ color: ship.color, borderColor: `${ship.color}50`, backgroundColor: `${ship.color}15` }}
                        >
                          {ship.perk}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5 leading-snug">{ship.desc}</p>
                      <p className="text-[11px] mt-1 leading-snug font-semibold" style={{ color: ship.color }}>
                        {ship.weapon}
                      </p>
                      <div className="grid grid-cols-4 gap-1.5 mt-2">
                        {shipStats(ship).map((s) => (
                          <div key={s.label}>
                            <div className="h-1 rounded-full bg-slate-800 overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${Math.max(12, Math.min(100, s.value * 100))}%`,
                                  backgroundColor: ship.color,
                                }}
                              />
                            </div>
                            <span className="text-[9px] text-slate-500 uppercase tracking-wide">{s.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {isUnlocked && (
                    <div className="mt-2.5 p-2 rounded-xl bg-slate-950/60 border border-slate-800">
                      <div className="flex items-center justify-between text-[10px] font-bold">
                        <span className="flex items-center gap-1" style={{ color: painted.color }}>
                          <Star size={11} fill="currentColor" /> {tr('Mastery', 'Thông thạo')} {mLvl}/{MAX_MASTERY}
                        </span>
                        <span className="text-slate-400 tabular-nums">
                          {mNext
                            ? `${(xp - mFloor).toLocaleString('en-US')}/${(mNext - mFloor).toLocaleString('en-US')} XP`
                            : tr('Maxed', 'Tối đa')}
                        </span>
                      </div>
                      <div className="mt-1 h-1 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${mNext ? ((xp - mFloor) / (mNext - mFloor)) * 100 : 100}%`,
                            backgroundColor: painted.color,
                          }}
                        />
                      </div>
                      {mNext > 0 && (
                        <p className="mt-1 text-[10px] text-slate-400">
                          {tr('Next', 'Tiếp theo')}: {masteryRewardLabel(MASTERY_REWARDS[mLvl], mLvl)}
                        </p>
                      )}
                      <div className="mt-1.5 flex items-center gap-1.5">
                        {skins.map((skin, idx) => {
                          const open = mLvl >= skin.level;
                          const on = skinIdx === idx && open;
                          return (
                            <button
                              key={skin.name}
                              type="button"
                              disabled={!open}
                              onClick={() => handleSkin(ship, idx)}
                              title={open ? skinName(skin.name) : `${tr('Mastery', 'Thông thạo')} ${skin.level}`}
                              className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] font-bold btn-cyber ${
                                on ? 'border-white/70 text-white' : 'border-slate-700 text-slate-400'
                              } ${open ? 'hover:border-slate-500' : 'opacity-50 cursor-not-allowed'}`}
                            >
                              <span
                                className="w-3 h-3 rounded-full border border-white/40"
                                style={{ background: `linear-gradient(135deg, ${skin.color}, ${skin.secondary})` }}
                              />
                              {open ? skinName(skin.name) : <><Lock size={9} /> {skin.level}</>}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => handleSelectOrBuyShip(ship)}
                    className={`mt-2.5 w-full py-2 rounded-xl font-bold text-xs btn-cyber flex items-center justify-center gap-1.5 ${
                      isSelected
                        ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-400/40 cursor-default'
                        : isUnlocked
                        ? 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700'
                        : canAfford
                        ? 'bg-gradient-to-r from-amber-300 to-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/25'
                        : 'bg-slate-900 text-slate-500 border border-slate-800'
                    }`}
                  >
                    {isSelected ? (
                      <>
                        <Check size={14} /> {tr('Equipped', 'Đang dùng')}
                      </>
                    ) : isUnlocked ? (
                      tr('Equip', 'Trang bị')
                    ) : (
                      <>
                        {tr('Unlock for', 'Mở khóa với')} <Icon name="gem" size={12} /> {ship.cost.toLocaleString('en-US')}
                      </>
                    )}
                  </button>
                </div>
              );
            })}

          {tab === 'upgrades' &&
            UPGRADES.map(localUpgrade).map((upgrade) => {
              const currentLevel = saveData.upgrades[upgrade.id] || 0;
              const isMax = currentLevel >= upgrade.maxLevel;
              const cost = upgradeCost(upgrade.baseCost, currentLevel);
              const canAfford = saveData.shards >= cost;

              return (
                <div
                  key={upgrade.id}
                  className="p-3 rounded-2xl bg-slate-900/70 border border-slate-800 flex items-center justify-between gap-3"
                >
                  <div className="w-10 h-10 shrink-0 rounded-xl bg-fuchsia-500/15 border border-fuchsia-400/30 text-fuchsia-300 flex items-center justify-center">
                    <Icon name={upgrade.icon} size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-black text-white">{upgrade.name}</p>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/30">
                        Lv.{currentLevel}/{upgrade.maxLevel}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{upgrade.desc}</p>
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
                    className={`shrink-0 min-w-[72px] px-3 py-2 rounded-xl font-bold text-xs btn-cyber flex items-center justify-center gap-1 ${
                      isMax
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 cursor-default'
                        : canAfford
                        ? 'bg-fuchsia-500 hover:bg-fuchsia-400 text-white font-black shadow-lg shadow-fuchsia-500/25'
                        : 'bg-slate-900 text-slate-500 border border-slate-800'
                    }`}
                  >
                    {isMax ? (
                      'MAX'
                    ) : (
                      <>
                        <Icon name="gem" size={12} /> {cost.toLocaleString('en-US')}
                      </>
                    )}
                  </button>
                </div>
              );
            })}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-1 w-full py-3 rounded-2xl btn-primary text-slate-950 font-black text-sm uppercase font-cyber tracking-wider btn-cyber"
        >
          {tr('Done', 'Xong')}
        </button>
      </div>
    </div>
  );
};
