// 每日一签 (spec story 58): a hexagram cast by yijing_cast, and the 焦氏易林 verse for 本卦之之卦 from yilin_lookup.
// The first layer quotes the 元刊本 verse with its passage id and the tool's own boundary; the 四库本 reading sits
// beside it in the second layer. A glyph the source cannot encode is shown as □, the usual mark for a missing
// character, never as a guess.
import { h } from '../dom';
import { glyph } from '../glyph';
import { citations, table, type CardModel, type Cite } from './card';

export interface CastResult {
  raw_lines: number[];
  main_hex: { name: string };
  changed_hex: { name: string } | null;
  summary: string;
}

interface Version {
  book: string;
  edition: string;
  passage_id: string;
  text: string | null;
}

export interface LinResult {
  boundary: string;
  lin: { key: string; versions: Version[] };
}

// The same reading of glyph markers as answer_check: 〔字形…：X〕 with one trustworthy character X reads as X; any
// other marker (未编码, a description) is a character the source cannot give, shown as □.
const GLYPH = /〔字形[^：〕]*：([^〕未])〕/g;
const MARKER = /〔[^〕]*〕/g;
export const verse = (text: string): string => text.replace(GLYPH, '$1').replace(MARKER, '□');

/** The yilin_lookup name of a hexagram: 乾为天 -> 乾, 风天小畜 -> 小畜 (two trigram characters, then the name). */
export const shortName = (name: string): string => (name.includes('为') ? name.split('为')[0] : name.slice(2));

export function dailyCard(cast: CastResult, lin: LinResult, date: string): CardModel {
  const versions = lin.lin.versions.filter((v): v is Version & { text: string } => Boolean(v.text));
  const yuan = versions.find((v) => v.book === 'yilin');
  const main = yuan ?? versions[0];
  // chinese-fortune v6.3.0's answer_check reads yilin_siku:… as siku:… (fixed in chinese-fortune#22, unreleased), so a
  // verse only the 四库本 has is listed without quotation marks until the Skill is upgraded; it is still the tool's text.
  const lead = yuan
    ? `《焦氏易林》${lin.lin.key}：「${verse(yuan.text)}」（${yuan.passage_id}）`
    : `《焦氏易林》${lin.lin.key}（元刊本缺这一林，下为四库本，${main.passage_id}）：${verse(main.text)}`;
  const cites: Cite[] = versions.map((v) => ({ id: v.passage_id, label: v.edition, quote: verse(v.text) }));
  return {
    question: `每日一签（${date}）`,
    title: lin.lin.key,
    glyph: glyph(cast.raw_lines),
    first: [lead, lin.boundary],
    conditions: [],
    chart: h('div', { class: 'layer-body' },
      h('p', {}, cast.summary),
      table(['版本', '林辞', '段号'], lin.lin.versions.map((v) => [v.edition, v.text ? verse(v.text) : '（缺）', v.passage_id]), '两个版本并列'),
      h('p', { class: 'note' }, '一天一支：同一台设备同一天抽到的是同一支，不能重抽。')),
    originals: h('div', { class: 'layer-body' }, citations(cites)),
    facts: [cast, lin],
    share: [`「${verse(main.text)}」`],
    strokes: cast.raw_lines,
  };
}
