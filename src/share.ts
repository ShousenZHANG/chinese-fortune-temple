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
  /** Liuyao line values (6–9) to draw as a hexagram under the title. */
  strokes?: number[];
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

const TITLE = { size: 76, lead: 96 };
const BODY = { size: 40, lead: 62, gap: 22 };
const STROKE = { width: 300, height: 26, gap: 18, split: 44 };
const FOOTER_SPACE = 90;

/** Six lines bottom to top, as a hexagram is built; a broken line for yin, a cinnabar dot beside a moving line. */
function hexagram(ctx: CanvasRenderingContext2D, values: number[], left: number, top: number): number {
  const height = values.length * STROKE.height + (values.length - 1) * STROKE.gap;
  values.forEach((value, i) => {
    const y = top + height - (i + 1) * STROKE.height - i * STROKE.gap;
    ctx.fillStyle = INK;
    if (value % 2) ctx.fillRect(left, y, STROKE.width, STROKE.height);
    else {
      const half = (STROKE.width - STROKE.split) / 2;
      ctx.fillRect(left, y, half, STROKE.height);
      ctx.fillRect(left + half + STROKE.split, y, half, STROKE.height);
    }
    if (value === 6 || value === 9) {
      ctx.fillStyle = CINNABAR;
      ctx.beginPath();
      ctx.arc(left + STROKE.width + 34, y + STROKE.height / 2, 9, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  return height;
}

async function draw(spec: ShareSpec, lines: string[]): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 2d is unavailable');
  ctx.drawImage(await loadImage(artUrl(`${spec.frame}.webp`)), 0, 0, WIDTH, HEIGHT);
  const width = AREA.right - AREA.left;
  ctx.font = `${TITLE.size}px ${KAI}`;
  const titleRows = wrap(ctx, spec.title, width);
  ctx.font = `${BODY.size}px ${SONG}`;
  const bodyRows = lines.map((text) => wrap(ctx, text, width));
  const strokes = spec.strokes ?? [];
  const hexHeight = strokes.length ? strokes.length * STROKE.height + (strokes.length - 1) * STROKE.gap + 56 : 0;
  const block = titleRows.length * TITLE.lead + 44 + hexHeight
    + bodyRows.reduce((sum, rows) => sum + rows.length * BODY.lead + BODY.gap, 0);
  const room = AREA.bottom - FOOTER_SPACE - AREA.top;
  // Sit a little above centre, where the eye rests on a tall card.
  let y = AREA.top + Math.max(0, (room - block) * 0.38);

  ctx.textBaseline = 'top';
  ctx.fillStyle = INK;
  ctx.font = `${TITLE.size}px ${KAI}`;
  for (const row of titleRows) {
    ctx.fillText(row, AREA.left, y);
    y += TITLE.lead;
  }
  ctx.fillStyle = CINNABAR;
  ctx.fillRect(AREA.left, y + 4, 96, 4);
  y += 44;
  if (strokes.length) y += hexagram(ctx, strokes, AREA.left, y) + 56;
  ctx.fillStyle = INK;
  ctx.font = `${BODY.size}px ${SONG}`;
  for (const rows of bodyRows) {
    for (const row of rows) {
      if (y + BODY.size > AREA.bottom - FOOTER_SPACE) break;
      ctx.fillText(row, AREA.left, y);
      y += BODY.lead;
    }
    y += BODY.gap;
  }
  ctx.fillStyle = CINNABAR;
  ctx.font = `30px ${SONG}`;
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
