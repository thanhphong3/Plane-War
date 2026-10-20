import React from 'react';
import { Bomb, Flame, House, Music, Pause, Play, RotateCcw, Settings, Volume2, VolumeX, Zap } from 'lucide-react';
import { tr } from '../i18n';
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
  onOpenSettings: () => void;
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
  onOpenSettings,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md anim-fade">
      <div className="glass-panel w-full max-w-xs rounded-3xl p-6 text-center space-y-4 anim-pop panel-glow">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-cyan-500/15 border border-cyan-400/40 text-cyan-300 flex items-center justify-center">
          <Pause size={26} />
        </div>
        <div>
          <h2 className="text-2xl font-black text-white font-cyber tracking-[0.2em]">{tr('PAUSED', 'TẠM DỪNG')}</h2>
          <p className="text-xs text-slate-400 mt-1">
            {tr('Shake out your fingers, pilot. The grid will wait.', 'Thả lỏng ngón tay đi, phi công. Lưới sẽ chờ bạn.')}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 bg-slate-900/80 p-2 rounded-2xl border border-slate-800">
          <button
            type="button"
            onClick={onToggleMute}
            className="flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 btn-cyber border border-slate-700"
          >
            {isMuted ? <VolumeX size={14} className="text-rose-300" /> : <Volume2 size={14} />}
            <span>{isMuted ? tr('Sound Off', 'Âm thanh: Tắt') : tr('Sound On', 'Âm thanh: Bật')}</span>
          </button>
          <button
            type="button"
            onClick={onToggleBgm}
            className="flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 btn-cyber border border-slate-700"
          >
            <Music size={14} className={isBgmMuted ? 'opacity-40' : ''} />
            <span>{isBgmMuted ? tr('Music Off', 'Nhạc: Tắt') : tr('Music On', 'Nhạc: Bật')}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              sound.playSound('click');
              onOpenSettings();
            }}
            className="col-span-2 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 btn-cyber border border-slate-700"
          >
            <Settings size={14} />
            <span>{tr('Settings · volume, flashing, controls', 'Cài đặt · âm lượng, nhấp nháy, điều khiển')}</span>
          </button>
        </div>

        {/* Ability cheat sheet: pausing is when players actually read */}
        <div className="text-left text-[11px] text-slate-300 bg-slate-900/80 p-3 rounded-2xl border border-slate-800 space-y-2">
          <div className="flex items-start gap-2">
            <Zap size={14} className="text-cyan-300 shrink-0 mt-0.5" />
            <span>
              <strong className="text-cyan-200">{tr('DASH', 'LƯỚT')}</strong>{' '}
              {tr(
                '(double-tap / Space): a short burst where nothing can hurt you. Ram enemies to smash them, ram Plasma Cores to fire them back, snap boss tethers. ~2s recharge.',
                '(chạm đúp / Space): lao vút trong chốc lát, không gì làm hại được bạn. Húc nát kẻ địch, húc Lõi Plasma để bắn ngược lại, bẻ gãy dây nối của boss. Hồi chiêu ~2s.'
              )}
            </span>
          </div>
          <div className="flex items-start gap-2">
            <Bomb size={14} className="text-amber-300 shrink-0 mt-0.5" />
            <span>
              <strong className="text-amber-200">EMP</strong>{' '}
              {tr(
                '(E): clears the screen and turns enemies into shards. Limited charges.',
                '(E): quét sạch màn hình và biến kẻ địch thành mảnh. Số lượng có hạn.'
              )}
            </span>
          </div>
          <div className="flex items-start gap-2">
            <Flame size={14} className="text-fuchsia-300 shrink-0 mt-0.5" />
            <span>
              <strong className="text-fuchsia-200">{tr('OVERDRIVE', 'QUÁ TẢI')}</strong>
              {tr(
                ': fill Energy with near-misses. While it lasts you act like a non-stop Dash.',
                ': nạp Năng lượng bằng cách né sát. Trong lúc kích hoạt, bạn như đang Lướt liên tục.'
              )}
            </span>
          </div>
        </div>

        <div className="space-y-2.5 pt-1">
          <button
            type="button"
            onClick={() => {
              sound.playSound('click');
              onResume();
            }}
            className="w-full py-3 rounded-2xl bg-gradient-to-r from-cyan-300 to-cyan-500 text-slate-950 font-black text-sm uppercase font-cyber btn-cyber shadow-lg shadow-cyan-500/25 flex items-center justify-center gap-2"
          >
            <Play size={16} fill="currentColor" /> {tr('Resume', 'Tiếp tục')}
          </button>
          <button
            type="button"
            onClick={() => {
              sound.playSound('click');
              onRestart();
            }}
            className="w-full py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs uppercase font-cyber border border-slate-700 btn-cyber flex items-center justify-center gap-2"
          >
            <RotateCcw size={14} /> {tr('Restart', 'Chơi lại')}
          </button>
          <button
            type="button"
            onClick={() => {
              sound.playSound('click');
              onMainMenu();
            }}
            className="w-full py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 font-semibold text-xs border border-slate-800 btn-cyber flex items-center justify-center gap-2"
          >
            <House size={14} /> {tr('Main Menu', 'Menu chính')}
          </button>
        </div>
      </div>
    </div>
  );
};
