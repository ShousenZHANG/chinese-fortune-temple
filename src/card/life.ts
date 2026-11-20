// life_guide --decide output to a 签文卡. The first layer is the tool's --markdown prose, line for line, without
// its source line (shown in the third layer) and its note to the host. The second layer tabulates every entry the
// prose names; the third gives the book, its snapshot, licence, and the region the advice follows.
import { h } from '../dom';
import { entry, table, type CardModel } from './card';

interface BookEntry {
  citation: string;
  ratio: string;
  grade: string;
  lens: string;
  costs: string[];
}

export interface LifeResult {
  source: { repo: string; commit: string; snapshot_date: string; license: string; license_url: string; attribution: string };
  region: { region: string; basis: string; timezone: string };
  decision: {
    source: string;
    do: { lens: string; entries: BookEntry[] }[];
    dont: { lens: string; entries: BookEntry[] }[];
    stop?: { kind: string; first_action: string; entries: BookEntry[] } | null;
  };
}

const SOURCE_LINE = '出处：';
const HOST_ONLY = '写回答时：';

export const lifeLead = (markdown: string): string[] =>
  markdown.split('\n').filter((line) => line.trim() && !line.startsWith(SOURCE_LINE) && !line.startsWith(HOST_ONLY));

function entries(result: LifeResult): string[][] {
  const { decision } = result;
  const row = (kind: string) => (item: BookEntry) => [item.citation, kind, item.lens, item.ratio, item.grade, item.costs.join('、')];
  return [
    ...(decision.stop?.entries ?? []).map(row('现在就做')),
    ...decision.do.flatMap((group) => group.entries.map(row('先做'))),
    ...decision.dont.flatMap((group) => group.entries.map(row('别做'))),
  ];
}

export function lifeCard(markdown: string, result: LifeResult, question: string): CardModel {
  const rows = entries(result);
  const { source, region } = result;
  return {
    question,
    title: result.decision.stop ? '先做这一步' : '按《高性价比人生指南》',
    first: lifeLead(markdown),
    conditions: [],
    chart: h('div', { class: 'layer-body' },
      rows.length ? table(['条目', '', '口径', '性价比', '证据等级', '成本'], rows, '用到的条目') : h('p', {}, '书里没有对上这件事的条目。'),
      h('p', { class: 'note' }, `按${region.region}的规定和求助渠道答（依据你确认的时区 ${region.timezone}）。`)),
    originals: h('div', { class: 'layer-body' },
      entry('出处', h('p', {}, result.decision.source)),
      entry('版本与许可', h('p', {}, `${source.attribution}，冻结在提交 ${source.commit.slice(0, 8)}（${source.snapshot_date}），正文按 ${source.license} 使用。`),
        h('a', { href: source.license_url, rel: 'noopener', target: '_blank' }, `${source.license} 许可原文`))),
    facts: [result],
  };
}
