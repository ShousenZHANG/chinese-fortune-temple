// 签文卡 (spec: three layers). The first layer is the tool's own wording, unchanged; the second opens with the
// conditions the tool says can already be checked, then the chart; the third is original text, each passage
// fetched by its id. Before anything is shown, every sentence the card states (first layer and conditions) goes
// through the Skill's answer_check against the tool results it came from; a card with errors is withheld.
import { h, type Child } from '../dom';
import { rememberSource } from '../records/handoff';
import { runJson, runTool, skillVersion } from '../skill/session';

export interface CardModel {
  question: string;
  title: string;
  glyph?: Node;
  /** Paragraphs exactly as the tool wrote them. */
  first: string[];
  /** The tool's own sentences that must follow the first layer (for liuyao: reading_plan.say and must_cover). */
  conditions: string[];
  chart: Node;
  originals: Node;
  /** Tool results the first layer may be checked against. */
  facts: unknown[];
}

interface Finding {
  code: string;
  severity: string;
  excerpt?: string;
  detail?: string;
}

interface CheckReport {
  passed: boolean;
  findings: Finding[];
}

async function check(model: CardModel): Promise<Finding[]> {
  // answer_check exits non-zero when it finds errors, so read its report whatever the exit code.
  const result = await runTool({
    script: 'answer_check.py', argv: ['--stdin'],
    stdin: JSON.stringify({ answer: [...model.first, ...model.conditions].join('\n'), facts: model.facts }),
  });
  const report = JSON.parse(result.stdout) as CheckReport;
  const errors = report.findings.filter((finding) => finding.severity === 'error');
  if (!report.passed && !errors.length) return [{ code: 'not_passed', severity: 'error' }];
  return errors;
}

export async function renderCard(model: CardModel): Promise<HTMLElement> {
  const errors = await check(model);
  if (errors.length) {
    return h('div', { class: 'card-withheld', role: 'alert' },
      h('p', {}, '这张签没有通过自检，所以不显示。自检发现：'),
      h('ul', {}, ...errors.map((error) => h('li', {}, [error.detail ?? error.code, error.excerpt && `「${error.excerpt}」`]
        .filter(Boolean).join('：')))),
    );
  }
  return h('article', { class: 'card', 'aria-label': '签文卡' },
    h('header', { class: 'card-head' },
      model.glyph ?? null,
      h('div', {},
        h('h2', { class: 'card-title' }, model.title),
        h('p', { class: 'card-question' }, `所问：${model.question}`),
      ),
    ),
    h('div', { class: 'card-first', 'data-testid': 'first-answer' }, ...model.first.map((text) => h('p', {}, text))),
    h('details', { class: 'card-layer' }, h('summary', {}, '看盘面'),
      model.conditions.length
        ? h('div', { class: 'layer-body' }, entry('已能核的条件', ...model.conditions.map((text) => h('p', {}, text))))
        : null,
      model.chart),
    h('details', { class: 'card-layer' }, h('summary', {}, '看原文'), model.originals),
    h('footer', { class: 'card-foot' },
      h('button', { type: 'button', class: 'chip', onclick: () => {
        rememberSource({ title: model.title, question: model.question });
        location.hash = '#/xuyuan';
      } }, '就此事许个愿'),
      h('span', { class: 'seal', 'data-testid': 'skill-mark' }, skillVersion())),
  );
}

/** A label/value block used inside the layers. */
export function entry(label: string, ...body: Child[]): HTMLElement {
  return h('div', { class: 'entry' }, h('p', { class: 'entry-label' }, label), ...body);
}

/** A small table: the first cell of each row is its header; a caption also names the table. */
export function table(head: string[], rows: string[][], caption?: string): HTMLElement {
  return h('div', { class: 'table-scroll' },
    h('table', {},
      caption ? h('caption', {}, caption) : null,
      h('thead', {}, h('tr', {}, ...head.map((label) => h('th', { scope: 'col' }, label)))),
      h('tbody', {}, ...rows.map(([first, ...rest]) => h('tr', {}, h('th', { scope: 'row' }, first),
        ...rest.map((cell) => h('td', {}, cell))))),
    ),
  );
}

/** One reason a passage is on the card: what it backs, and the tool's own quote of it if there is one. */
export interface Cite {
  id: string;
  label: string;
  quote?: string;
}

const PASSAGE_ID = /\b[a-z_]+:c\d{3}:p\d{4}\b/g;

/** Full passage ids written inside a tool sentence, each cited with the same label. */
export const citesIn = (sentences: string[], label: string): Cite[] =>
  sentences.flatMap((text) => (text.match(PASSAGE_ID) ?? []).map((id) => ({ id, label })));

/** 所据条文: each passage once, with every item it backs and an opener for its full text. */
export function citations(cites: Cite[], note?: string): HTMLElement | null {
  const backing = new Map<string, { labels: string[]; quote?: string }>();
  for (const cite of cites) {
    const known = backing.get(cite.id) ?? { labels: [] };
    const labels = known.labels.includes(cite.label) ? known.labels : [...known.labels, cite.label];
    backing.set(cite.id, { labels, quote: known.quote ?? cite.quote });
  }
  if (!backing.size) return null;
  return entry('所据条文',
    ...[...backing].map(([id, item]) => h('div', { class: 'citation' },
      ...item.labels.map((label) => h('p', {}, label)),
      item.quote ? h('p', { class: 'classic' }, item.quote) : null,
      passage(id))),
    note ? h('p', { class: 'note' }, note) : null);
}

interface PassageResult {
  results: { book_title?: string; chapter_title?: string; section?: string; text: string; use_limit?: string }[];
}

/** A passage id the visitor can open; the text comes from classical_search, not from this page. */
export function passage(id: string): HTMLElement {
  const text = h('div', { class: 'passage-text', 'data-testid': `passage-${id}`, hidden: true });
  const button = h('button', { type: 'button', class: 'passage-id', 'aria-expanded': 'false' }, id);
  button.addEventListener('click', async () => {
    const open = button.getAttribute('aria-expanded') === 'true';
    if (open || text.childElementCount) {
      button.setAttribute('aria-expanded', String(!open));
      text.hidden = open;
      return;
    }
    button.disabled = true;
    try {
      const found = await runJson<PassageResult>({ script: 'classical_search.py', argv: ['--passage-id', id] });
      const hit = found.results[0];
      text.replaceChildren(hit
        ? h('figure', {},
          h('blockquote', {}, hit.text),
          h('figcaption', {}, [hit.book_title && `《${hit.book_title}》`, hit.chapter_title, hit.section].filter(Boolean).join(' ')),
          hit.use_limit ? h('p', { class: 'passage-limit' }, hit.use_limit) : null)
        : h('p', {}, '随包古籍里没有查到这一段。'));
    } catch (error) {
      text.replaceChildren(h('p', {}, error instanceof Error ? error.message : '原文没有取到。'));
    } finally {
      button.disabled = false;
      button.setAttribute('aria-expanded', 'true');
      text.hidden = false;
    }
  });
  return h('span', { class: 'passage' }, button, text);
}
