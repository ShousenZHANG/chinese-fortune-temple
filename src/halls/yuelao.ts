// 月老殿: pick two people from 香客簿, choose which book's start table 三元九宫 follows, tie the red thread.
// pair_facts reads the book from the visitor's own words: a question naming 《协纪辨方书》 switches its start table.
import { moonGate } from '../art';
import { renderCard } from '../card/card';
import { pairCard, type PairResult } from '../card/pair';
import { h } from '../dom';
import { tr } from '../i18n';
import { pilgrimPicker } from '../records/picker';
import { birthJson, type Pilgrim } from '../records/pilgrim';
import { listPilgrims } from '../records/store';
import { runJson, ToolFailed } from '../skill/session';

const BOOKS = {
  xuanze: { label: ['《选择要略》（默认）', '选择要略 (default)'], question: '两人八字之间的合冲刑害，三元九宫合婚' },
  xieji: { label: ['《协纪辨方书》', '协纪辨方书'], question: '两人八字之间的合冲刑害，三元九宫合婚按《协纪辨方书》起宫' },
} as const;
type Book = keyof typeof BOOKS;

function hall(people: Pilgrim[]): HTMLElement[] {
  const a = pilgrimPicker('pair-a', tr('一方', 'One person'), people, 0);
  const b = pilgrimPicker('pair-b', tr('另一方', 'The other'), people, 1);
  const tagA = h('span', { class: 'tag' });
  const tagB = h('span', { class: 'tag' });
  const tie = h('div', { class: 'tie', 'aria-hidden': 'true' }, tagA, h('span', { class: 'thread' }), tagB);
  const hint = h('p', { class: 'hint', 'aria-live': 'polite' });
  const outcome = h('div', { class: 'outcome', 'aria-live': 'polite' });
  const books = h('div', { class: 'row', role: 'radiogroup', 'aria-label': tr('三元九宫起宫取法', 'Starting table for the Three Eras Nine Palaces') },
    ...(Object.keys(BOOKS) as Book[]).map((book, i) => h('label', { class: 'choice' },
      h('input', { type: 'radio', name: 'book', value: book, ...(i === 0 ? { checked: true } : {}) }), tr(BOOKS[book].label[0], BOOKS[book].label[1]))));
  const button = h('button', { type: 'button', class: 'primary', onclick: () => void cast() }, tr('系红绳', 'Tie the red thread'));

  const chosen = (): [Pilgrim, Pilgrim] => [a.pick(), b.pick()];
  const book = () => (books.querySelector<HTMLInputElement>('input:checked')?.value ?? 'xuanze') as Book;

  function refresh() {
    const [first, second] = chosen();
    tagA.textContent = first.name;
    tagB.textContent = second.name;
    tie.classList.remove('tied');
    const same = first.id === second.id;
    button.disabled = same;
    hint.textContent = same ? tr('请选两个不同的人。', 'Choose two different people.')
      : first.gender === second.gender ? tr('三元九宫合婚要一男一女；这两人只看八字之间的合冲刑害。', 'The Three Eras Nine Palaces match needs a man and a woman; for these two, only the relations between their charts are listed.') : '';
  }

  async function cast() {
    const [first, second] = chosen();
    tie.classList.add('tied');
    button.disabled = true;
    outcome.replaceChildren(h('p', { class: 'status' }, tr('正在排两人的八字，第一次要等算法包加载完…', 'Drawing both charts. The first time waits for the Skill to load…')));
    try {
      const result = await runJson<PairResult>({ script: 'pair_facts.py', argv: ['--stdin'], stdin: JSON.stringify({
        a: birthJson(first), b: birthJson(second), relation: 'marriage', question: BOOKS[book()].question }) });
      outcome.replaceChildren(await renderCard(pairCard(result, { A: first.name, B: second.name }, BOOKS[book()].question)));
    } catch (error) {
      const message = error instanceof ToolFailed ? error.message : tr('算法包运行出错，请刷新页面再试。', 'The Skill ran into an error. Please refresh the page.');
      outcome.replaceChildren(h('p', { class: 'status error', role: 'alert' }, message));
    } finally {
      button.disabled = first.id === second.id;
    }
  }

  for (const control of [a.select, b.select]) control.addEventListener('change', refresh);
  refresh();
  return [
    h('div', { class: 'step' }, h('p', {}, tr('从香客簿选两个人。', 'Choose two people from the Pilgrim Book.')), h('div', { class: 'row' }, a.field, b.field)),
    h('fieldset', { class: 'step' }, h('legend', {}, tr('三元九宫起宫取法', 'Starting table for the Three Eras Nine Palaces')), books,
      h('p', { class: 'hint' }, tr('两本书的起宫表不同，结果可以不同。《协纪辨方书》卷三十六本身驳了这种合婚法，卡上会列出驳议。', 'The two books start the count differently, so results can differ. The 协纪辨方书 itself argues against this method in volume 36; the card quotes the objection.'))),
    h('div', { class: 'step' }, tie, button, hint),
    outcome,
  ];
}

export function yuelaoHall(): HTMLElement {
  const body = h('div', { class: 'hall-body' }, h('p', { class: 'status' }, tr('正在读香客簿…', 'Reading the Pilgrim Book…')));
  void listPilgrims().then((people) => {
    body.replaceChildren(...(people.length >= 2 ? hall(people) : [
      h('p', {}, tr('香客簿里至少要有两个人，月老殿才能系红绳。', 'The Pilgrim Book needs at least two people before the Matchmaker Hall can tie the thread.')),
      h('a', { href: '#/xiangke' }, tr('去香客簿添人', 'Add people in the Pilgrim Book')),
    ]));
  }).catch(() => body.replaceChildren(h('p', { class: 'status error', role: 'alert' }, tr('读不了香客簿，请检查是否关闭了网站数据存储。', 'The Pilgrim Book cannot be read. Check whether site data storage is turned off.'))));

  return h('section', { class: 'hall', 'aria-labelledby': 'hall-title' },
    h('a', { class: 'back', href: '#/' }, tr('回中庭', 'Back to the courtyard')),
    h('div', { class: 'hall-head' }, moonGate('yuelao'), h('h2', { id: 'hall-title', class: 'hall-title' }, tr('月老殿', 'Matchmaker Hall'))),
    h('p', { class: 'lede' }, tr('系上红绳，看两人八字之间哪一柱和哪一柱合、冲、刑、害，以及三元九宫合婚怎么起宫。这里不打分，也不断定成不成。', 'Tie the red thread to see which pillars of two charts combine, clash, punish or harm, and how the Three Eras Nine Palaces count runs. No score, and no verdict on whether it will work.')),
    body,
  );
}
