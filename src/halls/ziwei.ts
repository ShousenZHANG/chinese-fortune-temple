// 紫微殿: one person with a known birth hour, one topic, ziwei_calc --focus-palace. The chart cannot be drawn without
// the hour, so people recorded without one are left out of the list and counted in a note.
import { moonGate } from '../art';
import { renderCard } from '../card/card';
import { ziweiCard, type ZiweiResult } from '../card/ziwei';
import { h } from '../dom';
import { tr } from '../i18n';
import { pilgrimPicker } from '../records/picker';
import { birthArgs, hasHour, type Pilgrim, type WithHour } from '../records/pilgrim';
import { listPilgrims } from '../records/store';
import { runJson, ToolFailed } from '../skill/session';

const TOPICS = [
  { palace: '官禄', label: '事业（官禄宫）', en: 'Work (官禄)' },
  { palace: '夫妻', label: '感情（夫妻宫）', en: 'Love (夫妻)' },
  { palace: '财帛', label: '财运（财帛宫）', en: 'Money (财帛)' },
] as const;

function hall(people: WithHour[], withoutHour: number): HTMLElement[] {
  const person = pilgrimPicker('ziwei-person', tr('谁的命盘', 'Whose chart'), people);
  const topics = h('div', { class: 'row', role: 'radiogroup', 'aria-label': tr('看哪一方面', 'Which part of life') },
    ...TOPICS.map((topic, i) => h('label', { class: 'choice' },
      h('input', { type: 'radio', name: 'topic', value: topic.palace, ...(i === 0 ? { checked: true } : {}) }), tr(topic.label, topic.en))));
  const outcome = h('div', { class: 'outcome', 'aria-live': 'polite' });
  const button = h('button', { type: 'button', class: 'primary', onclick: () => void cast() }, tr('排盘', 'Draw the chart'));

  async function cast() {
    const chosen = person.pick() as WithHour;
    const topic = TOPICS.find((t) => t.palace === topics.querySelector<HTMLInputElement>('input:checked')?.value) ?? TOPICS[0];
    button.disabled = true;
    outcome.replaceChildren(h('p', { class: 'status' }, tr('正在排紫微命盘，第一次要等算法包加载完…', 'Drawing the Zi Wei chart. The first time waits for the Skill to load…')));
    try {
      const result = await runJson<ZiweiResult>({ script: 'ziwei_calc.py',
        argv: [...birthArgs(chosen), '--focus-palace', topic.palace] });
      outcome.replaceChildren(await renderCard(ziweiCard(result, chosen.name, topic.label)));
    } catch (error) {
      const message = error instanceof ToolFailed ? error.message : tr('算法包运行出错，请刷新页面再试。', 'The Skill ran into an error. Please refresh the page.');
      outcome.replaceChildren(h('p', { class: 'status error', role: 'alert' }, message));
    } finally {
      button.disabled = false;
    }
  }

  return [
    h('div', { class: 'step' }, h('div', { class: 'row' }, person.field),
      withoutHour ? h('p', { class: 'hint' }, tr(`时辰不知道的 ${withoutHour} 位不在列表里：紫微斗数要有出生时辰才能排。`, `${withoutHour} without a birth hour are left out: a Zi Wei chart needs the hour.`)) : null),
    h('fieldset', { class: 'step' }, h('legend', {}, tr('看哪一方面', 'Which part of life')), topics),
    h('div', { class: 'step' }, button),
    outcome,
  ];
}

function empty(people: Pilgrim[]): HTMLElement[] {
  return [
    h('p', {}, people.length ? tr('香客簿里的人都没有记出生时辰，紫微斗数排不了。', 'Nobody in the Pilgrim Book has a birth hour recorded; a Zi Wei chart needs one.') : tr('香客簿里还没有人。', 'The Pilgrim Book is empty.')),
    h('a', { href: '#/xiangke' }, tr('去香客簿添人', 'Add people in the Pilgrim Book')),
  ];
}

export function ziweiHall(): HTMLElement {
  const body = h('div', { class: 'hall-body' }, h('p', { class: 'status' }, tr('正在读香客簿…', 'Reading the Pilgrim Book…')));
  void listPilgrims().then((people) => {
    const usable = people.filter(hasHour);
    body.replaceChildren(...(usable.length ? hall(usable, people.length - usable.length) : empty(people)));
  }).catch(() => body.replaceChildren(h('p', { class: 'status error', role: 'alert' }, tr('读不了香客簿，请检查是否关闭了网站数据存储。', 'The Pilgrim Book cannot be read. Check whether site data storage is turned off.'))));

  return h('section', { class: 'hall', 'aria-labelledby': 'hall-title' },
    h('a', { class: 'back', href: '#/' }, tr('回中庭', 'Back to the courtyard')),
    h('div', { class: 'hall-head' }, moonGate('ziwei'), h('h2', { id: 'hall-title', class: 'hall-title' }, tr('紫微殿', 'Purple Star Hall'))),
    h('p', { class: 'lede' }, tr('选一个人和一个方面，排紫微斗数命盘，看对应宫位的星、亮度和古籍原句。闰月或时辰在边界上时，几种排法都列出来。', 'Choose a person and a part of life to draw a Zi Wei Dou Shu chart: the palace’s stars, their brightness and the classical lines. When a leap month or the birth hour sits on a boundary, every reading is listed.')),
    body,
  );
}
