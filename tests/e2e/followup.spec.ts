import { readFileSync } from 'node:fs';
import { expect, test, type Page, type Route } from '@playwright/test';

// Own-key follow-up (spec stories 61–64). No real provider is called: every request is answered here. The key is a
// fake test value. What leaves the browser must be the card's tool results, the Skill's rules and the question,
// and the answer is shown only after answer_check passes.
test.use({ timezoneId: 'Asia/Shanghai' });

const TEST_KEY = 'sk-ant-test-not-a-real-key';

// A well-behaved answer: one sentence about the cast, then every sentence the Skill requires for this card
// (reading_plan.say and must_cover of the parity case liuyao-interview, the card cast below).
const cast = JSON.parse(JSON.parse(readFileSync('tests/parity/reference.json', 'utf8')).results['liuyao-interview'].stdout);
const REQUIRED: string[] = [...cast.reading_plan.say, ...cast.must_cover.map((item: { what: string }) => item.what)];
const LEAD = cast.first_answer[0].text as string;
const GOOD_ANSWER = [LEAD, ...REQUIRED].join('\n');

function claudeReply(text: string, stopReason = 'end_turn') {
  return async (route: Route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
    id: 'msg_test', type: 'message', role: 'assistant', model: 'claude-opus-5-5',
    content: stopReason === 'refusal' ? [] : [{ type: 'text', text }], stop_reason: stopReason, stop_sequence: null,
    usage: { input_tokens: 10, output_tokens: 10 } }) });
}

async function saveAnthropicKey(page: Page) {
  await page.goto('/#/shezhi');
  await page.getByRole('radio', { name: 'Anthropic' }).check();
  await page.getByLabel('API 密钥').fill(TEST_KEY);
  await page.getByRole('button', { name: '存在这台设备' }).click();
  await expect(page.getByRole('status')).toContainText('已存下');
}

async function castCard(page: Page) {
  await page.clock.setFixedTime(new Date('2026-11-18T08:00:00Z'));
  await page.goto('/#/qiuqian');
  await page.getByRole('button', { name: '这次面试能不能过' }).click();
  await page.getByRole('button', { name: '就按这个时区' }).click();
  for (const value of [8, 6, 7, 8, 9, 7]) {
    const coins = page.getByRole('button', { name: /第[一二三]枚铜钱/ });
    for (let i = 0; i < 3; i += 1) {
      const wanted = i < value - 6 ? 'true' : 'false';
      if ((await coins.nth(i).getAttribute('aria-pressed')) !== wanted) await coins.nth(i).click();
    }
    await page.getByRole('button', { name: '照这样记下' }).click();
  }
  const card = page.getByRole('article', { name: '签文卡' });
  await expect(card).toBeVisible({ timeout: 150_000 });
  return card;
}

test('a follow-up goes to Claude with only the card, the rules and the question, and a checked answer is shown', async ({ page }) => {
  test.setTimeout(180_000);
  let sent: { headers: Record<string, string>; body: Record<string, unknown> } | null = null;
  await page.route('https://api.anthropic.com/**', async (route) => {
    if (route.request().method() === 'POST') {
      sent = { headers: await route.request().allHeaders(), body: route.request().postDataJSON() };
    }
    await claudeReply(GOOD_ANSWER)(route);
  });
  await saveAnthropicKey(page);
  const card = await castCard(page);
  await card.getByRole('button', { name: '追问' }).click();
  await expect(card).toContainText('直接发给你选的服务商');
  await card.getByLabel('追问的内容').fill('这一卦里官鬼是哪一爻？');
  await card.getByRole('button', { name: '发送追问' }).click();

  await expect(card.getByTestId('followup-answer').first()).toHaveText(LEAD, { timeout: 30_000 });
  expect(sent).not.toBeNull();
  const request = sent as unknown as { headers: Record<string, string>; body: Record<string, unknown> };
  // SDK 1.x sends the key as a bearer token; older releases used x-api-key. Either way it is the visitor's key.
  expect(request.headers['x-api-key'] ?? request.headers.authorization).toContain(TEST_KEY);
  expect(request.headers['anthropic-version']).toBeTruthy();
  expect(request.headers['anthropic-dangerous-direct-browser-access']).toBe('true');
  expect(request.body.model).toBe('claude-opus-5-5');
  const payload = JSON.stringify(request.body);
  expect(payload).toContain('这一卦里官鬼是哪一爻？');
  expect(payload).toContain('风山渐');
  expect(payload).toContain('SKILL');
  expect(payload).toContain(JSON.stringify(REQUIRED[0]).slice(1, -1));
});

test('an answer that fails answer_check is not shown, and the reason is', async ({ page }) => {
  test.setTimeout(180_000);
  await page.route('https://api.anthropic.com/**', claudeReply('《子平真诠》原文「官星得禄，富贵双全，必主大吉」。'));
  await saveAnthropicKey(page);
  const card = await castCard(page);
  await card.getByRole('button', { name: '追问' }).click();
  await card.getByLabel('追问的内容').fill('能不能过？');
  await card.getByRole('button', { name: '发送追问' }).click();
  const withheld = card.getByRole('alert');
  await expect(withheld).toContainText('没有通过自检', { timeout: 30_000 });
  await expect(withheld).toContainText('官星得禄');
  await expect(card.getByTestId('followup-answer')).toHaveCount(0);
});

test('a refusal is reported instead of an empty answer', async ({ page }) => {
  test.setTimeout(180_000);
  await page.route('https://api.anthropic.com/**', claudeReply('', 'refusal'));
  await saveAnthropicKey(page);
  const card = await castCard(page);
  await card.getByRole('button', { name: '追问' }).click();
  await card.getByLabel('追问的内容').fill('能不能过？');
  await card.getByRole('button', { name: '发送追问' }).click();
  await expect(card.getByRole('alert')).toContainText('模型拒绝回答', { timeout: 30_000 });
});

test('an OpenAI-compatible endpoint works the same way', async ({ page }) => {
  test.setTimeout(180_000);
  let auth = '';
  await page.route('https://llm.example.test/v1/chat/completions', async (route) => {
    auth = route.request().headers().authorization ?? '';
    await route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ choices: [{ message: { role: 'assistant', content: GOOD_ANSWER } }] }) });
  });
  await page.goto('/#/shezhi');
  await page.getByRole('radio', { name: 'OpenAI 兼容接口' }).check();
  await page.getByLabel('接口地址').fill('https://llm.example.test/v1');
  await page.getByLabel('模型名').fill('test-model');
  await page.getByLabel('API 密钥').fill('test-key-123');
  await page.getByRole('button', { name: '存在这台设备' }).click();
  const card = await castCard(page);
  await card.getByRole('button', { name: '追问' }).click();
  await card.getByLabel('追问的内容').fill('官鬼在哪一爻？');
  await card.getByRole('button', { name: '发送追问' }).click();
  await expect(card.getByTestId('followup-answer').first()).toHaveText(LEAD, { timeout: 30_000 });
  expect(auth).toBe('Bearer test-key-123');
});

test('the key can be deleted, and the page explains why a subscription cannot be used here', async ({ page }) => {
  await saveAnthropicKey(page);
  await page.getByRole('button', { name: '删除密钥' }).click();
  await expect(page.getByRole('status')).toContainText('已删除');
  await page.reload();
  await expect(page.getByLabel('API 密钥')).toHaveValue('');
  await expect(page.locator('main')).toContainText('订阅');
  await expect(page.locator('main')).toContainText('Claude Code');
});
