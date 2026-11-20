// liuyao_cast output to a 签文卡. Every word on the card comes from the tool's fields; this file only lays them out.
import { h } from '../dom';
import { glyph, positionName } from '../glyph';
import { citations, citesIn, entry, type CardModel, type Cite } from './card';

interface Line {
  position: number;
  visual: string;
  stem: string;
  branch: string;
  wuxing: string;
  liu_qin: string;
  liu_shen?: string;
  state?: string;
  is_shi: boolean;
  is_ying: boolean;
}

interface Chart {
  hex_name: string;
  palace: string;
  palace_wuxing: string;
  lines: Line[];
}

interface Reference {
  passage_id: string;
  quote?: string;
}

export interface LiuyaoResult {
  question: string;
  raw_lines: number[];
  main_chart: Chart;
  changed_chart?: Chart | null;
  active_lines: number[];
  cast_time: { solar: string; year_ganzhi: string; month_ganzhi: string; day_ganzhi: string; hour_ganzhi: string };
  main_judgment?: string;
  main_image?: string;
  active_line_text?: { position: number; text: string }[];
  yongshen_hint?: string;
  yongshen_hint_source?: (Reference & { keyword?: string; mapping?: string }) | null;
  rule_checks?: { hits?: (Reference & { name: string })[]; meaning?: string };
  timing?: { horizon?: Reference | null };
  reading_plan?: { say?: string[] };
  must_cover?: { what: string }[];
  first_answer: { part: string; text: string }[];
}

function conditions(result: LiuyaoResult): string[] {
  return [...(result.reading_plan?.say ?? []), ...(result.must_cover ?? []).map((item) => item.what)];
}

function chartTable(result: LiuyaoResult): HTMLElement {
  const changed = result.changed_chart;
  const rows = [...result.main_chart.lines].reverse().map((line) => {
    const moved = result.active_lines.includes(line.position) ? changed?.lines[line.position - 1] : undefined;
    return h('tr', {},
      h('th', { scope: 'row' }, positionName(line.position - 1)),
      h('td', { class: 'visual' }, line.visual),
      h('td', {}, line.liu_shen ?? ''),
      h('td', {}, line.liu_qin),
      h('td', {}, `${line.stem}${line.branch}${line.wuxing}`),
      h('td', {}, line.state ?? ''),
      h('td', {}, line.is_shi ? '世' : line.is_ying ? '应' : ''),
      h('td', {}, moved ? `${moved.liu_qin} ${moved.stem}${moved.branch}${moved.wuxing}` : ''),
    );
  });
  const time = result.cast_time;
  return h('div', { class: 'layer-body' },
    h('p', {}, `起卦时间 ${time.solar}，${time.year_ganzhi}年 ${time.month_ganzhi}月 ${time.day_ganzhi}日 ${time.hour_ganzhi}时。`
      + `本卦属${result.main_chart.palace}（${result.main_chart.palace_wuxing}）。`),
    result.yongshen_hint ? h('p', {}, result.yongshen_hint) : null,
    h('div', { class: 'table-scroll' },
      h('table', {},
        h('thead', {}, h('tr', {}, ...['爻位', '爻象', '六神', '六亲', '纳甲', '旺衰', '世应', changed ? `变爻（${changed.hex_name}）` : '变爻']
          .map((label) => h('th', { scope: 'col' }, label)))),
        h('tbody', {}, ...rows),
      ),
    ),
  );
}

function originals(result: LiuyaoResult): HTMLElement {
  const cite = (ref: Reference | null | undefined, label: string): Cite[] =>
    ref?.passage_id ? [{ id: ref.passage_id, label, quote: ref.quote }] : [];
  const source = result.yongshen_hint_source;
  const cites = [
    ...cite(source, source?.mapping ? `用神取法：${source.mapping}` : '用神取法'),
    ...(result.rule_checks?.hits ?? []).flatMap((hit) => cite(hit, `条件齐备：${hit.name}`)),
    ...cite(result.timing?.horizon, '应期远近'),
    ...citesIn(conditions(result), '盘面条件所引'),
  ];

  return h('div', { class: 'layer-body' },
    result.main_judgment ? entry('卦辞', h('p', { class: 'classic' }, result.main_judgment)) : null,
    result.main_image ? entry('象辞', h('p', { class: 'classic' }, result.main_image)) : null,
    result.active_line_text?.length
      ? entry('动爻爻辞', ...result.active_line_text.map((line) => h('p', { class: 'classic' }, line.text)))
      : null,
    citations(cites, result.rule_checks?.meaning),
  );
}

export function liuyaoCard(result: LiuyaoResult): CardModel {
  const changed = result.changed_chart && result.active_lines.length ? result.changed_chart.hex_name : '';
  return {
    question: result.question,
    title: changed ? `${result.main_chart.hex_name} 之 ${changed}` : result.main_chart.hex_name,
    glyph: glyph(result.raw_lines),
    first: result.first_answer.map((part) => part.text),
    conditions: conditions(result),
    chart: chartTable(result),
    originals: originals(result),
    facts: [result],
  };
}
