import React from 'react';
import { Eye, Hand, Music, Smartphone, Vibrate, Volume2, X } from 'lucide-react';
import { tr, useLang } from '../i18n';
import { GameSettings } from '../types/game';
import { sound } from '../utils/audio';
import { DEFAULT_SETTINGS } from '../utils/constants';

interface SettingsModalProps {
  isOpen: boolean;
  settings: GameSettings;
  onChange: (patch: Partial<GameSettings>) => void;
  onClose: () => void;
}

const Slider: React.FC<{
  label: string;
  icon: React.ReactNode;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (v: number) => void;
}> = ({ label, icon, value, min, max, step, display, onChange }) => (
  <label className="block">
    <span className="flex items-center justify-between text-xs font-bold text-slate-200">
      <span className="flex items-center gap-1.5">
        {icon}
        {label}
      </span>
      <span className="text-cyan-200 tabular-nums font-cyber text-[11px]">{display}</span>
    </span>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(evt) => onChange(Number(evt.target.value))}
      className="mt-1.5 w-full accent-cyan-400"
    />
  </label>
);

const Toggle: React.FC<{ label: string; hint: string; icon: React.ReactNode; on: boolean; onToggle: () => void }> = ({
  label,
  hint,
  icon,
  on,
  onToggle,
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={on}
    onClick={onToggle}
    className="w-full flex items-center gap-3 text-left p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 btn-cyber"
  >
    <span className="text-cyan-300 shrink-0">{icon}</span>
    <span className="min-w-0 flex-1">
      <span className="block text-xs font-bold text-slate-100">{label}</span>
      <span className="block text-[10px] text-slate-400 leading-snug">{hint}</span>
    </span>
    <span className={`relative w-10 h-6 shrink-0 rounded-full transition-colors ${on ? 'bg-cyan-400' : 'bg-slate-700'}`}>
      <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${on ? 'left-5' : 'left-1'}`} />
    </span>
  </button>
);

const pct = (v: number) => `${Math.round(v * 100)}%`;

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, settings, onChange, onClose }) => {
  useLang();
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md anim-fade">
      <div className="glass-panel w-full max-w-sm rounded-3xl p-5 sm:p-6 flex flex-col max-h-[94vh] anim-pop panel-glow">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-black text-white font-cyber tracking-wide">{tr('SETTINGS', 'CÀI ĐẶT')}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={tr('Close', 'Đóng')}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center btn-cyber border border-slate-700"
          >
            <X size={16} />
          </button>
        </div>

        <div className="custom-scroll mt-4 space-y-4 pr-1">
          <section className="space-y-3">
            <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold font-cyber">{tr('Audio', 'Âm thanh')}</p>
            <Slider
              label={tr('Sound effects', 'Hiệu ứng âm thanh')}
              icon={<Volume2 size={13} />}
              value={settings.sfxVolume}
              min={0}
              max={1}
              step={0.05}
              display={pct(settings.sfxVolume)}
              onChange={(v) => onChange({ sfxVolume: v })}
            />
            <Slider
              label={tr('Music', 'Nhạc nền')}
              icon={<Music size={13} />}
              value={settings.musicVolume}
              min={0}
              max={1}
              step={0.05}
              display={pct(settings.musicVolume)}
              onChange={(v) => onChange({ musicVolume: v })}
            />
          </section>

          <section className="space-y-3">
            <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold font-cyber">{tr('Controls', 'Điều khiển')}</p>
            <Slider
              label={tr('Drag sensitivity', 'Độ nhạy kéo')}
              icon={<Hand size={13} />}
              value={settings.sensitivity}
              min={0.7}
              max={1.8}
              step={0.02}
              display={`x${settings.sensitivity.toFixed(2)}`}
              onChange={(v) => onChange({ sensitivity: v })}
            />
            <Toggle
              label={tr('Vibration', 'Rung')}
              hint={tr('Haptic feedback on hits, dashes and pickups (phones only).', 'Rung phản hồi khi trúng đòn, lướt và nhặt đồ (chỉ trên điện thoại).')}
              icon={<Vibrate size={16} />}
              on={settings.haptics}
              onToggle={() => {
                onChange({ haptics: !settings.haptics });
                if (!settings.haptics) sound.triggerHaptic(30);
              }}
            />
          </section>

          <section className="space-y-3">
            <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold font-cyber">
              {tr('Comfort & accessibility', 'Thoải mái & trợ năng')}
            </p>
            <Toggle
              label={tr('Reduce flashing', 'Giảm nhấp nháy')}
              hint={tr(
                'Tones down full-screen flashes and stops warning blinks. Recommended if you are sensitive to flashing light.',
                'Giảm chớp toàn màn hình và tắt nhấp nháy cảnh báo. Nên bật nếu bạn nhạy cảm với ánh sáng nhấp nháy.'
              )}
              icon={<Eye size={16} />}
              on={settings.reduceFlash}
              onToggle={() => onChange({ reduceFlash: !settings.reduceFlash })}
            />
            <Slider
              label={tr('Screen shake', 'Rung màn hình')}
              icon={<Smartphone size={13} />}
              value={settings.shake}
              min={0}
              max={1}
              step={0.05}
              display={settings.shake <= 0 ? tr('Off', 'Tắt') : pct(settings.shake)}
              onChange={(v) => onChange({ shake: v })}
            />
          </section>
        </div>

        <div className="grid grid-cols-2 gap-2 mt-5">
          <button
            type="button"
            onClick={() => {
              sound.playSound('click');
              onChange(DEFAULT_SETTINGS);
            }}
            className="py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 font-bold text-xs btn-cyber font-cyber"
          >
            {tr('Reset', 'Mặc định')}
          </button>
          <button
            type="button"
            onClick={() => {
              sound.playSound('click');
              onClose();
            }}
            className="py-2.5 rounded-xl btn-primary text-slate-950 font-black text-xs uppercase font-cyber btn-cyber"
          >
            {tr('Done', 'Xong')}
          </button>
        </div>
      </div>
    </div>
  );
};
