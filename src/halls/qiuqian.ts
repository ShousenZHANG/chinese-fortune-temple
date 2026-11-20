// 求签殿: the visitor writes one question, confirms the time zone, and tosses three coins six times.
// A toss made here is recorded at once; with their own coins they set each face and record it. No toss can be
// taken back, because the Skill forbids drawing again for a preferred hexagram (references/04-liuyao.md).
import { moonGate } from '../art';
import { liuyaoCard, type LiuyaoResult } from '../card/liuyao';
import { renderCard } from '../card/card';
import { h } from '../dom';
import { tr } from '../i18n';
import { lineName, positionName, stroke } from '../glyph';
import { guessedTimezone, localMoment } from '../moment';
import { runJson, ToolFailed } from '../skill/session';
import { zoneStep } from '../zone';

const PRESETS = ['这次面试能不能过', '这次考试能不能过', '这段感情能不能成', '押金能不能退回来'];
const ORDINALS = ['一', '二', '三'];
const MAX_QUESTION = 100;

function randomBacks(): boolean[] {
  const bytes = crypto.getRandomValues(new Uint8Array(3));
  return [...bytes].map((byte) => (byte & 1) === 1);
}

export function qiuqianHall(): HTMLElement {
  let backs = [false, false, false];
  let lines: number[] = [];

  const question = h('input', { id: 'question', type: 'text', maxlength: String(MAX_QUESTION), autocomplete: 'off',
    placeholder: tr('例如：这次面试能不能过', 'For example: 这次面试能不能过 (write in Chinese for the Skill)') });
  const zone = zoneStep('起卦', () => refresh());
  const coins = ORDINALS.map((ordinal, i) => h('button', { type: 'button', class: 'coin', 'aria-label': tr(`第${ordinal}枚铜钱`, `Coin ${i + 1}`),
    'aria-pressed': 'false', onclick: () => setFace(i, !backs[i]) }, tr('字', 'Face')));
  const tossHere = h('button', { type: 'button', class: 'primary', onclick: () => record(randomBacks(), true) }, tr('掷一次', 'Toss once'));
  const tossOwn = h('button', { type: 'button', onclick: () => record(backs, false) }, tr('照这样记下', 'Record as set'));
  const hint = h('p', { class: 'hint', 'aria-live': 'polite' });
  const recorded = h('ol', { class: 'recorded', 'aria-label': tr('已记下的爻（自下而上）', 'Recorded lines (bottom to top)') });
  const outcome = h('div', { class: 'outcome', 'aria-live': 'polite' });

  function setFace(i: number, back: boolean) {
    backs = backs.map((value, j) => (j === i ? back : value));
    coins[i].setAttribute('aria-pressed', String(back));
    coins[i].textContent = back ? tr('背', 'Back') : tr('字', 'Face');
  }

  function refresh() {
    const done = lines.length === 6;
    const blocked = done ? '' : !question.value.trim() ? tr('先写下所问之事。', 'Write down your question first.') : !zone.zone() ? tr('先确认时区。', 'Confirm the time zone first.') : '';
    for (const button of [tossHere, tossOwn, ...coins]) button.disabled = done || Boolean(blocked);
    question.readOnly = lines.length > 0;
    hint.textContent = blocked || (done ? '' : tr(`还要掷 ${6 - lines.length} 次。`, `${6 - lines.length} tosses to go.`));
  }

  function record(faces: boolean[], animate: boolean) {
    if (lines.length === 6) return;
    faces.forEach((back, i) => setFace(i, back));
    if (animate) for (const coin of coins) coin.animate?.([{ transform: 'rotateX(0)' }, { transform: 'rotateX(720deg)' }],
      { duration: 420, easing: 'ease-out' });
    const value = 6 + faces.filter(Boolean).length;
    lines = [...lines, value];
    recorded.append(h('li', { 'data-testid': 'recorded-line' }, stroke(value),
      h('span', {}, `${positionName(lines.length - 1)} ${lineName(value)}`)));
    refresh();
    if (lines.length === 6) void cast();
  }

  async function cast() {
    const timezone = zone.zone() ?? guessedTimezone();
    const now = localMoment(timezone);
    outcome.replaceChildren(h('p', { class: 'status' }, tr('正在起卦，第一次要等算法包加载完…', 'Casting. The first time waits for the Skill to load…')));
    try {
      const result = await runJson<LiuyaoResult>({ script: 'liuyao_cast.py', argv: ['coins', '--lines', lines.join(','),
        '--date', now.date, '--time', now.time, '--target-timezone', timezone, '--question', question.value.trim()] });
      outcome.replaceChildren(await renderCard(liuyaoCard(result)));
    } catch (error) {
      const message = error instanceof ToolFailed ? error.message : tr('算法包运行出错，请刷新页面再试。', 'The Skill ran into an error. Please refresh the page.');
      outcome.replaceChildren(h('p', { class: 'status error', role: 'alert' }, message));
    }
  }

  question.addEventListener('input', refresh);
  refresh();

  return h('section', { class: 'hall', 'aria-labelledby': 'hall-title' },
    h('a', { class: 'back', href: '#/' }, tr('回中庭', 'Back to the courtyard')),
    h('div', { class: 'hall-head' }, moonGate('qiuqian'), h('h2', { id: 'hall-title', class: 'hall-title' }, tr('求签殿', 'Coin Hall'))),
    h('p', { class: 'lede' }, tr('想好一件具体的事，掷三枚铜钱六次。每一次是一爻，从下往上排。', 'Think of one specific matter and toss three coins six times. Each toss is one line, stacked from the bottom up.')),
    h('div', { class: 'step' },
      h('label', { for: 'question' }, tr('所问之事', 'Your question')),
      question,
      h('div', { class: 'row presets' }, ...PRESETS.map((text) => h('button', { type: 'button', class: 'chip', onclick: () => {
        if (question.readOnly) return;
        question.value = text;
        refresh();
      } }, text))),
    ),
    zone.element,
    h('div', { class: 'step toss' },
      h('div', { class: 'coins' }, ...coins),
      h('p', { class: 'hint' }, tr('一背为少阳，两背为少阴，三背为老阳，三字为老阴。用自己的铜钱掷时，点铜钱照落地的样子翻面，再点「照这样记下」。记下的爻不能撤回。', 'One back is young yang, two backs young yin, three backs old yang, three faces old yin. With your own coins, tap each coin to match how it landed, then Record as set. A recorded line cannot be taken back.')),
      h('div', { class: 'row' }, tossHere, tossOwn),
      hint,
      recorded,
    ),
    outcome,
  );
}
