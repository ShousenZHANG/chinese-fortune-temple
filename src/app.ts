// Hash routes, one view at a time. The boundary note is shown once for the whole visit history (spec story 42).
import { court } from './court';
import { h } from './dom';
import { dharmaName, renameDharma } from './name';
import { muted, setMuted } from './sound';
import { huangliHall } from './halls/huangli';
import { qiuqianHall } from './halls/qiuqian';
import { wenxinHall } from './halls/wenxin';
import { xuyuanHall } from './halls/xuyuan';
import { yuelaoHall } from './halls/yuelao';
import { ziweiHall } from './halls/ziwei';
import { xiangke } from './xiangke';
import { yuanqi } from './yuanqi';

const VIEWS: Record<string, () => HTMLElement> = { '': court, qiuqian: qiuqianHall, yuelao: yuelaoHall, ziwei: ziweiHall, huangli: huangliHall, wenxin: wenxinHall, xuyuan: xuyuanHall, xiangke, yuanqi };
const BOUNDARY_KEY = 'temple.boundary-seen';

function boundaryNote(): HTMLElement | null {
  try {
    if (localStorage.getItem(BOUNDARY_KEY)) return null;
  } catch {
    // Storage blocked: show the note every visit rather than never.
  }
  const note = h('aside', { class: 'boundary' },
    h('p', {}, '这里的结果按古籍原文和 Skill 的规则算出，是传统术数的文化参考。不预测健康和寿命，不做投资、法律、医疗的判断，也不打包票。'));
  note.append(h('button', { type: 'button', onclick: () => {
    try {
      localStorage.setItem(BOUNDARY_KEY, '1');
    } catch {
      // Nothing to remember it in; hiding it for this page is enough.
    }
    note.remove();
  } }, '知道了'));
  return note;
}

// Header tools: the 法名 with a way to change it, and the one switch that mutes every sound.
function siteTools(): HTMLElement {
  const name = h('span', { class: 'dharma', 'data-testid': 'dharma-name' }, dharmaName());
  const mute = h('button', { type: 'button', class: 'chip', 'aria-pressed': String(muted()) }, '静音');
  mute.addEventListener('click', () => {
    const next = mute.getAttribute('aria-pressed') !== 'true';
    setMuted(next);
    mute.setAttribute('aria-pressed', String(next));
  });
  return h('div', { class: 'site-tools' },
    h('span', {}, '法名 ', name),
    h('button', { type: 'button', class: 'chip', onclick: () => { name.textContent = renameDharma(); } }, '换一个法名'),
    mute);
}

export function mountApp(root: HTMLElement): void {
  document.querySelector('.site-head')?.append(siteTools());
  const note = boundaryNote();
  if (note) root.before(note);
  const show = () => {
    const id = location.hash.replace(/^#\/?/, '');
    root.replaceChildren((VIEWS[id] ?? court)());
    window.scrollTo(0, 0);
  };
  window.addEventListener('hashchange', show);
  show();
}
