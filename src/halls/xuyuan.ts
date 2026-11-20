// 许愿树: write a wish, choose its category and the day to come back; later fulfil it with an offering or release
// it. The visitor picks the return day; nothing is derived from a reading. Fulfilling is a ritual, not a reckoning,
// and the 还愿卡 says so. Wishes stay on this device.
import { artUrl, moonGate } from '../art';
import { h } from '../dom';
import { tr } from '../i18n';
import { download } from '../download';
import { sharePanel } from '../share';
import { wishCalendar } from '../records/calendar';
import { forgetSource, pendingSource } from '../records/handoff';
import { confirmedTimezone, guessedTimezone, localMoment } from '../moment';
import { InvalidRecord } from '../records/pilgrim';
import { listWishes, saveWish } from '../records/store';
import { CATEGORIES, categoryName, healthNote, merit, OFFERINGS, offeringName, parseWish, statusName, WISH_MAX, type Offering, type Wish }
  from '../records/wish';

const today = () => localMoment(confirmedTimezone() ?? guessedTimezone()).date;
const LATER = [['一个月后', 'In a month', 1], ['三个月后', 'In three months', 3], ['一年后', 'In a year', 12]] as const;

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
    h('img', { src: artUrl(art), alt: '', width: '72', height: '72', loading: 'lazy' }), offeringName(offering));
}

function returnCard(wish: Wish & { state: { status: 'fulfilled' } }, total: number): HTMLElement {
  return h('article', { class: 'return-card', 'aria-label': tr('还愿卡', 'Fulfilment card') },
    h('p', { class: 'return-title' }, `${tr('还愿：', 'Fulfilled: ')}${offeringName(wish.state.offering)}`),
    h('p', {}, tr(`${wish.category}之愿，许于 ${wish.madeOn}，还于 ${wish.state.on}。`,
      `${categoryName(wish.category)} wish, made ${wish.madeOn}, fulfilled ${wish.state.on}.`)),
    h('p', { class: 'note' }, tr('这是仪式，不是推算，也不配古籍出处。', 'This is a ritual, not a reckoning, and it cites no classical source.')),
    h('p', { class: 'note' }, tr(`这是你在这里的第 ${total} 次还愿。`, `Wishes fulfilled here so far: ${total}.`)),
    h('details', { class: 'share-details' }, h('summary', {}, tr('生成还愿分享图', 'Share image of this fulfilment')), sharePanel({
      frame: 'frame-wish', title: `还愿：${OFFERINGS[wish.state.offering]}`, footer: '有据山寺 · 许愿树', file: '有据山寺-还愿.png',
      lines: [{ text: `${wish.category}之愿，已还愿` }, { text: `许于 ${wish.madeOn}，还于 ${wish.state.on}` },
        { text: `心愿：${wish.text}`, optional: { label: tr('分享图上写出心愿原文', 'Write the wish itself on the image'), on: false } },
        { text: '这是仪式，不是推算。' }],
    })));
}

