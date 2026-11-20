// 月老殿: pick two people from 香客簿, choose which book's start table 三元九宫 follows, tie the red thread.
// pair_facts reads the book from the visitor's own words: a question naming 《协纪辨方书》 switches its start table.
import { moonGate } from '../art';
import { renderCard } from '../card/card';
import { pairCard, type PairResult } from '../card/pair';
import { h } from '../dom';
import { pilgrimPicker } from '../records/picker';
import { birthJson, type Pilgrim } from '../records/pilgrim';
import { listPilgrims } from '../records/store';
import { runJson, ToolFailed } from '../skill/session';

const BOOKS = {
  xuanze: { label: '《选择要略》（默认）', question: '两人八字之间的合冲刑害，三元九宫合婚' },
  xieji: { label: '《协纪辨方书》', question: '两人八字之间的合冲刑害，三元九宫合婚按《协纪辨方书》起宫' },
} as const;
type Book = keyof typeof BOOKS;

function hall(people: Pilgrim[]): HTMLElement[] {
  const a = pilgrimPicker('pair-a', '一方', people, 0);
  const b = pilgrimPicker('pair-b', '另一方', people, 1);
  const tagA = h('span', { class: 'tag' });
  const tagB = h('span', { class: 'tag' });
  const tie = h('div', { class: 'tie', 'aria-hidden': 'true' }, tagA, h('span', { class: 'thread' }), tagB);
  const hint = h('p', { class: 'hint', 'aria-live': 'polite' });
  const outcome = h('div', { class: 'outcome', 'aria-live': 'polite' });
  const books = h('div', { class: 'row', role: 'radiogroup', 'aria-label': '三元九宫起宫取法' },
    ...(Object.keys(BOOKS) as Book[]).map((book, i) => h('label', { class: 'choice' },
      h('input', { type: 'radio', name: 'book', value: book, ...(i === 0 ? { checked: true } : {}) }), BOOKS[book].label)));
  const button = h('button', { type: 'button', class: 'primary', onclick: () => void cast() }, '系红绳');

  const chosen = (): [Pilgrim, Pilgrim] => [a.pick(), b.pick()];
  const book = () => (books.querySelector<HTMLInputElement>('input:checked')?.value ?? 'xuanze') as Book;

  function refresh() {
    const [first, second] = chosen();
    tagA.textContent = first.name;
    tagB.textContent = second.name;
    tie.classList.remove('tied');
    const same = first.id === second.id;
    button.disabled = same;
    hint.textContent = same ? '请选两个不同的人。'
      : first.gender === second.gender ? '三元九宫合婚要一男一女；这两人只看八字之间的合冲刑害。' : '';
  }

  async function cast() {
    const [first, second] = chosen();
    tie.classList.add('tied');
    button.disabled = true;
    outcome.replaceChildren(h('p', { class: 'status' }, '正在排两人的八字，第一次要等算法包加载完…'));
    try {
      const result = await runJson<PairResult>({ script: 'pair_facts.py', argv: ['--stdin'], stdin: JSON.stringify({
        a: birthJson(first), b: birthJson(second), relation: 'marriage', question: BOOKS[book()].question }) });
      outcome.replaceChildren(await renderCard(pairCard(result, { A: first.name, B: second.name }, BOOKS[book()].question)));
    } catch (error) {
      const message = error instanceof ToolFailed ? error.message : '算法包运行出错，请刷新页面再试。';
      outcome.replaceChildren(h('p', { class: 'status error', role: 'alert' }, message));
    } finally {
      button.disabled = first.id === second.id;
    }
  }

  for (const control of [a.select, b.select]) control.addEventListener('change', refresh);
  refresh();
  return [
    h('div', { class: 'step' }, h('p', {}, '从香客簿选两个人。'), h('div', { class: 'row' }, a.field, b.field)),
    h('fieldset', { class: 'step' }, h('legend', {}, '三元九宫起宫取法'), books,
      h('p', { class: 'hint' }, '两本书的起宫表不同，结果可以不同。《协纪辨方书》卷三十六本身驳了这种合婚法，卡上会列出驳议。')),
    h('div', { class: 'step' }, tie, button, hint),
    outcome,
  ];
}

export function yuelaoHall(): HTMLElement {
  const body = h('div', { class: 'hall-body' }, h('p', { class: 'status' }, '正在读香客簿…'));
  void listPilgrims().then((people) => {
    body.replaceChildren(...(people.length >= 2 ? hall(people) : [
      h('p', {}, '香客簿里至少要有两个人，月老殿才能系红绳。'),
      h('a', { href: '#/xiangke' }, '去香客簿添人'),
    ]));
  }).catch(() => body.replaceChildren(h('p', { class: 'status error', role: 'alert' }, '读不了香客簿，请检查是否关闭了网站数据存储。')));

  return h('section', { class: 'hall', 'aria-labelledby': 'hall-title' },
    h('a', { class: 'back', href: '#/' }, '回中庭'),
    h('div', { class: 'hall-head' }, moonGate('yuelao'), h('h2', { id: 'hall-title', class: 'hall-title' }, '月老殿')),
    h('p', { class: 'lede' }, '系上红绳，看两人八字之间哪一柱和哪一柱合、冲、刑、害，以及三元九宫合婚怎么起宫。这里不打分，也不断定成不成。'),
    body,
  );
}
