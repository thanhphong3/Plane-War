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
  | 'comm';

// A-minor synthwave progression: Am - F - C - G (one chord per bar)
const BASS_ROOTS = [55, 43.65, 65.41, 49];
const ARP_CHORDS = [
  [440, 523.25, 659.25, 880],
  [349.23, 440, 523.25, 698.46],
  [392, 523.25, 659.25, 783.99],
  [392, 493.88, 587.33, 783.99],
];
const BPM = 128;
const STEP = 60 / BPM / 4; // 16th note

class SoundManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private bgmBus: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private muted = false;
  private bgmMuted = false;

  private wantBgm = false;
  private schedulerId: number | null = null;
  private nextStepTime = 0;
  private step = 0;
  private intensity = 1;

  public setMuted(muted: boolean) {
    this.muted = muted;
    this.applyBgmGain();
  }

  public setBgmMuted(bgmMuted: boolean) {
    this.bgmMuted = bgmMuted;
    this.applyBgmGain();
  }

  public getMuted() {
    return this.muted;
  }

  public getBgmMuted() {
    return this.bgmMuted;
  }

  /** 0 = calm (menu), 1 = normal run, 2 = overdrive / boss */
  public setIntensity(level: number) {
    this.intensity = level;
  }

  private applyBgmGain() {
    if (!this.ctx || !this.bgmBus) return;
    const target = this.muted || this.bgmMuted ? 0 : 0.55;
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
        this.sfxBus.gain.value = 1;
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
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
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

        case 'comm':
          this.tone('sine', 1320, 1320, now, 0.05, 0.05, out);
          this.tone('sine', 1760, 1760, now + 0.07, 0.06, 0.05, out);
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
      if (!this.muted && !this.bgmMuted) this.playStep(this.step, this.nextStepTime);
      this.nextStepTime += STEP;
      this.step = (this.step + 1) % 64;
    }
  }

  private playStep(step: number, t: number) {
    const out = this.bgmBus!;
    const bar = Math.floor(step / 16);
    const s = step % 16;
    const lvl = this.intensity;

    try {
      // Kick: four on the floor (half time when calm)
      if (s % 4 === 0 && (lvl > 0 || s % 8 === 0)) {
        this.tone('sine', 150, 42, t, 0.22, 0.55, out);
      }
      // Snare on 2 & 4
      if (lvl > 0 && (s === 4 || s === 12)) {
        this.noiseBurst(t, 0.16, 0.22, 'bandpass', 1900, out);
        this.tone('triangle', 220, 160, t, 0.08, 0.12, out);
      }
      // Hats on offbeats (16ths in overdrive)
      if (s % 4 === 2 || (lvl >= 2 && s % 2 === 1)) {
        this.noiseBurst(t, 0.04, s % 4 === 2 ? 0.1 : 0.05, 'highpass', 7000, out);
      }
      // Bass: driving 8ths with octave pops
      if (s % 2 === 0) {
        const root = BASS_ROOTS[bar];
        const f = s % 8 === 6 ? root * 2 : root;
        const ctx = this.ctx!;
        const osc = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(f, t);
        filter.type = 'lowpass';
        filter.Q.value = 6;
        filter.frequency.setValueAtTime(lvl >= 2 ? 900 : 520, t);
        filter.frequency.exponentialRampToValueAtTime(140, t + 0.18);
        gain.gain.setValueAtTime(0.16, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(out);
        osc.start(t);
        osc.stop(t + 0.22);
      }
      // Arpeggio lead
      if (lvl > 0) {
        const chord = ARP_CHORDS[bar];
        const pattern = [0, 1, 2, 3, 2, 1, 2, 3];
        const note = chord[pattern[s % 8]] * (lvl >= 2 && s >= 8 ? 2 : 1);
        this.tone('square', note, note, t, 0.09, lvl >= 2 ? 0.045 : 0.03, out);
      }
      // Pad swell at the start of each bar
      if (s === 0) {
        const chord = ARP_CHORDS[bar];
        for (let i = 0; i < 3; i++) {
          const ctx = this.ctx!;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(chord[i] / 2, t);
          osc.detune.value = (i - 1) * 7;
          gain.gain.setValueAtTime(0.001, t);
          gain.gain.exponentialRampToValueAtTime(0.035, t + 0.4);
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
