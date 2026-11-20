// The follow-up panel under a 签文卡 (spec story 63). It says what will leave the browser before anything does,
// and shows the model's answer only after the Skill's answer_check passes it against the card's own tool results.
import { checkAnswer, withheld, type CardModel } from '../card/card';
import { h } from '../dom';
import { tr } from '../i18n';
import { ask, AskFailed } from './ask';
import { loadProvider } from './settings';

const MAX_FOLLOWUP = 300;

export function followupPanel(model: CardModel): HTMLElement {
  const provider = loadProvider();
  if (!provider) {
    return h('div', { class: 'followup' },
      h('p', {}, tr('追问要用你自己的模型密钥。还没有填。', 'Follow-up questions use your own model key. None is saved yet.')), h('a', { href: '#/shezhi' }, tr('去追问设置', 'Open follow-up settings')));
  }
  const where = provider.kind === 'anthropic' ? 'Anthropic' : new URL(provider.baseUrl).host;
  const text = h('textarea', { id: 'followup-text', rows: '2', maxlength: String(MAX_FOLLOWUP) });
  const outcome = h('div', { 'aria-live': 'polite' });
  const send = h('button', { type: 'button', class: 'primary' }, tr('发送追问', 'Send'));

  send.addEventListener('click', async () => {
    const question = text.value.trim();
    if (!question) {
      outcome.replaceChildren(h('p', { class: 'status error', role: 'alert' }, tr('先写下要追问什么。', 'Write the follow-up question first.')));
      return;
    }
    send.disabled = true;
    outcome.replaceChildren(h('p', { class: 'status' }, tr(`正在问 ${where}…`, `Asking ${where}…`)));
    try {
      const answer = await ask(provider, model, question);
      const errors = await checkAnswer(answer, model.facts);
      outcome.replaceChildren(errors.length
        ? withheld(tr('模型的回答没有通过自检，所以不显示。自检发现：', 'The model’s answer failed the self-check, so it is not shown. The check found:'), errors)
        : h('div', { class: 'followup-answer' },
          ...answer.split(/\n+/).map((line) => h('p', { 'data-testid': 'followup-answer' }, line)),
          h('p', { class: 'note' }, tr(`以上由 ${where} 的模型根据这张卡的工具结果回答，已通过 Skill 的自检；自检核的是引文和盘面事实，不担保推断。`, `Answered by ${where}’s model from this card’s tool results, and passed the Skill’s self-check. The check covers quotations and chart facts, not the reasoning.`))));
    } catch (error) {
      const message = error instanceof AskFailed ? error.message : tr('追问没有发出去，请稍后再试。', 'The follow-up was not sent. Please try again later.');
      outcome.replaceChildren(h('p', { class: 'status error', role: 'alert' }, message));
    } finally {
      send.disabled = false;
    }
  });

  return h('div', { class: 'followup' },
    h('p', { class: 'hint' }, tr(`追问会把这张卡的工具结果（可能含出生资料）和你的问题，从你的浏览器直接发给你选的服务商（${where}）。`, `A follow-up sends this card’s tool results (which may include birth details) and your question straight from your browser to the provider you chose (${where}). `)
      + tr('本站没有服务器，看不到这些内容。', 'This site has no server and never sees any of it.')),
    h('label', { for: 'followup-text' }, tr('追问的内容', 'Your follow-up')), text, h('div', { class: 'row' }, send), outcome);
}
