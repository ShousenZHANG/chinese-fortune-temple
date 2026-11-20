// 禅台 (spec stories 7, 59): knock the wooden fish, tell beads, strike the bell, bow. Something to do while the Skill
// loads, and any time after. Counts stay in this browser; knocks are not merit, which only 还愿 records.
import { artUrl } from './art';
import { h } from './dom';
import { AMBIENT_EVENT, ambientOn, bead, bell, knock, muted, startAmbient, stopAmbient } from './sound';

const BEADS = 108;

function count(key: string): number {
  try {
    return Number(localStorage.getItem(key)) || 0;
  } catch {
    return 0;
  }
}

function keep(key: string, value: number): void {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // Storage blocked: the count lasts for this page.
  }
}

function tool(label: string, art: string, onClick: () => void): HTMLButtonElement {
  return h('button', { type: 'button', class: 'zen-tool', onclick: onClick },
    h('img', { src: artUrl(art), alt: '', width: '96', height: '96', loading: 'lazy' }), label);
}

export function zen(onBow: () => void): HTMLElement {
  let knocks = count('temple.knocks');
  let beads = count('temple.beads');
  const knockLine = h('span', { class: 'zen-count', 'data-testid': 'knocks' });
  const beadLine = h('span', { class: 'zen-count', 'data-testid': 'beads' });
  const note = h('p', { class: 'hint', 'aria-live': 'polite' });
  const show = () => {
    knockLine.textContent = `敲了 ${knocks} 下`;
    beadLine.textContent = `${beads} / ${BEADS}`;
  };

  const tools = [
    h('div', { class: 'zen-item' }, tool('敲木鱼', 'muyu.webp', () => {
      knocks += 1;
      keep('temple.knocks', knocks);
      knock();
      show();
    }), knockLine),
    h('div', { class: 'zen-item' }, tool('拨一颗念珠', 'beads.webp', () => {
      beads = beads >= BEADS ? 1 : beads + 1;
      keep('temple.beads', beads);
      bead();
      if (beads === BEADS) {
        bell();
        note.textContent = '一串 108 颗念完了。';
      } else note.textContent = '';
      show();
    }), beadLine),
    h('div', { class: 'zen-item' }, tool('撞钟', 'bell.webp', bell)),
    h('div', { class: 'zen-item' }, tool('合掌', 'monk-greet.webp', onBow)),
  ];
  const ambient = h('button', { type: 'button', class: 'chip', 'aria-pressed': String(ambientOn()) }, '环境声：风声和诵经');
  ambient.addEventListener('click', () => {
    if (ambientOn()) stopAmbient();
    else if (!startAmbient()) note.textContent = muted() ? '现在是静音，先在页面顶部关掉静音。' : '这个浏览器放不了声音。';
  });
  window.addEventListener(AMBIENT_EVENT, (event) => {
    ambient.setAttribute('aria-pressed', String((event as CustomEvent<boolean>).detail));
  });
  show();
  return h('section', { class: 'zen', 'aria-label': '禅台' },
    h('h3', { class: 'section-title' }, '禅台'),
    h('p', { class: 'hint' }, '不求签也可以坐一会儿。第一次进门时算法包要加载十几秒，可以先在这里敲敲木鱼。'),
    h('div', { class: 'zen-tools' }, ...tools), h('div', { class: 'row' }, ambient), note);
}
