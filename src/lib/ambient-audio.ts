const STORAGE_KEY = 'dbd-ambient-muted';
const VOLUME = 0.11;

/** A minor palette — low, ominous title-screen feel */
const PAD_NOTES = [55, 82.41, 110, 130.81, 164.81];
const PIANO_NOTES = [110, 130.81, 146.83, 164.81, 196, 220, 261.63];

function readMuted(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function writeMuted(muted: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, muted ? '1' : '0');
  } catch {
    /* ignore */
  }
}

function createReverbImpulse(ctx: AudioContext, seconds = 4, decay = 3.2): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * seconds);
  const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = impulse.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
  }
  return impulse;
}

class AmbientAudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private running = false;
  private muted = readMuted();
  private oscillators: OscillatorNode[] = [];
  private timers: ReturnType<typeof setTimeout>[] = [];

  isMuted(): boolean {
    return this.muted;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    writeMuted(muted);
    this.applyVolume();
  }

  async ensureContext(): Promise<AudioContext> {
    if (!this.ctx) await this.start();
    if (this.ctx!.state === 'suspended') await this.ctx!.resume();
    return this.ctx!;
  }

  async start(): Promise<void> {
    if (this.running && this.ctx) {
      if (this.ctx.state === 'suspended') await this.ctx.resume();
      this.applyVolume();
      return;
    }

    const ctx = new AudioContext();
    this.ctx = ctx;

    const master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
    this.master = master;

    const reverb = ctx.createConvolver();
    reverb.buffer = createReverbImpulse(ctx, 5, 2.8);
    const reverbGain = ctx.createGain();
    reverbGain.gain.value = 0.55;
    reverb.connect(reverbGain);
    reverbGain.connect(master);

    const dryGain = ctx.createGain();
    dryGain.gain.value = 0.45;
    dryGain.connect(master);

    const padBus = ctx.createGain();
    padBus.gain.value = 0.38;
    padBus.connect(dryGain);
    padBus.connect(reverb);

    const pianoBus = ctx.createGain();
    pianoBus.gain.value = 0.5;
    pianoBus.connect(reverb);

    this.buildPadLayer(ctx, padBus);
    this.buildSubDrone(ctx, padBus);
    this.buildHighShimmer(ctx, reverb);
    this.schedulePianoNotes(ctx, pianoBus);
    this.scheduleDistantHits(ctx, reverb);

    this.running = true;
    await ctx.resume();
    this.applyVolume();
  }

  private trackOsc(osc: OscillatorNode): void {
    this.oscillators.push(osc);
    osc.start();
  }

  private trackTimer(id: ReturnType<typeof setTimeout>): void {
    this.timers.push(id);
  }

  /** Detuned triangle pads — string-like minor drone */
  private buildPadLayer(ctx: AudioContext, dest: GainNode): void {
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 520;
    filter.Q.value = 0.7;
    filter.connect(dest);

    const filterLfo = ctx.createOscillator();
    filterLfo.type = 'sine';
    filterLfo.frequency.value = 0.025;
    const filterLfoGain = ctx.createGain();
    filterLfoGain.gain.value = 180;
    filterLfo.connect(filterLfoGain);
    filterLfoGain.connect(filter.frequency);
    this.trackOsc(filterLfo);

    for (const freq of PAD_NOTES) {
      for (const detune of [-7, 0, 7]) {
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        osc.detune.value = detune;
        const gain = ctx.createGain();
        gain.gain.value = freq <= 82.41 ? 0.09 : 0.045;
        osc.connect(gain);
        gain.connect(filter);
        this.trackOsc(osc);
      }
    }

    const swellLfo = ctx.createOscillator();
    swellLfo.type = 'sine';
    swellLfo.frequency.value = 0.018;
    const swellGain = ctx.createGain();
    swellGain.gain.value = 0.04;
    swellLfo.connect(swellGain);
    swellGain.connect(dest.gain);
    this.trackOsc(swellLfo);
  }

  private buildSubDrone(ctx: AudioContext, dest: GainNode): void {
    const subFilter = ctx.createBiquadFilter();
    subFilter.type = 'lowpass';
    subFilter.frequency.value = 90;
    subFilter.connect(dest);

    for (const freq of [27.5, 41.2]) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const gain = ctx.createGain();
      gain.gain.value = 0.14;
      osc.connect(gain);
      gain.connect(subFilter);
      this.trackOsc(osc);
    }

    const pulse = ctx.createOscillator();
    pulse.type = 'sine';
    pulse.frequency.value = 55;
    const pulseGain = ctx.createGain();
    pulseGain.gain.value = 0.06;
    pulse.connect(pulseGain);
    pulseGain.connect(subFilter);

    const pulseLfo = ctx.createOscillator();
    pulseLfo.frequency.value = 0.04;
    const pulseLfoGain = ctx.createGain();
    pulseLfoGain.gain.value = 0.035;
    pulseLfo.connect(pulseLfoGain);
    pulseLfoGain.connect(pulseGain.gain);
    this.trackOsc(pulse);
    this.trackOsc(pulseLfo);
  }

  /** Ethereal high partial — Entity whisper */
  private buildHighShimmer(ctx: AudioContext, reverb: ConvolverNode): void {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 880;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    osc.connect(gain);
    gain.connect(reverb);

    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.008;
    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);
    this.trackOsc(osc);
    this.trackOsc(lfo);
  }

  private schedulePianoNotes(ctx: AudioContext, dest: GainNode): void {
    const playNote = () => {
      if (!this.ctx || !this.running) return;
      const now = ctx.currentTime;
      const freq = PIANO_NOTES[Math.floor(Math.random() * PIANO_NOTES.length)];

      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;

      const osc2 = ctx.createOscillator();
      osc2.type = 'triangle';
      osc2.frequency.value = freq * 2;
      osc2.detune.value = 4;

      const envelope = ctx.createGain();
      envelope.gain.setValueAtTime(0, now);
      envelope.gain.linearRampToValueAtTime(0.07, now + 0.04);
      envelope.gain.exponentialRampToValueAtTime(0.001, now + 4.5);

      const noteFilter = ctx.createBiquadFilter();
      noteFilter.type = 'lowpass';
      noteFilter.frequency.value = 1200;

      osc.connect(envelope);
      osc2.connect(envelope);
      envelope.connect(noteFilter);
      noteFilter.connect(dest);

      osc.start(now);
      osc2.start(now);
      osc.stop(now + 5);
      osc2.stop(now + 5);

      const delay = 6000 + Math.random() * 14000;
      this.trackTimer(setTimeout(playNote, delay));
    };

    this.trackTimer(setTimeout(playNote, 2500));
  }

  private scheduleDistantHits(ctx: AudioContext, reverb: ConvolverNode): void {
    const playHit = () => {
      if (!this.ctx || !this.running) return;
      const now = ctx.currentTime;
      const freq = [220, 261.63, 329.63][Math.floor(Math.random() * 3)];

      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = freq;

      const env = ctx.createGain();
      env.gain.setValueAtTime(0, now);
      env.gain.linearRampToValueAtTime(0.012, now + 0.02);
      env.gain.exponentialRampToValueAtTime(0.0001, now + 2.8);

      const hitFilter = ctx.createBiquadFilter();
      hitFilter.type = 'bandpass';
      hitFilter.frequency.value = freq;
      hitFilter.Q.value = 8;

      osc.connect(hitFilter);
      hitFilter.connect(env);
      env.connect(reverb);

      osc.start(now);
      osc.stop(now + 3);

      const delay = 18000 + Math.random() * 28000;
      this.trackTimer(setTimeout(playHit, delay));
    };

    this.trackTimer(setTimeout(playHit, 12000));
  }

  private applyVolume(): void {
    if (!this.master || !this.ctx) return;
    const target = this.muted ? 0 : VOLUME;
    this.master.gain.setTargetAtTime(target, this.ctx.currentTime, 0.65);
  }

  stop(): void {
    for (const id of this.timers) clearTimeout(id);
    this.timers = [];
    for (const osc of this.oscillators) {
      try {
        osc.stop();
      } catch {
        /* already stopped */
      }
    }
    this.oscillators = [];
    void this.ctx?.close();
    this.ctx = null;
    this.master = null;
    this.running = false;
  }
}

export const ambientAudio = new AmbientAudioEngine();

export function loadAmbientMuted(): boolean {
  return readMuted();
}
