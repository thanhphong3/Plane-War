class SoundManager {
  private ctx: AudioContext | null = null;
  private bgmGain: GainNode | null = null;
  private bgmOsc1: OscillatorNode | null = null;
  private bgmOsc2: OscillatorNode | null = null;
  private bgmFilter: BiquadFilterNode | null = null;
  private isBgmPlaying = false;
  private bgmIntervalId: number | null = null;
  private muted = false;
  private bgmMuted = false;

  public setMuted(muted: boolean) {
    this.muted = muted;
    if (muted) {
      this.stopBgm();
    } else if (!this.bgmMuted && this.isBgmPlaying) {
      this.startBgm();
    }
  }

  public setBgmMuted(bgmMuted: boolean) {
    this.bgmMuted = bgmMuted;
    if (bgmMuted) {
      this.stopBgm();
    } else if (!this.muted) {
      this.startBgm();
    }
  }

  public getMuted() {
    return this.muted;
  }

  public getBgmMuted() {
    return this.bgmMuted;
  }

  public ensureContext(): AudioContext | null {
    if (this.muted) return null;
    try {
      if (!this.ctx) {
        const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioContextClass) {
          this.ctx = new AudioContextClass();
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    } catch {
      return null;
    }
    return this.ctx;
  }

  public playSound(
    type: 'gem' | 'nearmiss' | 'dash' | 'powerup' | 'fever' | 'boom' | 'shield_break' | 'gameover' | 'click',
    param: number = 1
  ) {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    try {
      switch (type) {
        case 'click': {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(800, now);
          osc.frequency.exponentialRampToValueAtTime(400, now + 0.04);
          gain.gain.setValueAtTime(0.08, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.045);
          break;
        }

        case 'gem': {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          // Pitch scales up with combo multiplier!
          const baseFreq = Math.min(1450, 520 + Math.min(param, 30) * 32);
          osc.frequency.setValueAtTime(baseFreq, now);
          osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, now + 0.09);
          gain.gain.setValueAtTime(0.13, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.1);
          break;
        }

        case 'nearmiss': {
          // Tension whoosh / cyber graze
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(280, now);
          osc.frequency.exponentialRampToValueAtTime(1100, now + 0.15);
          gain.gain.setValueAtTime(0.2, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.16);
          break;
        }

        case 'dash': {
          // Deep punchy futuristic booster sweep
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(160, now);
          osc.frequency.exponentialRampToValueAtTime(680, now + 0.19);
          gain.gain.setValueAtTime(0.22, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.23);
          break;
        }

        case 'shield_break': {
          const osc1 = ctx.createOscillator();
          const osc2 = ctx.createOscillator();
          const gain = ctx.createGain();
          osc1.type = 'triangle';
          osc2.type = 'sine';
          osc1.frequency.setValueAtTime(900, now);
          osc1.frequency.exponentialRampToValueAtTime(220, now + 0.22);
          osc2.frequency.setValueAtTime(450, now);
          osc2.frequency.exponentialRampToValueAtTime(110, now + 0.22);
          gain.gain.setValueAtTime(0.25, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
          osc1.connect(gain);
          osc2.connect(gain);
          gain.connect(ctx.destination);
          osc1.start(now);
          osc2.start(now);
          osc1.stop(now + 0.25);
          osc2.stop(now + 0.25);
          break;
        }

        case 'powerup': {
          const notes = [523.25, 659.25, 783.99, 1046.5];
          notes.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            const t = now + i * 0.04;
            osc.frequency.setValueAtTime(freq, t);
            gain.gain.setValueAtTime(0.12, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(t);
            osc.stop(t + 0.17);
          });
          break;
        }

        case 'fever': {
          const feverNotes = [440, 554.37, 659.25, 880, 1108.7];
          feverNotes.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sawtooth';
            const t = now + i * 0.05;
            osc.frequency.setValueAtTime(freq, t);
            gain.gain.setValueAtTime(0.16, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(t);
            osc.stop(t + 0.23);
          });
          break;
        }

        case 'boom': {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(140, now);
          osc.frequency.exponentialRampToValueAtTime(32, now + 0.38);
          gain.gain.setValueAtTime(0.28, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.41);
          break;
        }

        case 'gameover': {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(220, now);
          osc.frequency.exponentialRampToValueAtTime(45, now + 0.6);
          gain.gain.setValueAtTime(0.3, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.66);
          break;
        }
      }
    } catch {
      // Audio playback failsafe
    }
  }

  /**
   * Procedural Cyberpunk Synth Bassline
   * Generates a rhythmic driving arpeggio with 120-135 BPM feel.
   */
  public startBgm() {
    if (this.muted || this.bgmMuted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    if (this.isBgmPlaying) return;
    this.isBgmPlaying = true;

    const bassNotes = [55, 55, 65.4, 55, 73.4, 55, 82.4, 73.4]; // A1 scale driving pulse
    let step = 0;

    const playBassStep = () => {
      if (!this.isBgmPlaying || this.muted || this.bgmMuted || !this.ctx) return;
      const now = this.ctx.currentTime;
      const freq = bassNotes[step % bassNotes.length];
      step++;

      try {
        const osc = this.ctx.createOscillator();
        const filter = this.ctx.createBiquadFilter();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, now);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(380, now);
        filter.frequency.exponentialRampToValueAtTime(120, now + 0.16);

        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.19);
      } catch {
        // Safe synth
      }
    };

    if (this.bgmIntervalId) {
      window.clearInterval(this.bgmIntervalId);
    }
    this.bgmIntervalId = window.setInterval(playBassStep, 175);
  }

  public stopBgm() {
    this.isBgmPlaying = false;
    if (this.bgmIntervalId) {
      window.clearInterval(this.bgmIntervalId);
      this.bgmIntervalId = null;
    }
  }

  public triggerHaptic(pattern: number | number[] = 20) {
    try {
      if (typeof window !== 'undefined' && 'navigator' in window && typeof navigator.vibrate === 'function') {
        navigator.vibrate(pattern);
      }
    } catch {
      // Haptics failsafe
    }
  }
}

export const sound = new SoundManager();
