// 许愿树: write a wish, choose its category and the day to come back; later fulfil it with an offering or release
// it. The visitor picks the return day; nothing is derived from a reading. Fulfilling is a ritual, not a reckoning,
// and the 还愿卡 says so. Wishes stay on this device.
import { artUrl, moonGate } from '../art';
import { h } from '../dom';
import { download } from '../download';
import { wishCalendar } from '../records/calendar';
import { forgetSource, pendingSource } from '../records/handoff';
import { confirmedTimezone, guessedTimezone, localMoment } from '../moment';
import { InvalidRecord } from '../records/pilgrim';
import { listWishes, saveWish } from '../records/store';
import { CATEGORIES, healthNote, merit, OFFERINGS, parseWish, STATUS_NAMES, WISH_MAX, type Offering, type Wish }
  from '../records/wish';

const today = () => localMoment(confirmedTimezone() ?? guessedTimezone()).date;
const LATER = [['一个月后', 1], ['三个月后', 3], ['一年后', 12]] as const;

function monthsLater(date: string, months: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  return new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), Math.min(d, last))).toISOString().slice(0, 10);
}

function tomorrow(date: string): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
}

function offeringButton(offering: Offering, onPick: (o: Offering) => void): HTMLElement {
  const art = { incense: 'incense.webp', lamp: 'lamp.webp', ribbon: 'ribbon.webp' }[offering];
  return h('button', { type: 'button', class: 'offering', onclick: () => onPick(offering) },
    h('img', { src: artUrl(art), alt: '', width: '72', height: '72', loading: 'lazy' }), OFFERINGS[offering]);
}

function returnCard(wish: Wish & { state: { status: 'fulfilled' } }, total: number): HTMLElement {
  return h('article', { class: 'return-card', 'aria-label': '还愿卡' },
    h('p', { class: 'return-title' }, `还愿：${OFFERINGS[wish.state.offering]}`),
    h('p', {}, `${wish.category}之愿，许于 ${wish.madeOn}，还于 ${wish.state.on}。`),
    h('p', { class: 'note' }, '这是仪式，不是推算，也不配古籍出处。'),
    h('p', { class: 'note' }, `这是你在这里的第 ${total} 次还愿。`));
}

