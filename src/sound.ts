// Temple sounds synthesised with WebAudio, so no recording needs a licence: a wooden fish knock, a bead click and a
// bronze bell. One switch mutes them all (spec story 60) and is remembered. The context starts on the first tap.
const KEY = 'temple.muted';
let context: AudioContext | null = null;

export function muted(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function setMuted(value: boolean): void {
  try {
    localStorage.setItem(KEY, value ? '1' : '0');
  } catch {
    // Storage blocked: the switch holds for this page.
  }
  if (value) stopAmbient();
}

function audio(): AudioContext | null {
  if (muted() || typeof AudioContext === 'undefined') return null;
  context ??= new AudioContext();
  if (context.state === 'suspended') void context.resume();
  return context;
}

/** One decaying sine partial. */
function partial(ctx: AudioContext, freq: number, gain: number, decay: number, endFreq = freq) {
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  const now = ctx.currentTime;
  osc.frequency.setValueAtTime(freq, now);
  if (endFreq !== freq) osc.frequency.exponentialRampToValueAtTime(endFreq, now + decay * 0.6);
  amp.gain.setValueAtTime(gain, now);
  amp.gain.exponentialRampToValueAtTime(0.0001, now + decay);
  osc.connect(amp).connect(ctx.destination);
  osc.start(now);
  osc.stop(now + decay + 0.05);
}

/** 木鱼: a hollow knock, a short pitch drop. */
export function knock(): void {
  const ctx = audio();
  if (!ctx) return;
  partial(ctx, 820, 0.5, 0.16, 520);
  partial(ctx, 1640, 0.12, 0.06);
}

/** 念珠: a small wooden click. */
export function bead(): void {
  const ctx = audio();
  if (ctx) partial(ctx, 2300, 0.15, 0.04, 1900);
}

/** 钟: inharmonic partials of a bronze bell with a long tail. */
export function bell(): void {
  const ctx = audio();
  if (!ctx) return;
  const base = 196;
  [[1, 0.35, 6], [2.01, 0.18, 4.5], [2.76, 0.14, 3.5], [5.4, 0.06, 2], [8.93, 0.03, 1.2]]
    .forEach(([ratio, gain, decay]) => partial(ctx, base * ratio, gain, decay));
}

// Ambient wind and a low chant hum (spec story 60), looped until switched off. Muting stops them.
let ambient: { stop(): void } | null = null;
export const AMBIENT_EVENT = 'temple:ambient';

function announce(): void {
  window.dispatchEvent(new CustomEvent(AMBIENT_EVENT, { detail: ambient !== null }));
}

function wind(ctx: AudioContext, out: AudioNode): AudioScheduledSourceNode[] {
  const length = ctx.sampleRate * 4;
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < length; i += 1) {
    last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
    data[i] = last * 3.5;
  }
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  noise.loop = true;
  const band = ctx.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = 500;
  band.Q.value = 0.6;
  const gust = ctx.createOscillator();
  const depth = ctx.createGain();
  gust.frequency.value = 0.08;
  depth.gain.value = 300;
  gust.connect(depth).connect(band.frequency);
  const level = ctx.createGain();
  level.gain.value = 0.18;
  noise.connect(band).connect(level).connect(out);
  return [noise, gust];
}

function chant(ctx: AudioContext, out: AudioNode): AudioScheduledSourceNode[] {
  const vowel = ctx.createBiquadFilter();
  vowel.type = 'bandpass';
  vowel.frequency.value = 450;
  vowel.Q.value = 1.2;
  const swell = ctx.createGain();
  swell.gain.value = 0.05;
  const breath = ctx.createOscillator();
  const breathDepth = ctx.createGain();
  breath.frequency.value = 0.12;
  breathDepth.gain.value = 0.04;
  breath.connect(breathDepth).connect(swell.gain);
  const voices = [110, 110.6, 165].map((freq) => {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = freq;
    osc.connect(vowel);
    return osc;
  });
  vowel.connect(swell).connect(out);
  return [...voices, breath];
}

export const ambientOn = (): boolean => ambient !== null;

export function startAmbient(): boolean {
  const ctx = audio();
  if (!ctx || ambient) return ambient !== null;
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.0001, ctx.currentTime);
  master.gain.exponentialRampToValueAtTime(1, ctx.currentTime + 2);
  master.connect(ctx.destination);
  const sources = [...wind(ctx, master), ...chant(ctx, master)];
  sources.forEach((source) => source.start());
  ambient = {
    stop() {
      master.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.3);
      sources.forEach((source) => source.stop(ctx.currentTime + 1.5));
    },
  };
  announce();
  return true;
}

export function stopAmbient(): void {
  ambient?.stop();
  ambient = null;
  announce();
}
