import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

// 每日一签 (spec story 58): one 易林 verse a day per device, quoted with its passage id and the tool's boundary,
// the same slip however often it is drawn that day.
test.use({ timezoneId: 'Asia/Shanghai' });

test('the daily slip quotes a 易林 verse with its source, and the same day draws the same slip', async ({ page }) => {
  test.setTimeout(180_000);
  await page.clock.setFixedTime(new Date('2026-11-20T02:00:00Z'));
  await page.goto('/');
  const daily = page.getByRole('region', { name: '每日一签' });
  await daily.getByRole('button', { name: '抽今日一签' }).click();
  const card = daily.getByRole('article', { name: '签文卡' });
  await expect(card).toBeVisible({ timeout: 150_000 });

  const lead = card.getByTestId('first-answer').locator('p');
  await expect(lead.first()).toHaveText(/^《焦氏易林》\S+之\S+：「[^」]+」（yilin:c\d{3}:p\d{4}）$/);
  const { boundary } = JSON.parse(JSON.parse(await readFile('tests/parity/reference.json', 'utf8')).results['daily-lin'].stdout);
  await expect(lead.nth(1)).toHaveText(boundary);
  await expect(card.getByRole('heading')).toHaveText(/之/);
  const title = await card.getByRole('heading').textContent();

  await page.reload();
  await daily.getByRole('button', { name: '抽今日一签' }).click();
  await expect(daily.getByRole('article', { name: '签文卡' }).getByRole('heading')).toHaveText(title ?? '', { timeout: 150_000 });
});
