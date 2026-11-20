// Liuyao lines drawn as ink strokes. Values follow the Skill: 6 老阴, 7 少阳, 8 少阴, 9 老阳 (6 + number of 背).
const NAMES: Record<number, string> = { 6: '老阴', 7: '少阳', 8: '少阴', 9: '老阳' };
const POSITIONS = ['初', '二', '三', '四', '五', '上'];

export const lineName = (value: number): string => NAMES[value] ?? String(value);
export const positionName = (index: number): string => `${POSITIONS[index]}爻`;

export function stroke(value: number): HTMLElement {
  const element = document.createElement('span');
  element.className = `stroke ${value % 2 ? 'yang' : 'yin'}${value === 6 || value === 9 ? ' moving' : ''}`;
  element.setAttribute('aria-hidden', 'true');
  element.append(document.createElement('i'), document.createElement('i'));
  return element;
}

/** Six strokes stacked bottom to top, the way a hexagram is built. */
export function glyph(values: number[]): HTMLElement {
  const element = document.createElement('div');
  element.className = 'glyph';
  element.setAttribute('role', 'img');
  element.setAttribute('aria-label', values.map((value, i) => `${positionName(i)}${lineName(value)}`).join('，'));
  for (const value of values) element.append(stroke(value));
  return element;
}
