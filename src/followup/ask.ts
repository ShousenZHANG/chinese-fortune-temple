// Sends one follow-up about a 签文卡 to the visitor's chosen provider (spec story 63). The request carries only the
// Skill's SKILL.md rules, the card's tool results and the question; nothing goes through this site.
// Anthropic is called through the official SDK, loaded only when a follow-up is sent; an OpenAI-compatible endpoint
// gets a plain chat/completions request in that API's own shape.
import type { Provider } from './settings';

export class AskFailed extends Error {}

export const CLAUDE_MODEL = 'claude-opus-5-5';

export interface CardContext {
  title: string;
  question: string;
  first: string[];
  /** Sentences the Skill requires in every answer about this card (must_cover and the like). */
  conditions: string[];
  facts: unknown[];
}

let rules: Promise<string> | null = null;

function skillRules(): Promise<string> {
  rules ??= fetch(`${import.meta.env.BASE_URL}skill/SKILL.md`).then((response) => {
    if (!response.ok) throw new AskFailed('Skill 的规则文件没有取到，请刷新再试。');
    return response.text();
  });
  return rules;
}

const TASK = [
  '你在「有据山寺」网页里回答访客对一张签文卡的追问。',
  '只能依据用户消息里给出的工具结果回答；不要自己另算干支、卦象、等级或盘面。',
  '不要引用工具结果里没有的古籍原文；引原文时逐字照抄，并写出段号。',
  '不做健康、寿命、投资、法律、医疗的断语，不打包票，不预测具体结果。',
  '用简体中文回答，三到六句；工具结果回答不了的，直接说回答不了。',
].join('\n');

export async function prompts(card: CardContext, followup: string): Promise<{ system: string; user: string }> {
  return {
    system: `以下是 chinese-fortune Skill 的 SKILL.md 规则：\n\n${await skillRules()}\n\n---\n\n${TASK}`,
    user: [`签文卡：${card.title}`, `所问：${card.question}`, `首段：\n${card.first.join('\n')}`,
      ...(card.conditions.length
        ? [`回答里必须原样写进下面这些句子（Skill 要求每次谈到这张卡都要说到），每句单独一行：\n${card.conditions.join('\n')}`]
        : []),
      `工具结果（JSON）：\n${JSON.stringify(card.facts)}`, `访客的追问：${followup}`].join('\n\n'),
  };
}

async function askClaude(key: string, system: string, user: string): Promise<string> {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true, maxRetries: 1 });
  try {
    const message = await client.beta.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium' },
      system,
      messages: [{ role: 'user', content: user }],
    });
    if (message.stop_reason === 'refusal') throw new AskFailed('模型拒绝回答这个追问。');
    const text = message.content.flatMap((block) => (block.type === 'text' ? [block.text] : [])).join('\n').trim();
    if (!text) throw new AskFailed('模型没有给出文字回答。');
    return text;
  } catch (error) {
    if (error instanceof AskFailed) throw error;
    if (error instanceof Anthropic.AuthenticationError) throw new AskFailed('密钥无效或已失效，请到设置里检查。');
    if (error instanceof Anthropic.PermissionDeniedError) throw new AskFailed('这把密钥没有调用这个模型的权限。');
    if (error instanceof Anthropic.RateLimitError) throw new AskFailed('请求太频繁或额度已用完，稍后再试。');
    if (error instanceof Anthropic.APIConnectionError) throw new AskFailed('连不上 Anthropic，请检查网络。');
    if (error instanceof Anthropic.APIError) throw new AskFailed(`Anthropic 返回错误 ${error.status ?? ''}：${error.message}`);
    throw error;
  }
}

async function askCompatible(provider: Extract<Provider, { kind: 'openai' }>, system: string, user: string): Promise<string> {
  let response: Response;
  try {
    response = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${provider.key}` },
      body: JSON.stringify({ model: provider.model, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
    });
  } catch {
    throw new AskFailed(`连不上 ${new URL(provider.baseUrl).host}，请检查地址和网络（对方也要允许网页直接访问）。`);
  }
  if (!response.ok) throw new AskFailed(`接口返回错误 ${response.status}，请检查地址、模型名和密钥。`);
  const data = (await response.json().catch(() => null)) as { choices?: { message?: { content?: unknown } }[] } | null;
  const text = data?.choices?.[0]?.message?.content;
  if (typeof text !== 'string' || !text.trim()) throw new AskFailed('接口没有给出文字回答。');
  return text.trim();
}

export async function ask(provider: Provider, card: CardContext, followup: string): Promise<string> {
  const { system, user } = await prompts(card, followup);
  return provider.kind === 'anthropic' ? askClaude(provider.key, system, user) : askCompatible(provider, system, user);
}
