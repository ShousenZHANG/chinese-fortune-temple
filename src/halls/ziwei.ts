// 紫微殿: one person with a known birth hour, one topic, ziwei_calc --focus-palace. The chart cannot be drawn without
// the hour, so people recorded without one are left out of the list and counted in a note.
import { moonGate } from '../art';
import { renderCard } from '../card/card';
import { ziweiCard, type ZiweiResult } from '../card/ziwei';
import { h } from '../dom';
import { pilgrimPicker } from '../records/picker';
import { birthArgs, hasHour, type Pilgrim, type WithHour } from '../records/pilgrim';
import { listPilgrims } from '../records/store';
import { runJson, ToolFailed } from '../skill/session';

const TOPICS = [
  { palace: '官禄', label: '事业（官禄宫）' },
  { palace: '夫妻', label: '感情（夫妻宫）' },
  { palace: '财帛', label: '财运（财帛宫）' },
] as const;

function hall(people: WithHour[], withoutHour: number): HTMLElement[] {
  const person = pilgrimPicker('ziwei-person', '谁的命盘', people);
  const topics = h('div', { class: 'row', role: 'radiogroup', 'aria-label': '看哪一方面' },
    ...TOPICS.map((topic, i) => h('label', { class: 'choice' },
      h('input', { type: 'radio', name: 'topic', value: topic.palace, ...(i === 0 ? { checked: true } : {}) }), topic.label)));
  const outcome = h('div', { class: 'outcome', 'aria-live': 'polite' });
  const button = h('button', { type: 'button', class: 'primary', onclick: () => void cast() }, '排盘');

  async function cast() {
    const chosen = person.pick() as WithHour;
    const topic = TOPICS.find((t) => t.palace === topics.querySelector<HTMLInputElement>('input:checked')?.value) ?? TOPICS[0];
    button.disabled = true;
    outcome.replaceChildren(h('p', { class: 'status' }, '正在排紫微命盘，第一次要等算法包加载完…'));
    try {
      const result = await runJson<ZiweiResult>({ script: 'ziwei_calc.py',
        argv: [...birthArgs(chosen), '--focus-palace', topic.palace] });
      outcome.replaceChildren(await renderCard(ziweiCard(result, chosen.name, topic.label)));
    } catch (error) {
      const message = error instanceof ToolFailed ? error.message : '算法包运行出错，请刷新页面再试。';
      outcome.replaceChildren(h('p', { class: 'status error', role: 'alert' }, message));
    } finally {
      button.disabled = false;
    }
  }

  return [
    h('div', { class: 'step' }, h('div', { class: 'row' }, person.field),
      withoutHour ? h('p', { class: 'hint' }, `时辰不知道的 ${withoutHour} 位不在列表里：紫微斗数要有出生时辰才能排。`) : null),
    h('fieldset', { class: 'step' }, h('legend', {}, '看哪一方面'), topics),
    h('div', { class: 'step' }, button),
    outcome,
  ];
}

function empty(people: Pilgrim[]): HTMLElement[] {
  return [
    h('p', {}, people.length ? '香客簿里的人都没有记出生时辰，紫微斗数排不了。' : '香客簿里还没有人。'),
    h('a', { href: '#/xiangke' }, '去香客簿添人'),
  ];
}

export function ziweiHall(): HTMLElement {
  const body = h('div', { class: 'hall-body' }, h('p', { class: 'status' }, '正在读香客簿…'));
  void listPilgrims().then((people) => {
    const usable = people.filter(hasHour);
    body.replaceChildren(...(usable.length ? hall(usable, people.length - usable.length) : empty(people)));
  }).catch(() => body.replaceChildren(h('p', { class: 'status error', role: 'alert' }, '读不了香客簿，请检查是否关闭了网站数据存储。')));

  return h('section', { class: 'hall', 'aria-labelledby': 'hall-title' },
    h('a', { class: 'back', href: '#/' }, '回中庭'),
    h('div', { class: 'hall-head' }, moonGate('ziwei'), h('h2', { id: 'hall-title', class: 'hall-title' }, '紫微殿')),
    h('p', { class: 'lede' }, '选一个人和一个方面，排紫微斗数命盘，看对应宫位的星、亮度和古籍原句。闰月或时辰在边界上时，几种排法都列出来。'),
    body,
  );
}
