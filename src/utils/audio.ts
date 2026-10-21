export type SoundType =
  | 'gem'
  | 'nearmiss'
  | 'dash'
  | 'powerup'
  | 'fever'
  | 'boom'
  | 'shield_break'
  | 'gameover'
  | 'click'
  | 'hit'
  | 'laser_warn'
  | 'laser_fire'
  | 'boss_alarm'
  | 'boss_down'
  | 'enemy_shot'
  | 'wave'
  | 'block'
  | 'parry'
  | 'key'
  | 'glitch'
  | 'comm'
  | 'perk_pick'
  | 'railgun'
  | 'homing_launch'
  | 'combo'
  | 'elite_down'
  | 'revive'
  | 'snipe_lock'
  | 'snipe'
  | 'lunge';

/** Soundtrack layers: cruising, boss fight, Overdrive. */
export type BgmMode = 'normal' | 'boss' | 'fever';

interface BgmProfile {
  bpm: number;
  bass: number[];
  chords: number[][];
  /** Lead synth low-pass cutoff (Hz). */
  cutoff: number;
}

const BGM: Record<BgmMode, BgmProfile> = {
  // A-minor synthwave: Am - F - C - G (one chord per bar)
  normal: {
    bpm: 128,
    bass: [55, 43.65, 65.41, 49],
    chords: [
      [440, 523.25, 659.25, 880],
      [349.23, 440, 523.25, 698.46],
      [392, 523.25, 659.25, 783.99],
      [392, 493.88, 587.33, 783.99],
    ],
    cutoff: 2600,
  },
  // D-minor tension: Dm - Bb - Gm - A (the major V pulls hard back to Dm)
  boss: {
    bpm: 138,
    bass: [73.42, 58.27, 49, 55],
    chords: [
      [440, 587.33, 698.46, 880],
      [466.16, 587.33, 698.46, 932.33],
      [392, 466.16, 587.33, 783.99],
      [440, 554.37, 659.25, 880],
    ],
    cutoff: 3400,
  },
  // Overdrive: same A-minor loop, faster and wide open
  fever: {
    bpm: 148,
    bass: [55, 43.65, 65.41, 49],
    chords: [
      [440, 523.25, 659.25, 880],
      [349.23, 440, 523.25, 698.46],
      [392, 523.25, 659.25, 783.99],
      [392, 493.88, 587.33, 783.99],
    ],
    cutoff: 7800,
  },
};

const stepDur = (mode: BgmMode) => 60 / BGM[mode].bpm / 4; // 16th note

class SoundManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private bgmBus: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private muted = false;
  private bgmMuted = false;
  private sfxVolume = 0.9;
  private musicVolume = 0.8;
  private haptics = true;
  /** True while the page is hidden and we suspended the context on purpose. */
  private hiddenSuspend = false;

  public isRunning() {
    return !!this.ctx && this.ctx.state === 'running';
  }

  /** Silences everything while the tab / app is in the background (saves battery, no stutter). */
  public setPageHidden(hidden: boolean) {
    this.hiddenSuspend = hidden;
    if (!this.ctx) return;
    if (hidden) {
      this.ctx.suspend().catch(() => {});
    } else {
      this.ctx.resume().catch(() => {});
      // Skip the notes that would have played while hidden
      this.nextStepTime = this.ctx.currentTime + 0.05;
    }
  }

  private wantBgm = false;
  private schedulerId: number | null = null;
  private nextStepTime = 0;
  private step = 0;
  private intensity = 1;
  private bgmMode: BgmMode = 'normal';
  /** Requested layer; swapped in on the next bar line so chords never change mid-bar. */
  private pendingMode: BgmMode = 'normal';

  public setMuted(muted: boolean) {
    this.muted = muted;
    this.applyBgmGain();
  }

  public setBgmMuted(bgmMuted: boolean) {
    this.bgmMuted = bgmMuted;
    this.applyBgmGain();
  }

  /** 0..1 levels from the Settings screen. */
  public setVolumes(sfx: number, music: number) {
    this.sfxVolume = Math.max(0, Math.min(1, sfx));
    this.musicVolume = Math.max(0, Math.min(1, music));
    if (this.ctx && this.sfxBus) this.sfxBus.gain.setTargetAtTime(this.sfxVolume / 0.9, this.ctx.currentTime, 0.05);
    this.applyBgmGain();
  }

  public setHaptics(on: boolean) {
    this.haptics = on;
  }

  public getMuted() {
    return this.muted;
  }

  public getBgmMuted() {
    return this.bgmMuted;
  }

  /** 0 = calm (menu, sparse drums and no lead), 1 = in a run. */
  public setIntensity(level: number) {
    this.intensity = level;
  }

  /** Crossfades the soundtrack between cruising, boss-fight and Overdrive layers at the next bar. */
  public setBgmIntensity(mode: BgmMode) {
    this.pendingMode = mode;
  }

  private applyBgmGain() {
    if (!this.ctx || !this.bgmBus) return;
    const target = this.muted || this.bgmMuted ? 0 : 0.55 * (this.musicVolume / 0.8);
    this.bgmBus.gain.setTargetAtTime(target, this.ctx.currentTime, 0.08);
  }

  public ensureContext(): AudioContext | null {
    try {
      if (!this.ctx) {
        const AudioContextClass =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!AudioContextClass) return null;
        const ctx = new AudioContextClass();
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -14;
        comp.ratio.value = 4;
        this.master = ctx.createGain();
        this.master.gain.value = 0.9;
        this.sfxBus = ctx.createGain();
        this.sfxBus.gain.value = this.sfxVolume / 0.9;
        this.bgmBus = ctx.createGain();
        this.bgmBus.gain.value = 0;
        this.sfxBus.connect(this.master);
        this.bgmBus.connect(this.master);
        this.master.connect(comp);
        comp.connect(ctx.destination);

        const len = Math.floor(ctx.sampleRate * 1.0);
        this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
        const data = this.noise.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

        this.ctx = ctx;
        this.applyBgmGain();
      }
      // iOS reports 'interrupted' after a call / app switch: resume from any non-running state
      // (unless we parked it ourselves because the page is hidden)
      if (this.ctx.state !== 'running' && this.ctx.state !== 'closed' && !this.hiddenSuspend) {
        this.ctx.resume().catch(() => {});
      }
    } catch {
      return null;
    }
    return this.ctx;
  }

  private tone(
    type: OscillatorType,
    f0: number,
    f1: number,
    t: number,
    dur: number,
    vol: number,
    dest: AudioNode
  ) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(f1, t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(dest);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private noiseBurst(
    t: number,
    dur: number,
    vol: number,
    filterType: BiquadFilterType,
    freq: number,
    dest: AudioNode,
    freqEnd?: number
  ) {
    const ctx = this.ctx!;
    if (!this.noise) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true; // bursts longer than the 1 s buffer (boss_down, gameover) used to cut off with a click
    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(freq, t);
    if (freqEnd) filter.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }

  public playSound(type: SoundType, param: number = 1) {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxBus) return;
    const out = this.sfxBus;
    const now = ctx.currentTime;

    try {
      switch (type) {
        case 'click':
          this.tone('sine', 900, 450, now, 0.05, 0.08, out);
          break;

        case 'gem': {
          // Pitch climbs with the combo multiplier
          const base = Math.min(1600, 520 + Math.min(param, 30) * 34);
          this.tone('sine', base, base * 1.5, now, 0.1, 0.11, out);
          this.tone('triangle', base * 2, base * 2.5, now + 0.02, 0.07, 0.04, out);
          break;
        }

        case 'nearmiss':
          this.tone('triangle', 300, 1300, now, 0.16, 0.18, out);
          this.noiseBurst(now, 0.14, 0.12, 'bandpass', 2400, out, 6000);
          break;

        case 'dash':
          this.tone('sawtooth', 140, 760, now, 0.2, 0.16, out);
          this.noiseBurst(now, 0.25, 0.22, 'highpass', 900, out, 4000);
          break;

        case 'hit':
          this.tone('square', 520, 160, now, 0.06, 0.05, out);
          break;

        case 'enemy_shot':
          this.tone('square', 880, 520, now, 0.07, 0.035, out);
          break;

        case 'shield_break':
          this.tone('triangle', 1000, 220, now, 0.24, 0.22, out);
          this.tone('sine', 500, 110, now, 0.24, 0.18, out);
          this.noiseBurst(now, 0.3, 0.2, 'highpass', 3000, out, 800);
          break;

        case 'powerup':
          [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
            this.tone('sine', f, f, now + i * 0.045, 0.16, 0.11, out);
          });
          break;

        case 'wave':
          [392, 523.25, 783.99].forEach((f, i) => {
            this.tone('triangle', f, f, now + i * 0.07, 0.22, 0.12, out);
          });
          break;

        case 'fever':
          [440, 554.37, 659.25, 880, 1108.7].forEach((f, i) => {
            this.tone('sawtooth', f, f, now + i * 0.05, 0.22, 0.1, out);
          });
          this.noiseBurst(now, 0.6, 0.15, 'highpass', 1500, out, 8000);
          break;

        case 'boom':
          this.tone('sine', 160, 35, now, 0.4, 0.4, out);
          this.noiseBurst(now, 0.45, 0.35, 'lowpass', 2200, out, 120);
          break;

        case 'boss_down':
          this.tone('sine', 120, 25, now, 1.2, 0.5, out);
          this.noiseBurst(now, 1.3, 0.45, 'lowpass', 3000, out, 80);
          [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => {
            this.tone('triangle', f, f, now + 0.35 + i * 0.07, 0.3, 0.1, out);
          });
          break;

        case 'laser_warn':
          this.tone('square', 1200, 1200, now, 0.06, 0.03, out);
          this.tone('square', 1200, 1200, now + 0.12, 0.06, 0.03, out);
          break;

        case 'laser_fire':
          this.tone('sawtooth', 90, 60, now, 0.45, 0.14, out);
          this.noiseBurst(now, 0.4, 0.12, 'bandpass', 1800, out, 600);
          break;

        case 'boss_alarm':
          for (let i = 0; i < 3; i++) {
            this.tone('sawtooth', 440, 330, now + i * 0.38, 0.3, 0.12, out);
          }
          break;

        case 'gameover':
          this.tone('sawtooth', 240, 40, now, 0.9, 0.24, out);
          this.noiseBurst(now, 0.8, 0.35, 'lowpass', 1800, out, 60);
          break;

        case 'block':
          // Metallic "tink" when a shot glances off armour
          this.tone('square', 1900, 1500, now, 0.04, 0.03, out);
          this.tone('triangle', 2600, 2400, now, 0.05, 0.025, out);
          break;

        case 'parry':
          this.tone('sawtooth', 300, 1400, now, 0.18, 0.18, out);
          this.tone('sine', 1400, 2200, now + 0.05, 0.2, 0.12, out);
          this.noiseBurst(now, 0.2, 0.18, 'bandpass', 3000, out, 7000);
          break;

        case 'key':
          [659.25, 987.77, 1318.5, 1975.5].forEach((f, i) => {
            this.tone('triangle', f, f, now + i * 0.06, 0.25, 0.12, out);
          });
          this.noiseBurst(now, 0.4, 0.08, 'highpass', 5000, out, 9000);
          break;

        case 'glitch':
          for (let i = 0; i < 4; i++) {
            const f = 200 + Math.random() * 1800;
            this.tone('square', f, f * 0.5, now + i * 0.03, 0.03, 0.04, out);
          }
          break;

        case 'perk_pick':
          // Shimmering upward arpeggio + sparkle
          [523.25, 783.99, 1046.5, 1567.98, 2093].forEach((f, i) => {
            this.tone('triangle', f, f * 1.01, now + i * 0.05, 0.28, 0.11, out);
          });
          this.tone('sine', 261.63, 523.25, now, 0.35, 0.12, out);
          this.noiseBurst(now + 0.1, 0.45, 0.08, 'highpass', 6000, out, 12000);
          break;

        case 'railgun':
          // Sharp charged crack, quiet so rapid fire never gets fatiguing
          this.tone('sawtooth', 2600, 320, now, 0.09, 0.05, out);
          this.tone('sine', 1300, 2600, now, 0.05, 0.03, out);
          this.noiseBurst(now, 0.08, 0.05, 'highpass', 4500, out, 9000);
          break;

        case 'homing_launch':
          // Whoosh of a missile pair leaving the rails
          this.noiseBurst(now, 0.32, 0.12, 'bandpass', 700, out, 3200);
          this.tone('triangle', 200, 620, now, 0.22, 0.08, out);
          break;

        case 'comm':
          this.tone('sine', 1320, 1320, now, 0.05, 0.05, out);
          this.tone('sine', 1760, 1760, now + 0.07, 0.06, 0.05, out);
          break;

        case 'combo': {
          // Combo milestone fanfare: a higher, longer chord for every tier (param = 1..3)
          const tier = Math.max(1, Math.min(3, param));
          const root = 392 * Math.pow(1.26, tier - 1);
          [1, 1.26, 1.5, 2, 2.52].slice(0, 3 + tier - 1).forEach((k, i) => {
            this.tone('sawtooth', root * k, root * k, now + i * 0.06, 0.32, 0.09, out);
            this.tone('triangle', root * k * 2, root * k * 2.02, now + i * 0.06, 0.25, 0.05, out);
          });
          this.noiseBurst(now + 0.05, 0.5, 0.1, 'highpass', 5000, out, 11000);
          break;
        }

        case 'elite_down':
          this.tone('sine', 220, 40, now, 0.45, 0.4, out);
          this.noiseBurst(now, 0.4, 0.3, 'lowpass', 2600, out, 150);
          [784, 988, 1318.5].forEach((f, i) => this.tone('triangle', f, f, now + 0.08 + i * 0.05, 0.2, 0.09, out));
          break;

        case 'revive':
          [261.63, 329.63, 392, 523.25, 659.25, 783.99].forEach((f, i) => {
            this.tone('triangle', f, f * 1.01, now + i * 0.07, 0.4, 0.11, out);
          });
          this.tone('sine', 110, 440, now, 0.6, 0.2, out);
          this.noiseBurst(now + 0.2, 0.7, 0.1, 'highpass', 3000, out, 10000);
          break;

        case 'snipe_lock':
          this.tone('sine', 1800, 2400, now, 0.12, 0.05, out);
          break;

        case 'snipe':
          this.tone('sawtooth', 1600, 200, now, 0.16, 0.08, out);
          this.noiseBurst(now, 0.12, 0.1, 'highpass', 3500, out, 8000);
          break;

        case 'lunge':
          this.tone('sawtooth', 180, 900, now, 0.25, 0.08, out);
          this.noiseBurst(now, 0.3, 0.1, 'bandpass', 900, out, 3000);
          break;
      }
    } catch {
      // Audio playback failsafe
    }
  }

  // ---------------------------------------------------------------------------
  // Procedural synthwave soundtrack (lookahead step sequencer)
  // ---------------------------------------------------------------------------
  public startBgm() {
    this.wantBgm = true;
    const ctx = this.ensureContext();
    if (!ctx || this.schedulerId !== null) return;
    this.nextStepTime = ctx.currentTime + 0.06;
    this.step = 0;
    this.schedulerId = window.setInterval(() => this.schedule(), 25);
  }

  public stopBgm() {
    this.wantBgm = false;
    if (this.schedulerId !== null) {
      window.clearInterval(this.schedulerId);
      this.schedulerId = null;
    }
  }

  private schedule() {
    const ctx = this.ctx;
    if (!ctx || !this.wantBgm) return;
    // If the tab was suspended, skip ahead instead of bursting notes
    if (this.nextStepTime < ctx.currentTime - 0.2) {
      this.nextStepTime = ctx.currentTime + 0.05;
    }
    while (this.nextStepTime < ctx.currentTime + 0.12) {
      // Layer changes land on a bar line (Overdrive cuts in on the next beat for punch)
      if (this.pendingMode !== this.bgmMode && (this.step % 16 === 0 || (this.pendingMode === 'fever' && this.step % 4 === 0))) {
        this.bgmMode = this.pendingMode;
      }
      if (!this.muted && !this.bgmMuted) this.playStep(this.step, this.nextStepTime);
      this.nextStepTime += stepDur(this.bgmMode);
      this.step = (this.step + 1) % 64;
    }
  }

  private playStep(step: number, t: number) {
    const out = this.bgmBus!;
    const bar = Math.floor(step / 16);
    const s = step % 16;
    const calm = this.intensity <= 0;
    const mode: BgmMode = calm ? 'normal' : this.bgmMode;
    const prof = BGM[mode];
    const boss = mode === 'boss';
    const fever = mode === 'fever';
    const STEP = stepDur(mode);
    const ctx = this.ctx!;

    try {
      // Kick: four on the floor (half time when calm), extra pickup kick in boss fights
      if (s % 4 === 0 && (!calm || s % 8 === 0)) {
        this.tone('sine', boss ? 165 : 150, 42, t, 0.22, boss ? 0.62 : 0.55, out);
      }
      if (boss && (s === 10 || (bar === 3 && s === 14))) this.tone('sine', 150, 42, t, 0.18, 0.4, out);
      // Snare on 2 & 4; boss fights add ghost notes and a fill on the last bar
      if (!calm && (s === 4 || s === 12)) {
        this.noiseBurst(t, 0.16, boss ? 0.3 : 0.22, 'bandpass', boss ? 2100 : 1900, out);
        this.tone('triangle', 220, 160, t, 0.08, boss ? 0.16 : 0.12, out);
      }
      if (boss && (s === 7 || s === 15 || (bar === 3 && s >= 13))) {
        this.noiseBurst(t, 0.07, 0.09, 'bandpass', 2600, out);
      }
      // Hats on offbeats (16ths in boss / overdrive)
      if (s % 4 === 2 || ((boss || fever) && s % 2 === 1)) {
        this.noiseBurst(t, 0.04, s % 4 === 2 ? 0.1 : 0.05, 'highpass', fever ? 9000 : 7000, out);
      }
      // Bass: driving 8ths with octave pops; rolling 16ths for bosses and Overdrive
      if (s % 2 === 0 || boss || fever) {
        const root = prof.bass[bar];
        const f = s % 8 === 6 ? root * 2 : root;
        const osc = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(f, t);
        filter.type = 'lowpass';
        filter.Q.value = boss ? 9 : 6;
        filter.frequency.setValueAtTime(fever ? 1300 : boss ? 820 : 520, t);
        filter.frequency.exponentialRampToValueAtTime(140, t + STEP * 1.6);
        const vol = s % 2 === 0 ? 0.16 : 0.1;
        gain.gain.setValueAtTime(vol, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + STEP * 1.7);
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(out);
        osc.start(t);
        osc.stop(t + STEP * 1.8);
      }
      // Arpeggio lead through a low-pass whose cutoff follows the layer
      if (!calm) {
        const chord = prof.chords[bar];
        const pattern = fever ? [0, 1, 2, 3, 3, 2, 1, 2] : [0, 1, 2, 3, 2, 1, 2, 3];
        const octave = fever ? 2 : boss && s >= 8 ? 2 : 1;
        const note = chord[pattern[s % 8]] * octave;
        const osc = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();
        osc.type = boss ? 'sawtooth' : 'square';
        osc.frequency.setValueAtTime(note, t);
        filter.type = 'lowpass';
        filter.Q.value = fever ? 4 : 2;
        filter.frequency.setValueAtTime(prof.cutoff, t);
        filter.frequency.exponentialRampToValueAtTime(Math.max(600, prof.cutoff * 0.35), t + 0.09);
        gain.gain.setValueAtTime(fever ? 0.05 : boss ? 0.042 : 0.032, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(out);
        osc.start(t);
        osc.stop(t + 0.11);
      }
      // Pad swell at the start of each bar
      if (s === 0) {
        const chord = prof.chords[bar];
        for (let i = 0; i < 3; i++) {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = boss ? 'sawtooth' : 'triangle';
          osc.frequency.setValueAtTime(chord[i] / 2, t);
          osc.detune.value = (i - 1) * 7;
          gain.gain.setValueAtTime(0.001, t);
          gain.gain.exponentialRampToValueAtTime(boss ? 0.022 : 0.035, t + 0.4);
          gain.gain.exponentialRampToValueAtTime(0.001, t + STEP * 16);
          osc.connect(gain);
          gain.connect(out);
          osc.start(t);
          osc.stop(t + STEP * 16 + 0.05);
        }
      }
    } catch {
      // Safe synth
    }
  }

  public triggerHaptic(pattern: number | number[] = 20) {
    if (!this.haptics) return;
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(pattern);
      }
    } catch {
      // Haptics failsafe
    }
  }
}

export const sound = new SoundManager();
