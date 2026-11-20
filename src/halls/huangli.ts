// 黄历亭: one person from 香客簿, the confirmed time zone, and one ask. 今天、这周、最近 go to fortune_reading as a
// period request; 某个月哪天办事 first lists the month's calendar facts (huangli_query, the same in every city), then
// grades those days by birth year on request (fortune_reading with the event). "Now" is passed in, never read by
// the worker, and day boundaries follow the clock in the confirmed zone.
import { moonGate } from '../art';
import { renderCard, type CardModel } from '../card/card';
import { fortuneCard, monthCard, type FortuneResult, type MonthResult } from '../card/fortune';
import { h } from '../dom';
import { pilgrimPicker } from '../records/picker';
import { birthJson, type Pilgrim } from '../records/pilgrim';
import { listPilgrims } from '../records/store';
import { runJson, runTool, ToolFailed } from '../skill/session';
import { zoneStep } from '../zone';

type Ask = 'today' | 'week' | 'career' | 'love' | 'money' | 'month';
type Period = string | { start: string; end: string };

const ASKS: Record<Exclude<Ask, 'month'>, { label: string; period: Period; question: string; title: string }> = {
  today: { label: '今天怎么样', period: '今天', question: '今天运气怎么样', title: '的今天' },
  week: { label: '这周哪天好', period: '本周', question: '这周哪天对我好', title: '这一周' },
  career: { label: '最近事业', period: '近期', question: '最近事业怎么样', title: '最近的事业' },
  love: { label: '最近感情', period: '近期', question: '最近感情怎么样', title: '最近的感情' },
  money: { label: '最近财运', period: '近期', question: '最近财运怎么样', title: '最近的财运' },
};
const EVENTS = { 搬家: 'moving', 出行: 'travel', 结婚: 'wedding', 开业: 'business' } as const;
type EventName = keyof typeof EVENTS;

/** UTC "now" without milliseconds, the shape the Skill's request_time takes. */
const requestTime = () => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

function request(person: Pilgrim, zone: string, period: Period, question: string, scenario?: string) {
  return {
    intent: 'period', question, request_time: requestTime(), current_timezone: zone, period,
    event: { timezone: zone, time_standard: 'clock', ...(scenario ? { scenario } : {}) },
    participants: [{ id: 'me', confirmed: true,
      person: { birth: birthJson(person), time_certainty: person.time.known ? 'exact' : 'unknown' } }],
  };
}

async function reading(person: Pilgrim, zone: string, period: Period, question: string, title: string,
  scenario?: string): Promise<CardModel> {
  const stdin = JSON.stringify(request(person, zone, period, question, scenario));
  const result = await runJson<FortuneResult>({ script: 'fortune_reading.py', argv: ['--stdin'], stdin });
  const prose = await runTool({ script: 'fortune_reading.py', argv: ['--stdin', '--markdown'], stdin });
  if (prose.exitCode !== 0) throw new ToolFailed('fortune_reading.py 没有给出白话说明。');
  return fortuneCard(prose.stdout, result, `${person.name}${title}`, question);
}

function nextMonthStart(month: string): string {
  const [year, m] = month.split('-').map(Number);
  return m === 12 ? `${year + 1}-01-01` : `${year}-${String(m + 1).padStart(2, '0')}-01`;
}

