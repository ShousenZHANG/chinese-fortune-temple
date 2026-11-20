// 求签殿: the visitor writes one question, confirms the time zone, and tosses three coins six times.
// A toss made here is recorded at once; with their own coins they set each face and record it. No toss can be
// taken back, because the Skill forbids drawing again for a preferred hexagram (references/04-liuyao.md).
import { moonGate } from '../art';
import { liuyaoCard, type LiuyaoResult } from '../card/liuyao';
import { renderCard } from '../card/card';
import { h } from '../dom';
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
    placeholder: '例如：这次面试能不能过' });
  const zone = zoneStep('起卦', () => refresh());
  const coins = ORDINALS.map((ordinal, i) => h('button', { type: 'button', class: 'coin', 'aria-label': `第${ordinal}枚铜钱`,
    'aria-pressed': 'false', onclick: () => setFace(i, !backs[i]) }, '字'));
  const tossHere = h('button', { type: 'button', class: 'primary', onclick: () => record(randomBacks(), true) }, '掷一次');
  const tossOwn = h('button', { type: 'button', onclick: () => record(backs, false) }, '照这样记下');
  const hint = h('p', { class: 'hint', 'aria-live': 'polite' });
  const recorded = h('ol', { class: 'recorded', 'aria-label': '已记下的爻（自下而上）' });
  const outcome = h('div', { class: 'outcome', 'aria-live': 'polite' });

  function setFace(i: number, back: boolean) {
    backs = backs.map((value, j) => (j === i ? back : value));
    coins[i].setAttribute('aria-pressed', String(back));
    coins[i].textContent = back ? '背' : '字';
  }

  function refresh() {
    const done = lines.length === 6;
    const blocked = done ? '' : !question.value.trim() ? '先写下所问之事。' : !zone.zone() ? '先确认时区。' : '';
    for (const button of [tossHere, tossOwn, ...coins]) button.disabled = done || Boolean(blocked);
    question.readOnly = lines.length > 0;
    hint.textContent = blocked || (done ? '' : `还要掷 ${6 - lines.length} 次。`);
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
    outcome.replaceChildren(h('p', { class: 'status' }, '正在起卦，第一次要等算法包加载完…'));
    try {
      const result = await runJson<LiuyaoResult>({ script: 'liuyao_cast.py', argv: ['coins', '--lines', lines.join(','),
        '--date', now.date, '--time', now.time, '--target-timezone', timezone, '--question', question.value.trim()] });
      outcome.replaceChildren(await renderCard(liuyaoCard(result)));
    } catch (error) {
      const message = error instanceof ToolFailed ? error.message : '算法包运行出错，请刷新页面再试。';
      outcome.replaceChildren(h('p', { class: 'status error', role: 'alert' }, message));
    }
  }

  question.addEventListener('input', refresh);
  refresh();

  return h('section', { class: 'hall', 'aria-labelledby': 'hall-title' },
    h('a', { class: 'back', href: '#/' }, '回中庭'),
    h('div', { class: 'hall-head' }, moonGate('qiuqian'), h('h2', { id: 'hall-title', class: 'hall-title' }, '求签殿')),
    h('p', { class: 'lede' }, '想好一件具体的事，掷三枚铜钱六次。每一次是一爻，从下往上排。'),
    h('div', { class: 'step' },
      h('label', { for: 'question' }, '所问之事'),
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
      h('p', { class: 'hint' }, '一背为少阳，两背为少阴，三背为老阳，三字为老阴。用自己的铜钱掷时，点铜钱照落地的样子翻面，再点「照这样记下」。记下的爻不能撤回。'),
      h('div', { class: 'row' }, tossHere, tossOwn),
      hint,
      recorded,
    ),
    outcome,
  );
}
