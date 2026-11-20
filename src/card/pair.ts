// pair_facts output to a 签文卡. The first layer is the tool's `say`, line for line; it ends one line with
// "明细见 relations", so the second layer names its relation table that way.
import { h } from '../dom';
import { citations, citesIn, entry, table, type CardModel, type Cite } from './card';

type Pillar = 'year' | 'month' | 'day' | 'hour';
type Side = 'A' | 'B';

interface Subject {
  four_pillars: Partial<Record<Pillar, string>>;
  undecided_pillars: Partial<Record<Pillar, string[]>>;
  hour_known: boolean;
}

interface Relation {
  kind: string;
  a?: string;
  b?: string;
  from_a?: string[];
  from_b?: string[];
  group?: string;
  transforms_to?: string;
  type?: string;
  class?: string;
  stems?: string[];
}

interface Placement {
  year: number;
  yuan: string;
  epoch_year: number;
  start_palace: number;
  direction: string;
  steps: number;
  palace: number;
  trigram: string;
}

interface Sanyuan {
  method: string;
  male: Placement;
  female: Placement;
  relation?: string;
  star?: string;
  source_ids: string[];
  dissent?: { passage_id: string; quote: string };
}

interface Clause {
  id: string;
  passage_id: string;
  positions: string[];
  claim: string;
  not_computed: string[];
}

export interface PairResult {
  subjects: Record<Side, Subject>;
  day_masters: { A?: string; B?: string; A_sees_B?: string; B_sees_A?: string };
  relations: Relation[];
  say: string[];
  sanyuan_jiugong: Sanyuan | null;
  must_cover?: { what: string }[];
  classical_clauses: { matched: Clause[]; not_computed_methods: string[]; meaning: string };
  notes: string[];
  boundary: string;
}

const PILLARS: [Pillar, string][] = [['year', '年柱'], ['month', '月柱'], ['day', '日柱'], ['hour', '时柱']];
// pair_facts.py KIND_NAMES, plus the hidden-stem pairs its `say` only counts.
const KIND_NAMES: Record<string, string> = {
  tiangan_he: '天干五合', dizhi_liu_he: '地支六合', san_he: '跨盘三合', ban_san_he: '半合', dizhi_chong: '六冲',
  dizhi_xing: '刑', san_xing: '跨盘三刑', dizhi_hai: '六害', san_hui: '跨盘三会', ban_san_hui: '半会',
  same_pillar: '干支相同', same_branch_class: '同属', canggan_he: '藏干相合（暗合候选）',
};

/** must_cover items the first layer does not already say word for word; answer_check needs every one stated. */
function conditions(result: PairResult): string[] {
  return (result.must_cover ?? []).map((item) => item.what).filter((what) => !result.say.some((line) => line.includes(what)));
}

function pillarCell(subject: Subject, pillar: Pillar): string {
  const fixed = subject.four_pillars[pillar];
  if (fixed) return fixed;
  if (pillar === 'hour' && !subject.hour_known) return '时辰不知道';
  const candidates = subject.undecided_pillars[pillar] ?? [];
  return candidates.length ? `未定：${candidates.join(' 或 ')}` : '未定';
}

function relationRow(row: Relation): string[] {
  const name = KIND_NAMES[row.kind] ?? row.kind;
  const detail = row.transforms_to ? `合${row.transforms_to}` : row.type ?? row.class ?? row.stems?.join('、') ?? '';
  return row.from_a
    ? [name, (row.from_a ?? []).join('、'), (row.from_b ?? []).join('、'), `凑成${row.group ?? ''}`]
    : [name, row.a ?? '', row.b ?? '', detail];
}

function sanyuanTable(sanyuan: Sanyuan): HTMLElement {
  const row = (who: string, p: Placement) => [who, String(p.year), `${p.yuan}（${p.epoch_year} 年甲子起）`,
    `${p.start_palace} 宫`, p.direction, `${p.steps} 步`, `${p.trigram}${p.palace} 宫`];
  return table(['', '出生年', '三元', '起宫', '顺逆', '步数', '落宫'], [row('男方', sanyuan.male), row('女方', sanyuan.female)],
    `${sanyuan.method}${sanyuan.relation ? `：合成${sanyuan.relation}${sanyuan.star ? `（${sanyuan.star}）` : ''}` : ''}`);
}

function chart(result: PairResult, names: Record<Side, string>): HTMLElement {
  const masters = result.day_masters;
  const clauses = result.classical_clauses;
  return h('div', { class: 'layer-body' },
    h('p', { class: 'note' }, result.boundary),
    table(['', names.A, names.B], [
      ...PILLARS.map(([pillar, label]) => [label, pillarCell(result.subjects.A, pillar), pillarCell(result.subjects.B, pillar)]),
      ['日主', masters.A ?? '未定', masters.B ?? '未定'],
    ], '两人四柱（A 为前一位，B 为后一位）'),
    result.relations.length
      ? table(['关系', 'A', 'B', '说明'], result.relations.map(relationRow), 'relations：两盘逐柱关系明细')
      : h('p', {}, '两盘之间没有列出的关系。'),
    result.sanyuan_jiugong ? sanyuanTable(result.sanyuan_jiugong) : h('p', {}, '三元九宫合婚要一男一女且年柱已定，这一对没有算。'),
    clauses.not_computed_methods.length ? entry('没有算的合婚法', h('p', {}, clauses.not_computed_methods.join('、'))) : null,
    ...result.notes.map((note) => h('p', { class: 'note' }, note)),
  );
}

function originals(result: PairResult): HTMLElement {
  const sanyuan = result.sanyuan_jiugong;
  const cites: Cite[] = [
    ...(sanyuan?.source_ids ?? []).map((id) => ({ id, label: `${sanyuan?.method ?? '三元九宫'}的起法与合卦` })),
    ...(sanyuan?.dissent ? [{ id: sanyuan.dissent.passage_id, label: '《协纪辨方书》对此法的驳议', quote: sanyuan.dissent.quote }] : []),
    ...result.classical_clauses.matched.map((clause) => ({ id: clause.passage_id,
      label: `合婚条款 ${clause.id}：原句结论「${clause.claim}」，柱位 ${clause.positions.join('、')}`
        + (clause.not_computed.length ? `；没有核的：${clause.not_computed.join('、')}` : '') })),
    ...citesIn(result.say, '盘面一句所引'),
  ];
  return h('div', { class: 'layer-body' },
    citations(cites, result.classical_clauses.meaning) ?? h('p', {}, '这一对没有引到原文。'));
}

export function pairCard(result: PairResult, names: Record<Side, string>, question: string): CardModel {
  return {
    question,
    title: `${names.A}与${names.B}`,
    first: result.say,
    conditions: conditions(result),
    chart: chart(result, names),
    originals: originals(result),
    facts: [result],
  };
}
