// 设置: the courtyard's 3D／2.5D switch (v2 spec 场景模式); and 追问 (spec stories 61, 62, 64): the visitor's own
// provider and key, kept in this browser and deletable, and why a Claude or ChatGPT subscription cannot be used on a
// web page like this one.
import { h } from './dom';
import { tr } from './i18n';
import { CLAUDE_MODEL } from './followup/ask';
import { deleteProvider, loadProvider, parseProvider, saveProvider, validEndpoint } from './followup/settings';
import { asSceneMode, canDraw3d, offersSwitch, pickedScene, pickScene, sceneChoice, urlAsks3d, type SceneMode } from './scene-mode';

const SKILL_REPO = 'https://github.com/ShousenZHANG/chinese-fortune';

// Until 3D is finished the switch is offered only to a visit that opened 3D by address or has picked before.
function sceneSwitch(): HTMLElement | null {
  if (!offersSwitch()) return null;
  const part = (...children: (HTMLElement | null)[]) => h('section', { class: 'yuanqi-part', 'aria-labelledby': 'scene-title' },
    h('h3', { id: 'scene-title', class: 'section-title' }, tr('中庭画面', 'Courtyard scene')), ...children);
  if (!canDraw3d()) {
    return part(h('p', {}, tr('这个浏览器画不了 3D，中庭用 2.5D 插画。', 'This browser cannot draw 3D, so the courtyard is the 2.5D painting.')));
  }
  const current = pickedScene() ?? sceneChoice().mode;
  const radio = (value: SceneMode, label: string) => h('label', { class: 'choice' },
    h('input', { type: 'radio', name: 'scene', value, ...(current === value ? { checked: true } : {}) }), label);
  const group = h('div', { class: 'row', role: 'radiogroup', 'aria-label': tr('中庭画面', 'Courtyard scene') },
    radio('3d', '3D'), radio('2.5d', '2.5D'));
  group.addEventListener('change', (event) => {
    const mode = asSceneMode((event.target as HTMLInputElement).value);
    if (mode) pickScene(mode);
  });
  return part(group,
    h('p', { class: 'hint' }, tr('2.5D 是插画版的中庭。选了就记在这台设备上，回到中庭就换。',
      'The 2.5D courtyard is the painting. Your pick is kept on this device and applies when you go back to the courtyard.')),
    urlAsks3d() ? h('p', { class: 'hint' }, tr('这次的网址带着 ?scene=3d，去掉以前中庭都是 3D。',
      'This address carries ?scene=3d, so the courtyard stays 3D until that is removed.')) : null);
}

