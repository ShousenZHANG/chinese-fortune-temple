// 追问设置 (spec stories 61, 62, 64): the visitor's own provider and key, kept in this browser and deletable; and why a
// Claude or ChatGPT subscription cannot be used on a web page like this one.
import { h } from './dom';
import { CLAUDE_MODEL } from './followup/ask';
import { deleteProvider, loadProvider, parseProvider, saveProvider, validEndpoint } from './followup/settings';

const SKILL_REPO = 'https://github.com/ShousenZHANG/chinese-fortune';

export function shezhi(): HTMLElement {
  const current = loadProvider();
  const radio = (value: string, label: string) => h('label', { class: 'choice' },
    h('input', { type: 'radio', name: 'provider', value, ...((current?.kind ?? 'anthropic') === value ? { checked: true } : {}) }), label);
  const kinds = h('div', { class: 'row', role: 'radiogroup', 'aria-label': '服务商' },
    radio('anthropic', 'Anthropic'), radio('openai', 'OpenAI 兼容接口'));
  const key = h('input', { id: 'llm-key', type: 'password', autocomplete: 'off', spellcheck: 'false' });
  const baseUrl = h('input', { id: 'llm-base', type: 'text', inputmode: 'url', autocomplete: 'off', placeholder: 'https://…/v1' });
  const model = h('input', { id: 'llm-model', type: 'text', autocomplete: 'off' });
  key.value = current?.key ?? '';
  if (current?.kind === 'openai') {
    baseUrl.value = current.baseUrl;
    model.value = current.model;
  }
  const compatible = h('div', { class: 'step' },
    h('label', { for: 'llm-base' }, '接口地址'), baseUrl, h('label', { for: 'llm-model' }, '模型名'), model);
  const notice = h('div', { class: 'notice' });
  const say = (kind: 'status' | 'alert', text: string) => notice.replaceChildren(h('p', { role: kind, class: kind }, text));
  const kind = () => kinds.querySelector<HTMLInputElement>('input:checked')?.value ?? 'anthropic';
  const sync = () => { compatible.hidden = kind() !== 'openai'; };

  function save() {
    const provider = parseProvider({ kind: kind(), key: key.value, baseUrl: baseUrl.value, model: model.value });
    if (!provider) {
      say('alert', !key.value.trim() ? '请填 API 密钥。'
        : !validEndpoint(baseUrl.value.trim().replace(/\/+$/, '')) ? '接口地址要以 https:// 开头。' : '请填模型名。');
      return;
    }
    try {
      saveProvider(provider);
      say('status', '已存下。追问时直接从这台设备的浏览器发给服务商。');
    } catch {
      say('alert', '没能存进这台设备的浏览器，请检查是否关闭了网站数据存储。');
    }
  }

  function remove() {
    deleteProvider();
    key.value = '';
    baseUrl.value = '';
    model.value = '';
    say('status', '已删除，这台设备上不再保存密钥。');
  }

  kinds.addEventListener('change', sync);
  sync();
  return h('section', { class: 'hall', 'aria-labelledby': 'shezhi-title' },
    h('a', { class: 'back', href: '#/' }, '回中庭'),
    h('h2', { id: 'shezhi-title', class: 'hall-title' }, '追问设置'),
    h('p', { class: 'lede' }, '想对签文卡追问，可以填你自己的模型密钥。默认不接任何模型；不填也能用全部功能。'),
    h('div', { class: 'pilgrim-form' },
      h('fieldset', { class: 'step' }, h('legend', {}, '服务商'), kinds,
        h('p', { class: 'hint' }, `Anthropic 默认用 ${CLAUDE_MODEL}，并开启服务端的拒答回退：被拒时由 Anthropic 自动换一个模型重试。`)),
      h('div', { class: 'step' }, h('label', { for: 'llm-key' }, 'API 密钥'), key,
        h('p', { class: 'hint' }, '密钥只存在这台设备的浏览器里，追问时从浏览器直接发给服务商；本站没有服务器，看不到它。用完可以随时删除。')),
      compatible,
      notice,
      h('div', { class: 'row' },
        h('button', { type: 'button', class: 'primary', onclick: save }, '存在这台设备'),
        h('button', { type: 'button', onclick: remove }, '删除密钥'))),
    h('section', { class: 'yuanqi-part', 'aria-label': '订阅会员' },
      h('h3', { class: 'section-title' }, '用订阅可以吗'),
      h('p', {}, 'Claude Pro、Max 或 ChatGPT Plus 这类订阅，不能在第三方网页里登录使用，这里只能用 API 密钥。'),
      h('p', {}, '想用订阅，可以在 Claude Code 或 Codex 里安装 chinese-fortune Skill，在那里直接问：',
        h('a', { href: SKILL_REPO, rel: 'noopener', target: '_blank' }, SKILL_REPO.replace('https://', '')), '。')),
  );
}
