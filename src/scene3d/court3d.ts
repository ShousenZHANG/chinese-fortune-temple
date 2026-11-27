// The 3D courtyard, v2 spec 3D step 1: open ground and one placeholder hall, enough to show that three.js draws here
// and that the court falls back to the 2.5D painting when it cannot. Imported only when this visit's scene mode is
// 3D (scene-mode.ts), so a 2.5D visit never downloads three.js.
import {
  BoxGeometry, Color, ConeGeometry, DirectionalLight, Fog, HemisphereLight, Mesh, MeshLambertMaterial,
  PerspectiveCamera, PlaneGeometry, Scene, WebGLRenderer, type BufferGeometry, type Material,
} from 'three';
import { h } from '../dom';
import { tr } from '../i18n';

// Spec 场景模式: if the first five seconds average under 24 frames a second, this device is too slow for 3D. 24, not
// 30, so a phone hovering around 28–30 is not switched back and forth.
const FLOOR_FPS = 24;
const MEASURE_MS = 5000;
// The painting's palette (styles.css): warm daylight on packed earth, stone, cinnabar walls and ink-dark tiles.
const SKY = '#efe3cc';
const EARTH = '#d6c3a0';
const STONE = '#c3b190';
const CINNABAR = '#b5432c';
const TILE = '#4a3f3a';

export interface Court3dOptions {
  /** Measure the first five seconds and call onSlow once if they are too slow. */
  checkFrameRate: boolean;
  onSlow: () => void;
}

// The frame rate is measured once a page: the court is rebuilt every time the visitor comes back from a hall, and
// a second measurement could switch modes in the middle of a visit.
let measured = false;

function block(geometry: BufferGeometry, color: string, x: number, y: number, z: number): Mesh {
  const mesh = new Mesh(geometry, new MeshLambertMaterial({ color, flatShading: true }));
  mesh.position.set(x, y, z);
  return mesh;
}

function placeholderCourt(): Scene {
  const scene = new Scene();
  scene.background = new Color(SKY);
  scene.fog = new Fog(SKY, 30, 75);
  const ground = block(new PlaneGeometry(120, 120), EARTH, 0, 0, 0);
  ground.rotation.x = -Math.PI / 2;
  // A four-sided cone turned square to the axes is a hipped roof; scaled so its eaves overhang the walls.
  const roof = block(new ConeGeometry(1, 1, 4).rotateY(Math.PI / 4), TILE, 0, 5.3, 0);
  roof.scale.set(6.8, 2.6, 4.7);
  const sun = new DirectionalLight('#ffe2b4', 2.4);
  sun.position.set(-8, 14, 10);
  scene.add(ground,
    block(new BoxGeometry(10, 0.8, 7), STONE, 0, 0.4, 0),
    block(new BoxGeometry(2.4, 0.4, 1.2), STONE, 0, 0.2, 4.1),
    block(new BoxGeometry(8, 3.2, 5), CINNABAR, 0, 2.4, 0),
    roof,
    new HemisphereLight('#fff4dd', '#8c7558', 2.2),
    sun);
  return scene;
}

/** Counts frames from the first one (which carries shader compilation, not the frame rate), and starts over when
 *  the page is hidden, since a hidden page draws nothing. */
function frameRateWatch(onSlow: () => void, signal: AbortSignal): (now: number) => void {
  let start = -1;
  let frames = 0;
  let done = false;
  document.addEventListener('visibilitychange', () => { start = -1; frames = 0; }, { signal });
  return (now) => {
    if (done) return;
    if (start < 0) {
      start = now;
      return;
    }
    frames += 1;
    if (now - start < MEASURE_MS) return;
    done = true;
    if ((frames * 1000) / (now - start) < FLOOR_FPS) onSlow();
  };
}

/** Stops drawing and frees the GPU memory and the WebGL context at once, rather than whenever the page is collected. */
function release(renderer: WebGLRenderer, scene: Scene): void {
  renderer.setAnimationLoop(null);
  scene.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    object.geometry.dispose();
    (object.material as Material).dispose();
  });
  renderer.dispose();
  renderer.forceContextLoss();
}

/** The 3D court view. Throws when WebGL 2 cannot start, and frees its WebGL context once taken off the page. */
export function court3d({ checkFrameRate, onSlow }: Court3dOptions): HTMLElement {
  const canvas = h('canvas', { role: 'img',
    'aria-label': tr('三维中庭：空地上一座殿，还在搭建', 'The courtyard in 3D: one hall on open ground, still being built') });
  const renderer = new WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  const scene = placeholderCourt();
  const camera = new PerspectiveCamera(40, 2, 0.5, 200);
  camera.position.set(0, 7, 20);
  camera.lookAt(0, 2.6, 0);

  const resized = new ResizeObserver(() => {
    const { clientWidth: width, clientHeight: height } = canvas;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  });
  resized.observe(canvas);
  const listeners = new AbortController();
  const watch = checkFrameRate && !measured ? frameRateWatch(onSlow, listeners.signal) : null;
  measured ||= checkFrameRate;

  let shown = false;
  renderer.setAnimationLoop((now) => {
    if (!canvas.isConnected) {
      if (!shown) return;
      resized.disconnect();
      listeners.abort();
      release(renderer, scene);
      return;
    }
    shown = true;
    renderer.render(scene, camera);
    watch?.(now);
  });
  return h('section', { class: 'scene scene-3d', 'aria-label': tr('中庭全景', 'Courtyard view') }, canvas);
}
