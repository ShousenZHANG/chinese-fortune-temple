// Share images drawn in this browser on the S1 / S2 frames (spec stories 43, 54). The caller decides which lines
// may leave the device; this file only lays them out. Optional lines are off unless the caller turns them on.
import { artUrl } from './art';
import { h } from './dom';
import { download } from './download';

export interface ShareLine {
  text: string;
  /** Shown only when the visitor ticks this box; the label says what turning it on would reveal. */
  optional?: { label: string; on: boolean };
}

export interface ShareSpec {
  frame: 'frame-share' | 'frame-wish';
  title: string;
  lines: ShareLine[];
  footer: string;
  file: string;
}

const WIDTH = 1024;
const HEIGHT = 1536;
const AREA = { left: 110, right: 914, top: 230, bottom: 1180 };
const INK = '#3b2f2a';
const CINNABAR = '#c2412d';
const KAI = '"Kaiti SC", STKaiti, KaiTi, "楷体", "Noto Serif SC", serif';
const SONG = '"Songti SC", STSong, "Noto Serif SC", SimSun, serif';

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`${src} did not load`));
    image.src = src;
  });
}

/** Breaks text into lines that fit the width, character by character (CJK has no spaces to break at). */
function wrap(ctx: CanvasRenderingContext2D, text: string, width: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const char of text) {
    if (ctx.measureText(line + char).width > width && line) {
      lines.push(line);
      line = '';
    }
    line += char;
  }
  return line ? [...lines, line] : lines;
}

async function draw(spec: ShareSpec, lines: string[]): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 2d is unavailable');
  ctx.drawImage(await loadImage(artUrl(`${spec.frame}.webp`)), 0, 0, WIDTH, HEIGHT);
  const width = AREA.right - AREA.left;
  let y = AREA.top;
  ctx.fillStyle = INK;
  ctx.textBaseline = 'top';
  ctx.font = `64px ${KAI}`;
  for (const row of wrap(ctx, spec.title, width)) {
    ctx.fillText(row, AREA.left, y);
    y += 84;
  }
  y += 24;
  ctx.font = `36px ${SONG}`;
  for (const text of lines) {
    for (const row of wrap(ctx, text, width)) {
      if (y + 48 > AREA.bottom - 80) break;
      ctx.fillText(row, AREA.left, y);
      y += 56;
    }
    y += 20;
  }
  ctx.fillStyle = CINNABAR;
  ctx.font = `28px ${SONG}`;
  ctx.fillText(spec.footer, AREA.left, AREA.bottom - 40);
  return canvas;
}

/** A panel with the optional-line boxes, a preview, and 保存图片. Redrawn whenever a box changes. */
export function sharePanel(spec: ShareSpec): HTMLElement {
  const preview = h('img', { class: 'share-preview', alt: '', 'data-testid': 'share-preview' });
  const status = h('p', { class: 'hint', 'aria-live': 'polite' });
  const save = h('button', { type: 'button', class: 'primary', disabled: true }, '保存图片');
  const boxes = spec.lines.map((line) => line.optional
    ? h('input', { type: 'checkbox', ...(line.optional.on ? { checked: true } : {}) }) : null);
  let current: HTMLCanvasElement | null = null;

  const chosen = () => spec.lines.filter((line, i) => !line.optional || boxes[i]?.checked).map((line) => line.text);

  async function redraw() {
    save.disabled = true;
    try {
      const lines = chosen();
      current = await draw(spec, lines);
      preview.src = current.toDataURL('image/png');
      preview.alt = `分享图预览：${[spec.title, ...lines, spec.footer].join(' ')}`;
      save.disabled = false;
      status.textContent = '';
    } catch {
      status.textContent = '这台设备画不出分享图。';
    }
  }

  save.addEventListener('click', () => current?.toBlob((blob) => {
    if (blob) download(spec.file, blob, 'image/png');
  }, 'image/png'));
  boxes.forEach((box) => box?.addEventListener('change', () => void redraw()));
  void redraw();

  return h('div', { class: 'share-panel' },
    ...spec.lines.flatMap((line, i) => (line.optional && boxes[i]
      ? [h('label', { class: 'choice' }, boxes[i], line.optional.label)] : [])),
    h('p', { class: 'hint' }, '分享图在这台设备上生成，不上传。出生日期、时辰和四柱不会画进去。'),
    preview, h('div', { class: 'row' }, save), status);
}
