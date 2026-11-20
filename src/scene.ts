// The 2.5D court (spec stories 3, 4, 6): the courtyard painting with each hall pinned where it stands. Tapping a
// hall sends the guide walking there from the gate, shrinking with distance, and the hall opens when he arrives.
// The pins are ordinary links, so keyboards, screen readers and reduced motion go straight in.
import { artUrl, courtyard } from './art';
import { h } from './dom';
import { placeName, tr } from './i18n';

interface Spot {
  href: string;
  name: string;
  /** Where the building stands, in percent of the full painting (courtyard-1536, 1536×1024). */
  x: number;
  y: number;
}

// Measured on the painting with a 5 % grid.
const SPOTS: Spot[] = [
  { href: '#/ziwei', name: '紫微殿', x: 50, y: 38 },
  { href: '#/qiuqian', name: '求签殿', x: 50, y: 52 },
  { href: '#/yuelao', name: '月老殿', x: 21, y: 57 },
  { href: '#/wenxin', name: '问心堂', x: 77, y: 57 },
  { href: '#/huangli', name: '黄历亭', x: 12, y: 72 },
  { href: '#/xuyuan', name: '许愿树', x: 85, y: 70 },
  { href: '#/xiangke', name: '香客簿', x: 50, y: 76 },
];
// The scene shows the painting's lower 75 % (the top quarter is empty sky) in a 2:1 box.
const SKY = 25;
const GATE = { x: 50, y: 97 };
const WALK_MS = 1100;

const sceneY = (y: number) => ((y - SKY) / (100 - SKY)) * 100;
const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

export function scene(): HTMLElement {
  const walker = h('img', { class: 'walker', src: artUrl('monk-back.webp'), alt: '', 'data-testid': 'walker', hidden: true,
    width: '160', height: '245' });

  function walk(spot: Spot, event: Event) {
    if (reduced()) return;
    event.preventDefault();
    walker.hidden = false;
    walker.style.transition = 'none';
    walker.style.left = `${GATE.x}%`;
    walker.style.top = `${sceneY(GATE.y)}%`;
    walker.style.setProperty('--depth', '1');
    void walker.offsetWidth;
    walker.style.transition = '';
    walker.style.left = `${spot.x}%`;
    walker.style.top = `${sceneY(spot.y) + 6}%`;
    walker.style.setProperty('--depth', String(0.45 + 0.55 * ((spot.y - SKY) / (GATE.y - SKY))));
    setTimeout(() => { location.hash = spot.href; }, WALK_MS);
  }

  return h('section', { class: 'scene', 'aria-label': tr('中庭全景', 'Courtyard view') },
    courtyard(),
    ...SPOTS.map((spot) => h('a', { class: 'spot', href: spot.href, style: `left:${spot.x}%;top:${sceneY(spot.y)}%`,
      onclick: (event) => walk(spot, event) }, placeName(spot.name))),
    walker,
  );
}