function hall(people: Pilgrim[]): HTMLElement[] {
  const person = pilgrimPicker('huangli-person', '看谁的日子', people);
  const outcome = h('div', { class: 'outcome cards', 'aria-live': 'polite' });
  const button = h('button', { type: 'button', class: 'primary', onclick: () => void ask() }, '看日子');
  const hint = h('p', { class: 'hint', 'aria-live': 'polite' });
  const zone = zoneStep('看日子', () => refresh());
  const asks = h('div', { class: 'row', role: 'radiogroup', 'aria-label': '问什么' },
    ...[...Object.entries(ASKS).map(([id, item]) => [id, item.label]), ['month', '某个月哪天办事']].map(([id, label], i) =>
      h('label', { class: 'choice' }, h('input', { type: 'radio', name: 'ask', value: id, ...(i === 1 ? { checked: true } : {}) }), label)));
  const month = h('input', { id: 'huangli-month', type: 'month' });
  const event = h('select', { id: 'huangli-event' }, ...Object.keys(EVENTS).map((name) => h('option', { value: name }, name)));
  const monthFields = h('div', { class: 'row', hidden: true },
    h('span', { class: 'zone-pick' }, h('label', { for: 'huangli-month' }, '哪个月'), month),
    h('span', { class: 'zone-pick' }, h('label', { for: 'huangli-event' }, '办什么事'), event));

  const chosen = () => (asks.querySelector<HTMLInputElement>('input:checked')?.value ?? 'week') as Ask;

  function refresh() {
    monthFields.hidden = chosen() !== 'month';
    const blocked = !zone.zone() ? '先确认时区。' : chosen() === 'month' && !month.value ? '先选哪个月。' : '';
    button.disabled = Boolean(blocked);
    hint.textContent = blocked;
  }

  async function show(work: () => Promise<CardModel>, waiting: string, keep: Node[] = []) {
    button.disabled = true;
    outcome.replaceChildren(...keep, h('p', { class: 'status' }, waiting));
    try {
      outcome.replaceChildren(...keep, await renderCard(await work()));
    } catch (error) {
      const message = error instanceof ToolFailed ? error.message : '算法包运行出错，请刷新页面再试。';
      outcome.replaceChildren(...keep, h('p', { class: 'status error', role: 'alert' }, message));
    } finally {
      refresh();
    }
  }

  async function ask() {
    const who = person.pick();
    const tz = zone.zone();
    if (!tz) return;
    const which = chosen();
    if (which !== 'month') {
      const item = ASKS[which];
      await show(() => reading(who, tz, item.period, item.question, item.title), '正在按出生年排日子，第一次要等算法包加载完…');
      return;
    }
    const name = event.value as EventName;
    const [year, m] = month.value.split('-').map(Number);
    const question = `${m}月想${name}，${m}月哪几天比较好？`;
    const pad = (n: number) => String(n).padStart(2, '0');
    const born = `${who.date.year}-${pad(who.date.month)}-${pad(who.date.day)}`;
    await show(async () => {
      const result = await runJson<MonthResult>({ script: 'huangli_query.py',
        argv: ['--month', month.value, '--question', question, '--person', `${who.name.replace(/[=,，]/g, '')}=${born}`] });
      return monthCard(result, `${year}年${m}月的日子`, question);
    }, '正在列这个月的日历…');
    const facts = [...outcome.childNodes];
    const grade = h('button', { type: 'button', onclick: () => void show(
      () => reading(who, tz, { start: `${month.value}-01`, end: nextMonthStart(month.value) }, `${m}月哪天${name}好`,
        `在${m}月${name}`, EVENTS[name]),
      '正在按出生年给这个月分等级…', facts) }, `按${who.name}的生年分等级（在 ${tz} 办）`);
    if (facts.some((node) => node instanceof HTMLElement && node.matches('article'))) outcome.append(grade);
  }

  for (const control of [asks, month]) control.addEventListener('change', refresh);
  refresh();
  return [
    h('div', { class: 'step' }, h('div', { class: 'row' }, person.field)),
    zone.element,
    h('fieldset', { class: 'step' }, h('legend', {}, '问什么'), asks, monthFields),
    h('div', { class: 'step' }, button, hint),
    outcome,
  ];
}

export function huangliHall(): HTMLElement {
  const body = h('div', { class: 'hall-body' }, h('p', { class: 'status' }, '正在读香客簿…'));
  void listPilgrims().then((people) => {
    body.replaceChildren(...(people.length ? hall(people) : [
      h('p', {}, '香客簿里还没有人。黄历亭要按出生年分等级，先录一个人。'),
      h('a', { href: '#/xiangke' }, '去香客簿添人'),
    ]));
  }).catch(() => body.replaceChildren(h('p', { class: 'status error', role: 'alert' }, '读不了香客簿，请检查是否关闭了网站数据存储。')));

  return h('section', { class: 'hall', 'aria-labelledby': 'hall-title' },
    h('a', { class: 'back', href: '#/' }, '回中庭'),
    h('div', { class: 'hall-head' }, moonGate('huangli'), h('h2', { id: 'hall-title', class: 'hall-title' }, '黄历亭')),
    h('p', { class: 'lede' }, '看今天、这一周、最近怎么样，或者某个月哪天办事。等级按《协纪辨方书》的相主，只看出生那一年的干支，是传统择日等级，不是对生活的预测。'),
    body,
  );
}