export function shezhi(): HTMLElement {
  const current = loadProvider();
  const radio = (value: string, label: string) => h('label', { class: 'choice' },
    h('input', { type: 'radio', name: 'provider', value, ...((current?.kind ?? 'anthropic') === value ? { checked: true } : {}) }), label);
  const kinds = h('div', { class: 'row', role: 'radiogroup', 'aria-label': tr('服务商', 'Provider') },
    radio('anthropic', 'Anthropic'), radio('openai', tr('OpenAI 兼容接口', 'OpenAI-compatible endpoint')));
  const key = h('input', { id: 'llm-key', type: 'password', autocomplete: 'off', spellcheck: 'false' });
  const baseUrl = h('input', { id: 'llm-base', type: 'text', inputmode: 'url', autocomplete: 'off', placeholder: 'https://…/v1' });
  const model = h('input', { id: 'llm-model', type: 'text', autocomplete: 'off' });
  key.value = current?.key ?? '';
  if (current?.kind === 'openai') {
    baseUrl.value = current.baseUrl;
    model.value = current.model;
  }
  const compatible = h('div', { class: 'step' },
    h('label', { for: 'llm-base' }, tr('接口地址', 'Endpoint URL')), baseUrl, h('label', { for: 'llm-model' }, tr('模型名', 'Model name')), model);
  const notice = h('div', { class: 'notice' });
  const say = (kind: 'status' | 'alert', text: string) => notice.replaceChildren(h('p', { role: kind, class: kind }, text));
  const kind = () => kinds.querySelector<HTMLInputElement>('input:checked')?.value ?? 'anthropic';
  const sync = () => { compatible.hidden = kind() !== 'openai'; };

  function save() {
    const provider = parseProvider({ kind: kind(), key: key.value, baseUrl: baseUrl.value, model: model.value });
    if (!provider) {
      say('alert', !key.value.trim() ? tr('请填 API 密钥。', 'Enter an API key.')
        : !validEndpoint(baseUrl.value.trim().replace(/\/+$/, '')) ? tr('接口地址要以 https:// 开头。', 'The endpoint URL must start with https://.') : tr('请填模型名。', 'Enter a model name.'));
      return;
    }
    try {
      saveProvider(provider);
      say('status', tr('已存下。追问时直接从这台设备的浏览器发给服务商。', 'Saved. Follow-ups go straight from this browser to the provider.'));
    } catch {
      say('alert', tr('没能存进这台设备的浏览器，请检查是否关闭了网站数据存储。', 'Could not save in this browser. Check whether site data storage is turned off.'));
    }
  }

  function remove() {
    deleteProvider();
    key.value = '';
    baseUrl.value = '';
    model.value = '';
    say('status', tr('已删除，这台设备上不再保存密钥。', 'Deleted. No key is kept on this device.'));
  }

  kinds.addEventListener('change', sync);
  sync();
  return h('section', { class: 'hall', 'aria-labelledby': 'shezhi-title' },
    h('a', { class: 'back', href: '#/' }, tr('回中庭', 'Back to the courtyard')),
    h('h2', { id: 'shezhi-title', class: 'hall-title' }, tr('设置', 'Settings')),
    sceneSwitch(),
    h('h3', { class: 'section-title' }, tr('追问', 'Follow-up questions')),
    h('p', { class: 'lede' }, tr('想对签文卡追问，可以填你自己的模型密钥。默认不接任何模型；不填也能用全部功能。', 'To ask follow-up questions about a card, add your own model key. No model is connected by default, and everything else works without one.')),
    h('div', { class: 'pilgrim-form' },
      h('fieldset', { class: 'step' }, h('legend', {}, tr('服务商', 'Provider')), kinds,
        h('p', { class: 'hint' }, tr(`Anthropic 默认用 ${CLAUDE_MODEL}，并开启服务端的拒答回退：被拒时由 Anthropic 自动换一个模型重试。`,
          `Anthropic uses ${CLAUDE_MODEL} with server-side refusal fallback on: if it declines, Anthropic retries on another model.`))),
      h('div', { class: 'step' }, h('label', { for: 'llm-key' }, tr('API 密钥', 'API key')), key,
        h('p', { class: 'hint' }, tr('密钥只存在这台设备的浏览器里，追问时从浏览器直接发给服务商；本站没有服务器，看不到它。用完可以随时删除。', 'The key stays in this browser and goes straight to the provider with each follow-up. This site has no server and never sees it. Delete it whenever you like.'))),
      compatible,
      notice,
      h('div', { class: 'row' },
        h('button', { type: 'button', class: 'primary', onclick: save }, tr('存在这台设备', 'Save on this device')),
        h('button', { type: 'button', onclick: remove }, tr('删除密钥', 'Delete key')))),
    h('section', { class: 'yuanqi-part', 'aria-label': tr('订阅会员', 'Subscriptions') },
      h('h3', { class: 'section-title' }, tr('用订阅可以吗', 'Can I use a subscription?')),
      h('p', {}, tr('Claude Pro、Max 或 ChatGPT Plus 这类订阅，不能在第三方网页里登录使用，这里只能用 API 密钥。', 'Subscriptions such as Claude Pro, Max or ChatGPT Plus cannot be signed into from a third-party web page; only an API key works here.')),
      h('p', {}, tr('想用订阅，可以在 Claude Code 或 Codex 里安装 chinese-fortune Skill，在那里直接问：', 'To use a subscription, install the chinese-fortune Skill in Claude Code or Codex and ask there: '),
        h('a', { href: SKILL_REPO, rel: 'noopener', target: '_blank' }, SKILL_REPO.replace('https://', '')), '。')),
  );
}
