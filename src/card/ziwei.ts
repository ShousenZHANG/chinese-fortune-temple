// ziwei_calc --focus-palace output to a 签文卡. For 事业 the tool writes the first three sentences itself
// (focus.career.first_answer). For other topics the spec takes the palace's own `say`, then every other reading the
// tool lists in condition_charts (a leap month, clock against true solar time), so a split shows on the first layer.
import { h } from '../dom';
import { citations, citesIn, entry, table, type CardModel, type Cite } from './card';

interface Palace {
  palace: string;
  branch: string;
  main_stars: string[];
}

interface Focus {
  palace: string;
  branch: string;
  main_stars: { name: string; brightness: string }[];
  borrowed_from_branch: string | null;
  borrowed_stars: string[];
  sihua_here: string[];
  opposite: Palace;
  trines: Palace[];
  quotes: Record<string, { passage_id: string; text: string }[]>;
  condition_checks: { star: string; passage_id: string; sentence: string; requires: string; chart: string; met: boolean }[];
  terms: Record<string, string>;
  held_back: string[];
  note_once?: string;
  say: string;
  condition_charts: { condition: string; used: boolean; branch: string; say: string; same: boolean }[];
  career?: { first_answer: { part: string; text: string }[] };
}

export interface ZiweiResult {
  say: string[];
  focus: Focus;
}

function firstLayer(focus: Focus): string[] {
  if (focus.career) return focus.career.first_answer.map((part) => part.text);
  return [focus.say, ...focus.condition_charts.filter((chart) => !chart.same).map((chart) => `${chart.condition}：${chart.say}`)];
}

function chart(result: ZiweiResult): HTMLElement {
  const focus = result.focus;
  const stars = focus.main_stars.length
    ? focus.main_stars.map((star) => `${star.name}（${star.brightness}）`).join('、')
    : `无主星${focus.borrowed_stars.length ? `，借${focus.borrowed_from_branch ?? '对宫'}的${focus.borrowed_stars.join('、')}` : ''}`;
  const palaceRow = (role: string, palace: Palace) => [role, palace.palace, palace.branch, palace.main_stars.join('、') || '无主星', ''];
  return h('div', { class: 'layer-body' },
    table(['', '宫位', '地支', '主星', '生年四化'], [
      ['本宫', focus.palace, focus.branch, stars, focus.sihua_here.join('、')],
      palaceRow('对宫', focus.opposite),
      ...focus.trines.map((trine) => palaceRow('三合', trine)),
    ], '三方四正'),
    table(['排法', '本次所用', '本宫地支'], focus.condition_charts.map((c) => [c.condition, c.used ? '是' : '否', c.branch]), '几种排法'),
    entry('整张盘', ...result.say.map((line) => h('p', {}, line))),
    entry('词语白话', ...Object.entries(focus.terms).map(([term, plain]) => h('p', {}, `${term}：${plain}`))),
    focus.held_back.length ? entry('只列位置、不作解释的星', h('p', {}, focus.held_back.join('、'))) : null,
    focus.note_once ? h('p', { class: 'note' }, focus.note_once) : null,
  );
}

function originals(result: ZiweiResult, first: string[]): HTMLElement {
  const focus = result.focus;
  const cites: Cite[] = [
    ...Object.entries(focus.quotes).flatMap(([star, quotes]) =>
      quotes.map((quote) => ({ id: quote.passage_id, label: `${star}在${focus.palace}的原句`, quote: quote.text }))),
    ...focus.condition_checks.map((check) => ({ id: check.passage_id, quote: check.sentence,
      label: `${check.star}：原句要${check.requires}，本盘是${check.chart}，${check.met ? '条件成立' : '条件不成立，这一层不套用'}` })),
    ...citesIn(first, '首段所引'),
    ...citesIn(result.say, '整张盘的格局所引'),
  ];
  return h('div', { class: 'layer-body' }, citations(cites) ?? h('p', {}, '这张盘没有引到原文。'));
}

export function ziweiCard(result: ZiweiResult, name: string, question: string): CardModel {
  const first = firstLayer(result.focus);
  return {
    question,
    title: `${name}的${result.focus.palace}`,
    first,
    conditions: [],
    chart: chart(result),
    originals: originals(result, first),
    facts: [result],
  };
}