export function xuyuanHall(): HTMLElement {
  let wishes: Wish[] = [];
  let source = pendingSource();
  const sourceLine = h('p', { class: 'hint', 'data-testid': 'wish-source', hidden: !source });
  if (source) sourceLine.textContent = `这个愿来自签：${source.title}（所问：${source.question}）`;
  const list = h('ol', { class: 'wishes', 'aria-label': '愿望簿' });
  const meritLine = h('p', { class: 'hint', 'data-testid': 'merit' });
  const notice = h('div', { class: 'notice' });
  const text = h('textarea', { id: 'wish-text', rows: '2', maxlength: String(WISH_MAX), placeholder: '例如：明年顺利考上研究生' });
  const returnOn = h('input', { id: 'wish-return', type: 'date' });
  const categories = h('div', { class: 'row', role: 'radiogroup', 'aria-label': '类别' },
    ...CATEGORIES.map((name) => h('label', { class: 'choice' }, h('input', { type: 'radio', name: 'category', value: name }), name)));

  const say = (kind: 'alert' | 'status', message: string) =>
    notice.replaceChildren(h('p', { role: kind, class: kind }, message));

  async function change(next: Wish, after?: (saved: Wish) => HTMLElement) {
    await saveWish(next);
    await render(after ? { id: next.id, extra: after(next) } : undefined);
  }

  function actions(wish: Wish): HTMLElement {
    const box = h('div', { class: 'row wish-actions' });
    const choose = () => box.replaceChildren(h('p', { class: 'hint' }, '选一样还愿：'),
      ...(Object.keys(OFFERINGS) as Offering[]).map((offering) => offeringButton(offering, (o) => void change(
        { ...wish, state: { status: 'fulfilled', on: today(), offering: o } },
        (saved) => returnCard(saved as Wish & { state: { status: 'fulfilled' } }, merit(wishes) + 1)))),
      h('button', { type: 'button', onclick: reset }, '先不还'));
    const release = () => box.replaceChildren(
      h('p', { class: 'hint' }, '放下之后，这个愿会留在愿望簿里，标为已放下。'),
      h('button', { type: 'button', onclick: () => void change({ ...wish, state: { status: 'released', on: today() } }) }, '确认放下'),
      h('button', { type: 'button', onclick: reset }, '先不放下'));
    function reset() {
      box.replaceChildren(h('button', { type: 'button', class: 'primary', onclick: choose }, '还愿'),
        h('button', { type: 'button', onclick: release }, '放下'),
        h('button', { type: 'button', class: 'chip', onclick: () => download(`有据山寺-还愿-${wish.returnOn}.ics`,
          wishCalendar(wish, new Date()), 'text/calendar') }, '放进日历'));
    }
    reset();
    return box;
  }

  function item(wish: Wish, extra?: HTMLElement): HTMLElement {
    const { state } = wish;
    const outcome = state.status === 'fulfilled' ? `${state.on} 还愿：${OFFERINGS[state.offering]}。`
      : state.status === 'released' ? `${state.on} 放下了。` : '';
    const due = state.status === 'made' && wish.returnOn <= today();
    const note = healthNote(wish.category, wish.text);
    return h('li', { 'data-testid': 'wish', class: `wish ${state.status}` },
      h('p', { class: 'wish-head' }, h('span', { class: 'chip-label' }, wish.category),
        h('span', { class: 'status-label', 'data-testid': 'wish-status' }, STATUS_NAMES[state.status]),
        due ? h('span', { class: 'due' }, '到还愿的日子了') : null),
      h('p', { class: 'wish-text' }, wish.text),
      h('p', { class: 'hint' }, `许于 ${wish.madeOn}，还愿日 ${wish.returnOn}。${outcome}`
        + (wish.source ? `来自签：${wish.source.title}（${wish.source.question}）。` : '')),
      note ? h('p', { class: 'note' }, note) : null,
      state.status === 'made' ? actions(wish) : null,
      extra ?? null);
  }

  async function render(keep?: { id: string; extra: HTMLElement }) {
    wishes = await listWishes();
    list.replaceChildren(...(wishes.length ? wishes.map((wish) => item(wish, wish.id === keep?.id ? keep.extra : undefined))
      : [h('li', { class: 'empty', 'data-testid': 'wish-empty' }, '还没有许过愿。')]));
    meritLine.textContent = `功德簿：还愿 ${merit(wishes)} 次。只是你自己的记录，不排名，也不兑换。`;
  }

  async function make(event: Event) {
    event.preventDefault();
    const category = form.querySelector<HTMLInputElement>('input[name="category"]:checked')?.value;
    const madeOn = today();
    if (!returnOn.value) {
      say('alert', '请选回来还愿的日子。');
      return;
    }
    let wish: Wish;
    try {
      wish = parseWish({ id: crypto.randomUUID(), category, text: text.value, madeOn, returnOn: returnOn.value,
        source, state: { status: 'made' } });
    } catch (error) {
      if (!(error instanceof InvalidRecord)) throw error;
      say('alert', error.message);
      return;
    }
    await saveWish(wish);
    forgetSource();
    source = null;
    sourceLine.hidden = true;
    say('status', `许愿牌挂上了。${healthNote(wish.category, wish.text) ?? ''}`);
    text.value = '';
    returnOn.value = '';
    await render();
  }

  const form = h('form', { class: 'wish-form', novalidate: true, onsubmit: (event) => void make(event) },
    sourceLine,
    h('fieldset', { class: 'step' }, h('legend', {}, '类别'), categories),
    h('div', { class: 'step' }, h('label', { for: 'wish-text' }, '心愿'), text,
      h('p', { class: 'hint' }, '心愿原文只存在这台设备上，分享时默认不显示。')),
    h('div', { class: 'step' }, h('label', { for: 'wish-return' }, '回来还愿的日子'),
      h('div', { class: 'row' }, returnOn, ...LATER.map(([label, months]) => h('button', { type: 'button', class: 'chip',
        onclick: () => { returnOn.value = monthsLater(today(), months); } }, label))),
      h('p', { class: 'hint' }, '日子由你自己定，不按卦象或择日推。到了这一天，进门时会提醒你。')),
    notice,
    h('div', { class: 'row' }, h('button', { type: 'submit', class: 'primary' }, '挂上许愿牌')),
  );
  returnOn.min = tomorrow(today());
  void render();

  return h('section', { class: 'hall', 'aria-labelledby': 'hall-title' },
    h('a', { class: 'back', href: '#/' }, '回中庭'),
    h('div', { class: 'hall-head' }, moonGate('xuyuan'), h('h2', { id: 'hall-title', class: 'hall-title' }, '许愿树')),
    h('p', { class: 'lede' }, '写一个心愿，选类别和回来还愿的日子。到时回来上一炷香、点一盏灯或挂一条红绸；愿没成，也可以放下。还愿是仪式，不是推算。'),
    form,
    h('section', { class: 'wish-book', 'aria-label': '愿望簿' },
      h('h3', { class: 'section-title' }, '愿望簿'), meritLine, list,
      h('p', { class: 'hint' }, '备份、换设备或清除，在香客簿页的「备份与清除」。')),
  );
}
