// 问心堂: the visitor writes what is on their mind; question_router decides where it belongs. Real-life questions,
// emergencies, legal papers and thoughts of self-harm go to life-guide, whose prose leads with the first action.
// Fortune questions are sent to the hall that answers them. The emergency numbers are written into the page, so
// they show before Python has loaded. The zone only picks the region's rules and helplines, so an unconfirmed
// guess is used rather than holding the answer back.
import { moonGate } from '../art';
import { renderCard } from '../card/card';
import { lifeCard, type LifeResult } from '../card/life';
import { h } from '../dom';
import { guessedTimezone } from '../moment';
import { runJson, runTool, ToolFailed } from '../skill/session';
import { zoneStep } from '../zone';

const PRESETS = ['失业了先做什么', '房东不退押金怎么办', '朋友让我替他担保贷款'];
const MAX_QUESTION = 200;
// question_router flows answered elsewhere on this site.
const ELSEWHERE: Record<string, { hall: string; href: string }> = {
  compatibility: { hall: '月老殿', href: '#/yuelao' },
  personal_days: { hall: '黄历亭', href: '#/huangli' },
  event_slots: { hall: '黄历亭', href: '#/huangli' },
  almanac: { hall: '黄历亭', href: '#/huangli' },
  natal: { hall: '紫微殿', href: '#/ziwei' },
  other: { hall: '求签殿', href: '#/qiuqian' },
  method: { hall: '求签殿', href: '#/qiuqian' },
};

interface Route {
  flow: string;
  why: string;
  stop?: string;
}

function safetyNotice(): HTMLElement {
  return h('aside', { class: 'safety', role: 'note', 'aria-label': '正在出事时' },
    h('p', {}, '身体正在出状况、有人有危险、或者想伤害自己时，不要等这里的结果：'
      + '中国大陆急救打 120，报警打 110，火警打 119，心理援助热线 12356（未成年人 12355）。'));
}

export function wenxinHall(): HTMLElement {
  const question = h('textarea', { id: 'wenxin-question', rows: '3', maxlength: String(MAX_QUESTION),
    placeholder: '例如：失业了先做什么' });
  const zone = zoneStep('答', () => undefined);
  const outcome = h('div', { class: 'outcome', 'aria-live': 'polite' });
  const button = h('button', { type: 'button', class: 'primary', onclick: () => void ask() }, '问');

  function sendElsewhere(route: Route): HTMLElement[] {
    const target = ELSEWHERE[route.flow];
    return [h('p', {}, `这个问题不是问心堂答的：${route.why}。`),
      target ? h('a', { href: target.href }, `去${target.hall}`) : h('p', {}, '这个站还没有专门答它的殿。')];
  }

  async function ask() {
    const text = question.value.trim();
    if (!text) {
      outcome.replaceChildren(h('p', { class: 'status error', role: 'alert' }, '先写下心事。'));
      return;
    }
    button.disabled = true;
    outcome.replaceChildren(h('p', { class: 'status' }, '正在找对应的条目，第一次要等算法包加载完…'));
    try {
      const route = await runJson<Route>({ script: 'question_router.py', argv: ['--question', text] });
      if (route.flow === 'boundary') {
        outcome.replaceChildren(h('p', {}, `${route.why}。`));
      } else if (route.flow !== 'life_guide') {
        outcome.replaceChildren(...sendElsewhere(route));
      } else {
        const argv = ['--decide', text, '--current-timezone', zone.zone() ?? guessedTimezone()];
        const result = await runJson<LifeResult>({ skill: 'life-guide', script: 'life_guide.py', argv });
        const prose = await runTool({ skill: 'life-guide', script: 'life_guide.py', argv: [...argv, '--markdown'] });
        if (prose.exitCode !== 0) throw new ToolFailed('life_guide.py 没有给出白话说明。');
        outcome.replaceChildren(await renderCard(lifeCard(prose.stdout, result, text)));
      }
    } catch (error) {
      const message = error instanceof ToolFailed ? error.message : '算法包运行出错，请刷新页面再试。';
      outcome.replaceChildren(h('p', { class: 'status error', role: 'alert' }, message));
    } finally {
      button.disabled = false;
    }
  }

  return h('section', { class: 'hall', 'aria-labelledby': 'hall-title' },
    h('a', { class: 'back', href: '#/' }, '回中庭'),
    h('div', { class: 'hall-head' }, moonGate('wenxin'), h('h2', { id: 'hall-title', class: 'hall-title' }, '问心堂')),
    safetyNotice(),
    h('p', { class: 'lede' }, '写下现实里的烦心事，按《高性价比人生指南》给出先做什么、别做什么，每条注明是书里第几节第几条。这里不算命，也不替你做法律、医疗、投资的裁决。'),
    h('div', { class: 'step' },
      h('label', { for: 'wenxin-question' }, '心事'),
      question,
      h('div', { class: 'row presets' }, ...PRESETS.map((text) => h('button', { type: 'button', class: 'chip',
        onclick: () => { question.value = text; } }, text)))),
    zone.element,
    h('div', { class: 'step' }, button),
    outcome,
  );
}
