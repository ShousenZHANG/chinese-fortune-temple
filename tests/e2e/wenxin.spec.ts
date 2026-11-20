import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';

// 问心堂 (spec stories 34–36): question_router first; real-life questions and emergencies go to life-guide, whose
// --markdown prose is the first layer (parity cases life-*-md); fortune questions are sent to the hall that answers
// them. The emergency numbers are on the page before Python has loaded.
test.use({ timezoneId: 'Asia/Shanghai' });

async function lead(id: string): Promise<string[]> {
  const stdout: string = JSON.parse(await readFile('tests/parity/reference.json', 'utf8')).results[id].stdout;
  return stdout.split('\n').filter((line) => line.trim() && !line.startsWith('写回答时：') && !line.startsWith('出处：'));
}

async function ask(page: Page, question: string) {
  await page.goto('/#/wenxin');
  await page.getByLabel('心事').fill(question);
  await page.getByRole('button', { name: '问', exact: true }).click();
}

test('the emergency numbers are on the page before anything is asked', async ({ page }) => {
  await page.goto('/#/wenxin');
  const notice = page.getByRole('note', { name: '正在出事时' });
  await expect(notice).toContainText('120');
  await expect(notice).toContainText('12356');
});

test('an emergency gets the first action first, in life-guide\'s own words', async ({ page }) => {
  test.setTimeout(180_000);
  await ask(page, '我胸口很痛喘不上气');
  const card = page.getByRole('article', { name: '签文卡' });
  await expect(card).toBeVisible({ timeout: 150_000 });
  const expected = await lead('life-emergency-md');
  await expect(card.getByTestId('first-answer').locator('p')).toHaveText(expected);
  await expect(card.getByTestId('first-answer').locator('p').first()).toContainText('先打 120');
});

test('a real-life question gets the book\'s entries, with its source and licence', async ({ page }) => {
  test.setTimeout(180_000);
  await ask(page, '失业了先做什么');
  const card = page.getByRole('article', { name: '签文卡' });
  await expect(card).toBeVisible({ timeout: 150_000 });
  await expect(card.getByTestId('first-answer').locator('p')).toHaveText(await lead('life-decide-md'));
  await card.getByText('看原文').click();
  await expect(card).toContainText('CC BY 4.0');
});

test('a fortune question is sent to the hall that answers it', async ({ page }) => {
  test.setTimeout(180_000);
  await ask(page, '我和他合不合');
  await expect(page.getByRole('link', { name: '去月老殿' })).toBeVisible({ timeout: 150_000 });
});
