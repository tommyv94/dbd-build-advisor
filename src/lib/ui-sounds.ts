import { ambientAudio } from './ambient-audio';

function impulse(ctx: AudioContext, seconds: number, decay: number): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
  }
  return buffer;
}

/** Title-screen "enter the fog" stinger — deep hit + whoosh + minor sting (not copyrighted assets). */
export async function playEnterFogStinger(): Promise<void> {
  const ctx = await ambientAudio.ensureContext();
  const now = ctx.currentTime;

  const master = ctx.createGain();
  master.gain.value = 0.42;
  master.connect(ctx.destination);

  const reverb = ctx.createConvolver();
  reverb.buffer = impulse(ctx, 2.8, 2.4);
  const reverbGain = ctx.createGain();
  reverbGain.gain.value = 0.55;
  reverb.connect(reverbGain);
  reverbGain.connect(master);

  const dry = ctx.createGain();
  dry.gain.value = 0.65;
  dry.connect(master);

  const impact = ctx.createOscillator();
  impact.type = 'sine';
  impact.frequency.setValueAtTime(110, now);
  impact.frequency.exponentialRampToValueAtTime(28, now + 0.35);
  const impactEnv = ctx.createGain();
  impactEnv.gain.setValueAtTime(0, now);
  impactEnv.gain.linearRampToValueAtTime(0.85, now + 0.015);
  impactEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
  impact.connect(impactEnv);
  impactEnv.connect(dry);
  impactEnv.connect(reverb);
  impact.start(now);
  impact.stop(now + 0.6);

  const sub = ctx.createOscillator();
  sub.type = 'triangle';
  sub.frequency.setValueAtTime(55, now);
  sub.frequency.exponentialRampToValueAtTime(40, now + 0.2);
  const subEnv = ctx.createGain();
  subEnv.gain.setValueAtTime(0, now);
  subEnv.gain.linearRampToValueAtTime(0.35, now + 0.01);
  subEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
  sub.connect(subEnv);
  subEnv.connect(dry);
  sub.start(now);
  sub.stop(now + 0.5);

  const noiseLen = Math.floor(ctx.sampleRate * 0.55);
  const noiseBuf = ctx.createBuffer(1, noiseLen, ctx.sampleRate);
  const noiseData = noiseBuf.getChannelData(0);
  for (let i = 0; i < noiseLen; i++) noiseData[i] = Math.random() * 2 - 1;
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuf;
  const whooshFilter = ctx.createBiquadFilter();
  whooshFilter.type = 'bandpass';
  whooshFilter.Q.value = 0.8;
  whooshFilter.frequency.setValueAtTime(1400, now + 0.04);
  whooshFilter.frequency.exponentialRampToValueAtTime(90, now + 0.5);
  const whooshEnv = ctx.createGain();
  whooshEnv.gain.setValueAtTime(0, now);
  whooshEnv.gain.linearRampToValueAtTime(0.22, now + 0.06);
  whooshEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.52);
  noise.connect(whooshFilter);
  whooshFilter.connect(whooshEnv);
  whooshEnv.connect(reverb);
  noise.start(now);
  noise.stop(now + 0.55);

  const stingerNotes = [
    { freq: 220, at: 0.09 },
    { freq: 261.63, at: 0.11 },
    { freq: 329.63, at: 0.13 },
    { freq: 440, at: 0.16 },
  ];
  for (const { freq, at } of stingerNotes) {
    const t = now + at;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.11, t + 0.018);
    env.gain.exponentialRampToValueAtTime(0.001, t + 1.4);
    osc.connect(env);
    env.connect(reverb);
    osc.start(t);
    osc.stop(t + 1.5);
  }

  const ring = ctx.createOscillator();
  ring.type = 'sine';
  ring.frequency.setValueAtTime(880, now + 0.05);
  ring.frequency.exponentialRampToValueAtTime(660, now + 0.35);
  const ringEnv = ctx.createGain();
  ringEnv.gain.setValueAtTime(0, now + 0.05);
  ringEnv.gain.linearRampToValueAtTime(0.04, now + 0.08);
  ringEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
  ring.connect(ringEnv);
  ringEnv.connect(reverb);
  ring.start(now + 0.05);
  ring.stop(now + 1);
}

/** Short UI click — menu button feedback */
export async function playMenuClick(): Promise<void> {
  const ctx = await ambientAudio.ensureContext();
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(520, now);
  osc.frequency.exponentialRampToValueAtTime(380, now + 0.06);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0, now);
  env.gain.linearRampToValueAtTime(0.06, now + 0.008);
  env.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
  osc.connect(env);
  env.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.1);
}
