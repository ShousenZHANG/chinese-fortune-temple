// 黄历亭 cards. A personal reading is fortune_reading run twice on one request: --markdown gives the visitor-facing
// prose, the JSON gives the facts answer_check and the tables read. The first layer is the prose up to its date-range
// paragraph; the rest follows in the second layer, except the paragraph addressed to the host ("写回答时：").
// A month's calendar facts come from huangli_query and are city-independent; grading them is a separate request.
import { h } from '../dom';
import { citations, citesIn, entry, table, type CardModel, type Cite } from './card';

interface Factor {
  label: string;
  plain: string;
  polarity?: string;
  quote?: string;
  passage_id?: string;
}

interface EventHit {
  label: string;
  plain: string;
  quote?: string;
  passage_id?: string;
}

interface CalendarEntry {
  label: string;
  ganzhi: string;
  grade: string;
  people: { days: { factors: Factor[]; context?: Record<string, { factors?: Factor[] }> }[] }[];
  event_hits?: EventHit[];
}

export interface FortuneResult {
  personal_calendar?: { unit: string; timezone: string; entries: CalendarEntry[] } | null;
}

export interface MonthResult {
  month: string;
  say: string;
  not_ranked: string;
  rows: { date: string; ganzhi: string; jian_chu: string; prohibitions: Record<string, string[]>; clashes: string[] }[];
}

const HOST_ONLY = '写回答时：';
const TERMS = '术语：';

function split(markdown: string): { lead: string[]; rest: string[] } {
  const paragraphs = markdown.split('\n\n').map((p) => p.trim()).filter(Boolean);
  const range = paragraphs.findIndex((p) => p.startsWith('日期：'));
  const cut = range >= 0 ? range + 1 : 1;
  return { lead: paragraphs.slice(0, cut), rest: paragraphs.slice(cut).filter((p) => !p.startsWith(HOST_ONLY)) };
}

const dayFactors = (item: CalendarEntry): Factor[] => item.people.flatMap((person) => person.days.flatMap((day) => day.factors));
const contextFactors = (item: CalendarEntry): Factor[] => item.people.flatMap((person) => person.days.flatMap((day) =>
  Object.values(day.context ?? {}).flatMap((layer) => layer.factors ?? [])));

function reasons(item: CalendarEntry): string {
  const labels = dayFactors(item).filter((f) => f.polarity !== 'note').map((f) => f.label);
  const hits = (item.event_hits ?? []).map((hit) => `${hit.label}（原文忌日）`);
  return [...new Set([...labels, ...hits])].join('、');
}

function calendarTable(result: FortuneResult): HTMLElement | null {
  const calendar = result.personal_calendar;
  if (!calendar?.entries.length) return null;
  return table(['日期', '干支', '等级', '当天的理由'],
    calendar.entries.map((item) => [item.label, item.ganzhi, item.grade, reasons(item)]),
    calendar.unit === 'day' ? '逐日等级' : '逐月等级');
}

function fortuneCites(result: FortuneResult, prose: string[]): Cite[] {
  const entries = result.personal_calendar?.entries ?? [];
  const factors = entries.flatMap((item) => [...dayFactors(item), ...contextFactors(item)]);
  const hits = entries.flatMap((item) => item.event_hits ?? []);
  return [
    ...hits.flatMap((hit) => hit.passage_id ? [{ id: hit.passage_id, label: `${hit.label}：${hit.plain}`, quote: hit.quote }] : []),
    ...factors.flatMap((f) => f.passage_id ? [{ id: f.passage_id, label: `相主「${f.label}」`, quote: f.quote }] : []),
    ...citesIn(prose, '白话说明所引'),
  ];
}

export function fortuneCard(markdown: string, result: FortuneResult, title: string, question: string): CardModel {
  const { lead, rest } = split(markdown);
  const terms = rest.filter((p) => p.startsWith(TERMS));
  const body = rest.filter((p) => !p.startsWith(TERMS));
  return {
    question,
    title,
    first: lead,
    conditions: [],
    chart: h('div', { class: 'layer-body' },
      calendarTable(result),
      ...body.map((p) => h('p', {}, p)),
      terms.length ? entry('词语白话', ...terms.map((p) => h('p', {}, p.slice(TERMS.length)))) : null),
    originals: h('div', { class: 'layer-body' },
      citations(fortuneCites(result, [...lead, ...rest])) ?? h('p', {}, '这次没有引到原文。')),
    facts: [result],
  };
}

export function monthCard(result: MonthResult, title: string, question: string): CardModel {
  return {
    question,
    title,
    first: [result.say, result.not_ranked],
    conditions: [],
    chart: h('div', { class: 'layer-body' }, table(['日期', '干支', '建除', '冲生年', '所问事项有原文忌日'],
      result.rows.map((row) => [`${Number(row.date.slice(5, 7))}月${Number(row.date.slice(8))}日`, row.ganzhi, row.jian_chu, row.clashes.join('、'),
        Object.values(row.prohibitions).some((rules) => rules.length) ? '有' : '']), '整月日历')),
    originals: h('div', { class: 'layer-body' },
      h('p', {}, '整月日历只列事实，不引原文；按生年分等级之后，每条忌日和等级都附原文出处。')),
    facts: [result],
  };
}
