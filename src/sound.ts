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
