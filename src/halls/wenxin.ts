// 问心堂: the visitor writes what is on their mind; question_router decides where it belongs. Real-life questions,
// emergencies, legal papers and thoughts of self-harm go to life-guide, whose prose leads with the first action.
// Fortune questions are sent to the hall that answers them. The emergency numbers are written into the page, so
// they show before Python has loaded. The zone only picks the region's rules and helplines, so an unconfirmed
// guess is used rather than holding the answer back.
import { moonGate } from '../art';
import { renderCard } from '../card/card';
import { lifeCard, type LifeResult } from '../card/life';
import { h } from '../dom';
import { placeName, tr } from '../i18n';
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
  return h('aside', { class: 'safety', role: 'note', 'aria-label': tr('正在出事时', 'In an emergency') },
    h('p', {}, tr('身体正在出状况、有人有危险、或者想伤害自己时，不要等这里的结果：'
      + '中国大陆急救打 120，报警打 110，火警打 119，心理援助热线 12356（未成年人 12355）。',
    'If your body is in trouble, someone is in danger, or you are thinking of harming yourself, do not wait for this page. '
      + 'In mainland China: ambulance 120, police 110, fire 119, mental-health hotline 12356 (12355 for minors). '
      + 'Elsewhere, call your local emergency number.')));
}

export function wenxinHall(): HTMLElement {
  const question = h('textarea', { id: 'wenxin-question', rows: '3', maxlength: String(MAX_QUESTION),
    placeholder: tr('例如：失业了先做什么', 'For example: 失业了先做什么 (write in Chinese for the Skill)') });
  const zone = zoneStep('答', () => undefined);
  const outcome = h('div', { class: 'outcome', 'aria-live': 'polite' });
  const button = h('button', { type: 'button', class: 'primary', onclick: () => void ask() }, '问');

  function sendElsewhere(route: Route): HTMLElement[] {
    const target = ELSEWHERE[route.flow];
    return [h('p', {}, `${tr('这个问题不是问心堂答的：', 'The Hall of Questions does not answer this: ')}${route.why}。`),
      target ? h('a', { href: target.href }, `${tr('去', 'Go to the ')}${placeName(target.hall)}`) : h('p', {}, tr('这个站还没有专门答它的殿。', 'No hall on this site answers it yet.'))];
  }

  async function ask() {
    const text = question.value.trim();
    if (!text) {
      outcome.replaceChildren(h('p', { class: 'status error', role: 'alert' }, tr('先写下心事。', 'Write down what is on your mind first.')));
      return;
    }
    button.disabled = true;
    outcome.replaceChildren(h('p', { class: 'status' }, tr('正在找对应的条目，第一次要等算法包加载完…', 'Looking up the entries. The first time waits for the Skill to load…')));
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
        if (prose.exitCode !== 0) throw new ToolFailed(tr('life_guide.py 没有给出白话说明。', 'life_guide.py gave no plain-language text.'));
        outcome.replaceChildren(await renderCard(lifeCard(prose.stdout, result, text)));
      }
    } catch (error) {
      const message = error instanceof ToolFailed ? error.message : tr('算法包运行出错，请刷新页面再试。', 'The Skill ran into an error. Please refresh the page.');
      outcome.replaceChildren(h('p', { class: 'status error', role: 'alert' }, message));
    } finally {
      button.disabled = false;
    }
  }

  return h('section', { class: 'hall', 'aria-labelledby': 'hall-title' },
    h('a', { class: 'back', href: '#/' }, tr('回中庭', 'Back to the courtyard')),
    h('div', { class: 'hall-head' }, moonGate('wenxin'), h('h2', { id: 'hall-title', class: 'hall-title' }, tr('问心堂', 'Hall of Questions'))),
    safetyNotice(),
    h('p', { class: 'lede' }, tr('写下现实里的烦心事，按《高性价比人生指南》给出先做什么、别做什么，每条注明是书里第几节第几条。这里不算命，也不替你做法律、医疗、投资的裁决。', 'Write down a real-life worry. The answer follows the 高性价比人生指南: what to do first and what to avoid, each with its section and item number. No fortune-telling here, and no legal, medical or investment rulings.')),
    h('div', { class: 'step' },
      h('label', { for: 'wenxin-question' }, tr('心事', 'What is on your mind')),
      question,
      h('div', { class: 'row presets' }, ...PRESETS.map((text) => h('button', { type: 'button', class: 'chip',
        onclick: () => { question.value = text; } }, text)))),
    zone.element,
    h('div', { class: 'step' }, button),
    outcome,
  );
}