export function xuyuanHall(): HTMLElement {
  let wishes: Wish[] = [];
  let source = pendingSource();
  const sourceLine = h('p', { class: 'hint', 'data-testid': 'wish-source', hidden: !source });
  if (source) sourceLine.textContent = tr(`这个愿来自签：${source.title}（所问：${source.question}）`,
    `This wish comes from the card ${source.title} (asked: ${source.question})`);
  const list = h('ol', { class: 'wishes', 'aria-label': tr('愿望簿', 'Wish Book') });
  const meritLine = h('p', { class: 'hint', 'data-testid': 'merit' });
  const notice = h('div', { class: 'notice' });
  const text = h('textarea', { id: 'wish-text', rows: '2', maxlength: String(WISH_MAX), placeholder: tr('例如：明年顺利考上研究生', 'For example: pass the graduate exam next year') });
  const returnOn = h('input', { id: 'wish-return', type: 'date' });
  const categories = h('div', { class: 'row', role: 'radiogroup', 'aria-label': tr('类别', 'Category') },
    ...CATEGORIES.map((name) => h('label', { class: 'choice' }, h('input', { type: 'radio', name: 'category', value: name }), categoryName(name))));

  const say = (kind: 'alert' | 'status', message: string) =>
    notice.replaceChildren(h('p', { role: kind, class: kind }, message));

  async function change(next: Wish, after?: (saved: Wish) => HTMLElement) {
    await saveWish(next);
    await render(after ? { id: next.id, extra: after(next) } : undefined);
  }

  function actions(wish: Wish): HTMLElement {
    const box = h('div', { class: 'row wish-actions' });
    const choose = () => box.replaceChildren(h('p', { class: 'hint' }, tr('选一样还愿：', 'Choose an offering:')),
      ...(Object.keys(OFFERINGS) as Offering[]).map((offering) => offeringButton(offering, (o) => void change(
        { ...wish, state: { status: 'fulfilled', on: today(), offering: o } },
        (saved) => returnCard(saved as Wish & { state: { status: 'fulfilled' } }, merit(wishes) + 1)))),
      h('button', { type: 'button', onclick: reset }, tr('先不还', 'Not yet')));
    const release = () => box.replaceChildren(
      h('p', { class: 'hint' }, tr('放下之后，这个愿会留在愿望簿里，标为已放下。', 'Once released, the wish stays in the Wish Book, marked as released.')),
      h('button', { type: 'button', onclick: () => void change({ ...wish, state: { status: 'released', on: today() } }) }, tr('确认放下', 'Release it')),
      h('button', { type: 'button', onclick: reset }, tr('先不放下', 'Keep it')));
    function reset() {
      box.replaceChildren(h('button', { type: 'button', class: 'primary', onclick: choose }, tr('还愿', 'Fulfil')),
        h('button', { type: 'button', onclick: release }, tr('放下', 'Release')),
        h('button', { type: 'button', class: 'chip', onclick: () => download(`有据山寺-还愿-${wish.returnOn}.ics`,
          wishCalendar(wish, new Date()), 'text/calendar') }, tr('放进日历', 'Add to calendar')));
    }
    reset();
    return box;
  }

  function item(wish: Wish, extra?: HTMLElement): HTMLElement {
    const { state } = wish;
    const outcome = state.status === 'fulfilled'
      ? tr(`${state.on} 还愿：${offeringName(state.offering)}。`, ` Fulfilled ${state.on}: ${offeringName(state.offering)}.`)
      : state.status === 'released' ? tr(`${state.on} 放下了。`, ` Released ${state.on}.`) : '';
    const due = state.status === 'made' && wish.returnOn <= today();
    const note = healthNote(wish.category, wish.text);
    return h('li', { 'data-testid': 'wish', class: `wish ${state.status}` },
      h('p', { class: 'wish-head' }, h('span', { class: 'chip-label' }, categoryName(wish.category)),
        h('span', { class: 'status-label', 'data-testid': 'wish-status' }, statusName(state.status)),
        due ? h('span', { class: 'due' }, tr('到还愿的日子了', 'Its return day has come')) : null),
      h('p', { class: 'wish-text' }, wish.text),
      h('p', { class: 'hint' }, tr(`许于 ${wish.madeOn}，还愿日 ${wish.returnOn}。`, `Made ${wish.madeOn}, return day ${wish.returnOn}.`)
        + outcome + (wish.source ? tr(`来自签：${wish.source.title}（${wish.source.question}）。`,
          ` From the card ${wish.source.title} (${wish.source.question}).`) : '')),
      note ? h('p', { class: 'note' }, note) : null,
      state.status === 'made' ? actions(wish) : null,
      extra ?? null);
  }

  async function render(keep?: { id: string; extra: HTMLElement }) {
    wishes = await listWishes();
    list.replaceChildren(...(wishes.length ? wishes.map((wish) => item(wish, wish.id === keep?.id ? keep.extra : undefined))
      : [h('li', { class: 'empty', 'data-testid': 'wish-empty' }, tr('还没有许过愿。', 'No wishes yet.'))]));
    meritLine.textContent = tr(`功德簿：还愿 ${merit(wishes)} 次。只是你自己的记录，不排名，也不兑换。`,
      `Merit: ${merit(wishes)} wishes fulfilled. A record for you alone: no ranking, nothing to exchange.`);
  }

  async function make(event: Event) {
    event.preventDefault();
    const category = form.querySelector<HTMLInputElement>('input[name="category"]:checked')?.value;
    const madeOn = today();
    if (!returnOn.value) {
      say('alert', tr('请选回来还愿的日子。', 'Choose the day to come back.'));
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
    say('status', `${tr('许愿牌挂上了。', 'The wish tag is hung. ')}${healthNote(wish.category, wish.text) ?? ''}`);
    text.value = '';
    returnOn.value = '';
    await render();
  }

  const form = h('form', { class: 'wish-form', novalidate: true, onsubmit: (event) => void make(event) },
    sourceLine,
    h('fieldset', { class: 'step' }, h('legend', {}, tr('类别', 'Category')), categories),
    h('div', { class: 'step' }, h('label', { for: 'wish-text' }, tr('心愿', 'Your wish')), text,
      h('p', { class: 'hint' }, tr('心愿原文只存在这台设备上，分享时默认不显示。', 'The wish’s own words stay on this device and are left off share images unless you choose.'))),
    h('div', { class: 'step' }, h('label', { for: 'wish-return' }, tr('回来还愿的日子', 'Day to come back')),
      h('div', { class: 'row' }, returnOn, ...LATER.map(([zh, en, months]) => h('button', { type: 'button', class: 'chip',
        onclick: () => { returnOn.value = monthsLater(today(), months); } }, tr(zh, en)))),
      h('p', { class: 'hint' }, tr('日子由你自己定，不按卦象或择日推。到了这一天，进门时会提醒你。', 'You choose the day; nothing is worked out from a reading. When it comes, you will be reminded at the gate.'))),
    notice,
    h('div', { class: 'row' }, h('button', { type: 'submit', class: 'primary' }, tr('挂上许愿牌', 'Hang the wish tag'))),
  );
  returnOn.min = tomorrow(today());
  void render();

  return h('section', { class: 'hall', 'aria-labelledby': 'hall-title' },
    h('a', { class: 'back', href: '#/' }, tr('回中庭', 'Back to the courtyard')),
    h('div', { class: 'hall-head' }, moonGate('xuyuan'), h('h2', { id: 'hall-title', class: 'hall-title' }, tr('许愿树', 'Wish Tree'))),
    h('p', { class: 'lede' }, tr('写一个心愿，选类别和回来还愿的日子。到时回来上一炷香、点一盏灯或挂一条红绸；愿没成，也可以放下。还愿是仪式，不是推算。', 'Write a wish and choose its category and a day to come back. Then return to offer incense, light a lamp or hang a red ribbon; if it does not come true, you can let it go. Fulfilling a wish is a ritual, not a reckoning.')),
    form,
    h('section', { class: 'wish-book', 'aria-label': tr('愿望簿', 'Wish Book') },
      h('h3', { class: 'section-title' }, tr('愿望簿', 'Wish Book')), meritLine, list,
      h('p', { class: 'hint' }, tr('备份、换设备或清除，在香客簿页的「备份与清除」。', 'To back up, move to another device or clear everything, use Backup in the Pilgrim Book.'))),
  );
}
