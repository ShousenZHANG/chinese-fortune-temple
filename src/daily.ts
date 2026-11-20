// 每日一签 on the court. The seed is this device's own random number and today's date, so one device draws one
// slip a day and cannot draw again; changing the 法名 does not change it.
import { renderCard } from './card/card';
import { dailyCard, shortName, type CastResult, type LinResult } from './card/daily';
import { h } from './dom';
import { confirmedTimezone, guessedTimezone, localMoment } from './moment';
import { runJson, ToolFailed } from './skill/session';

const SEED_KEY = 'temple.device-seed';

function deviceSeed(): string {
  try {
    const kept = localStorage.getItem(SEED_KEY);
    if (kept) return kept;
    const fresh = String(crypto.getRandomValues(new Uint32Array(1))[0]);
    localStorage.setItem(SEED_KEY, fresh);
    return fresh;
  } catch {
    return 'no-storage';
  }
}

/** FNV-1a, 32-bit: a stable small integer for yijing_cast --seed. */
function fnv(text: string): number {
  let hash = 0x811c9dc5;
  for (const byte of new TextEncoder().encode(text)) hash = Math.imul(hash ^ byte, 0x01000193) >>> 0;
  return hash;
}

export function dailySlip(): HTMLElement {
  const outcome = h('div', { class: 'outcome', 'aria-live': 'polite' });
  const button = h('button', { type: 'button', class: 'primary', onclick: () => void draw() }, '抽今日一签');

  async function draw() {
    const date = localMoment(confirmedTimezone() ?? guessedTimezone()).date;
    button.disabled = true;
    outcome.replaceChildren(h('p', { class: 'status' }, '正在起卦，第一次要等算法包加载完…'));
    try {
      const cast = await runJson<CastResult>({ script: 'yijing_cast.py',
        argv: ['coins', '--seed', String(fnv(`${deviceSeed()}|${date}`)), '--question', '每日一签'] });
      const lin = await runJson<LinResult>({ script: 'yilin_lookup.py',
        argv: ['--from', shortName(cast.main_hex.name), '--to', shortName((cast.changed_hex ?? cast.main_hex).name)] });
      outcome.replaceChildren(await renderCard(dailyCard(cast, lin, date)));
      button.textContent = '再看一眼今日一签';
    } catch (error) {
      const message = error instanceof ToolFailed ? error.message : '算法包运行出错，请刷新页面再试。';
      outcome.replaceChildren(h('p', { class: 'status error', role: 'alert' }, message));
    } finally {
      button.disabled = false;
    }
  }

  return h('section', { class: 'daily', 'aria-label': '每日一签' },
    h('h3', { class: 'section-title' }, '每日一签'),
    h('p', { class: 'hint' }, '每天一支，抽到的是《焦氏易林》里的一首林辞，附原文段号。同一天再抽还是这一支。'),
    h('div', {}, button), outcome);
}
