// 场景模式 (v2 spec): whether this visit's courtyard is the 3D temple or the 2.5D painting. The first rule that
// applies decides:
//   1. no WebGL 2, which is all three.js draws with: 2.5D;
//   2. ?scene=3d in the address: 3D, with no frame-rate check (for previews and tests);
//   3. the visitor's own pick in Settings; a picked 3D is not frame-rate checked either;
//   4. reduced motion: 2.5D;
//   5. this device once fell under the frame-rate floor: 2.5D;
//   6. the default: 2.5D until the 3D temple is finished (spec story 46), then 3D, frame-rate checked.
// Rule 1 can only turn 3D into 2.5D, so it is checked last and only when the answer would be 3D: the probe makes a
// WebGL context, which a 2.5D visit has no reason to pay for.
export type SceneMode = '3d' | '2.5d';

export interface SceneChoice {
  mode: SceneMode;
  /** Watch the 3D court's first seconds and fall back to 2.5D if it draws too slowly. */
  checkFrameRate: boolean;
}

// The maintainer switches this to '3d' once the 3D temple is finished and has been seen on a phone (spec story 48).
const DEFAULT_MODE = '2.5d' as SceneMode;
const PICKED_KEY = 'temple.scene';
const SLOW_KEY = 'temple.scene-slow';
const PAINTING: SceneChoice = { mode: '2.5d', checkFrameRate: false };
// What this page has written, so a pick or a fallback still holds for the visit when storage is blocked.
const kept = new Map<string, string>();

function read(key: string): string | null {
  try {
    return localStorage.getItem(key) ?? kept.get(key) ?? null;
  } catch {
    return kept.get(key) ?? null;
  }
}

function write(key: string, value: string): void {
  kept.set(key, value);
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage blocked: kept above for this page.
  }
}

export const urlAsks3d = (): boolean => new URLSearchParams(location.search).get('scene') === '3d';

/** A stored or submitted value, if it names a mode. */
export const asSceneMode = (value: string | null): SceneMode | null => (value === '3d' || value === '2.5d' ? value : null);

/** The mode the visitor picked in Settings, if any. */
export const pickedScene = (): SceneMode | null => asSceneMode(read(PICKED_KEY));

export const pickScene = (mode: SceneMode): void => write(PICKED_KEY, mode);

/** This device could not keep up with the 3D court; later visits start in 2.5D. */
export const markSlow = (): void => write(SLOW_KEY, '1');

let webgl2: boolean | undefined;

export function canDraw3d(): boolean {
  if (webgl2 === undefined) {
    try {
      const gl = document.createElement('canvas').getContext('webgl2');
      webgl2 = gl !== null;
      gl?.getExtension('WEBGL_lose_context')?.loseContext();
    } catch {
      webgl2 = false;
    }
  }
  return webgl2;
}

/** Rules 2–6: what this visit asks for before knowing whether the browser can draw it. */
function requestedChoice(): SceneChoice {
  if (urlAsks3d()) return { mode: '3d', checkFrameRate: false };
  const picked = pickedScene();
  if (picked) return { mode: picked, checkFrameRate: false };
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  if (reduced || read(SLOW_KEY) === '1') return PAINTING;
  return { mode: DEFAULT_MODE, checkFrameRate: DEFAULT_MODE === '3d' };
}

export function sceneChoice(): SceneChoice {
  const choice = requestedChoice();
  return choice.mode === '3d' && !canDraw3d() ? PAINTING : choice;
}

/** Settings shows the switch once 3D is the default, or to a visitor who opened 3D by address or picked a mode. */
export const offersSwitch = (): boolean => DEFAULT_MODE === '3d' || urlAsks3d() || pickedScene() !== null;
