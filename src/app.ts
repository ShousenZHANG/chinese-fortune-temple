// Hash routes, one view at a time. The boundary note is shown once for the whole visit history (spec story 42).
import { court } from './court';
import { h } from './dom';
import { applyLang, currentLang, LANG_EVENT, setLang, tr } from './i18n';
import { dharmaName, renameDharma } from './name';
import { muted, setMuted } from './sound';
import { huangliHall } from './halls/huangli';
import { qiuqianHall } from './halls/qiuqian';
import { wenxinHall } from './halls/wenxin';
import { xuyuanHall } from './halls/xuyuan';
import { yuelaoHall } from './halls/yuelao';
import { ziweiHall } from './halls/ziwei';
import { shezhi } from './shezhi';
import { xiangke } from './xiangke';
import { yuanqi } from './yuanqi';

const VIEWS: Record<string, () => HTMLElement> = { '': court, qiuqian: qiuqianHall, yuelao: yuelaoHall, ziwei: ziweiHall, huangli: huangliHall, wenxin: wenxinHall, xuyuan: xuyuanHall, xiangke, yuanqi, shezhi };
const BOUNDARY_KEY = 'temple.boundary-seen';

function boundaryNote(): HTMLElement | null {
  try {
    if (localStorage.getItem(BOUNDARY_KEY)) return null;
  } catch {
    // Storage blocked: show the note every visit rather than never.
  }
  const note = h('aside', { class: 'boundary' },
    h('p', {}, tr('这里的结果按古籍原文和 Skill 的规则算出，是传统术数的文化参考。不预测健康和寿命，不做投资、法律、医疗的判断，也不打包票。',
      'Readings here are worked out by the Skill from classical texts and its own rules, as a cultural reference in traditional '
      + 'Chinese divination. Nothing here forecasts health or lifespan, judges investment, legal or medical questions, or promises an outcome.')));
  note.append(h('button', { type: 'button', onclick: () => {
    try {
      localStorage.setItem(BOUNDARY_KEY, '1');
    } catch {
      // Nothing to remember it in; hiding it for this page is enough.
    }
    note.remove();
  } }, tr('知道了', 'Got it')));
  return note;
}

// Header tools: the 法名 with a way to change it, the one switch that mutes every sound, the follow-up settings and
// the interface language.
function siteTools(): HTMLElement {
  const name = h('span', { class: 'dharma', 'data-testid': 'dharma-name' }, dharmaName());
  const mute = h('button', { type: 'button', class: 'chip', 'aria-pressed': String(muted()) }, tr('静音', 'Mute'));
  mute.addEventListener('click', () => {
    const next = mute.getAttribute('aria-pressed') !== 'true';
    setMuted(next);
    mute.setAttribute('aria-pressed', String(next));
  });
  const other = currentLang() === 'zh' ? 'en' : 'zh';
  return h('div', { class: 'site-tools' },
    h('span', {}, tr('法名 ', 'Dharma name '), name),
    h('button', { type: 'button', class: 'chip', onclick: () => { name.textContent = renameDharma(); } }, tr('换一个法名', 'Another name')),
    mute,
    h('a', { href: '#/shezhi' }, tr('追问设置', 'Follow-up settings')),
    h('button', { type: 'button', class: 'chip', lang: other === 'en' ? 'en' : 'zh-CN', onclick: () => setLang(other) },
      other === 'en' ? 'English' : '中文'));
}

function header(): void {
  const head = document.querySelector('.site-head');
  if (!head) return;
  head.querySelector('.site-tools')?.remove();
  const tagline = head.querySelector('.tagline');
  if (tagline) tagline.textContent = tr('掷钱、合婚、看黄历，每一签都能查到古籍出处。',
    'Toss coins, match two charts, read the almanac: every reading points to its classical source.');
  head.append(siteTools());
}

export function mountApp(root: HTMLElement): void {
  applyLang();
  header();
  let note = boundaryNote();
  if (note) root.before(note);
  const show = () => {
    const id = location.hash.replace(/^#\/?/, '');
    root.replaceChildren((VIEWS[id] ?? court)());
  };
  window.addEventListener('hashchange', () => {
    show();
    window.scrollTo(0, 0);
  });
  window.addEventListener(LANG_EVENT, () => {
    header();
    if (note?.isConnected) {
      const fresh = boundaryNote();
      if (fresh) note.replaceWith(fresh);
      note = fresh;
    }
    show();
  });
  show();
}
