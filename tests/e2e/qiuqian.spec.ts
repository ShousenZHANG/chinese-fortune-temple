import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

// 求签殿 (issue #1, step 3): six coin tosses become one liuyao reading, shown as a 签文卡.
// The expected first layer is the Skill CLI's own first_answer for the same tosses and moment
// (parity case liuyao-interview: 8,6,7,8,9,7 at 2026-11-18 16:00 Asia/Shanghai).
const { results } = JSON.parse(readFileSync('tests/parity/reference.json', 'utf8'));
const reference = JSON.parse(results['liuyao-interview'].stdout);
const LINES = [8, 6, 7, 8, 9, 7];   // bottom to top; the Skill counts 6 + number of 背 faces

test.use({ timezoneId: 'Asia/Shanghai' });

test('six tosses of my own coins give the same reading as the Skill CLI', async ({ page }) => {
  test.setTimeout(180_000);
  await page.clock.setFixedTime(new Date('2026-11-18T08:00:00Z'));
  await page.goto('/');
  await page.getByRole('link', { name: /求签殿/ }).click();

  await page.getByRole('button', { name: '这次面试能不能过' }).click();
  await expect(page.getByTestId('cast-moment')).toContainText('2026-11-18 16:00');
  await page.getByRole('button', { name: '就按这个时区' }).click();

  for (const value of LINES) {
    const backs = value - 6;
    const coins = page.getByRole('button', { name: /第[一二三]枚铜钱/ });
    for (let i = 0; i < 3; i += 1) {
      const coin = coins.nth(i);
      const wanted = i < backs ? 'true' : 'false';
      if ((await coin.getAttribute('aria-pressed')) !== wanted) await coin.click();
    }
    await page.getByRole('button', { name: '照这样记下' }).click();
  }

  const card = page.getByRole('article', { name: '签文卡' });
  await expect(card).toBeVisible({ timeout: 150_000 });
  await expect(card.getByRole('heading')).toContainText('风山渐');
  await expect(card.getByRole('heading')).toContainText('山风蛊');
  const first = card.getByTestId('first-answer').locator('p');
  await expect(first).toHaveText(reference.first_answer.map((part: { text: string }) => part.text));
  await expect(card.getByTestId('skill-mark')).toHaveText('chinese-fortune v6.3.0');

  await card.getByText('看盘面').click();
  await expect(card.getByRole('table')).toContainText('官鬼');

  await card.getByText('看原文').click();
  await card.getByRole('button', { name: 'zengshan:c008:p0001' }).click();
  await expect(card.getByTestId('passage-zengshan:c008:p0001')).toContainText('占功名');
});

test('a toss here is recorded at once and cannot be thrown again', async ({ page }) => {
  await page.goto('/#/qiuqian');
  await page.getByRole('textbox', { name: '所问之事' }).fill('押金能不能退回来');
  await page.getByRole('button', { name: '就按这个时区' }).click();
  await page.getByRole('button', { name: '掷一次' }).click();
  await expect(page.getByTestId('recorded-line')).toHaveCount(1);
  await expect(page.getByRole('button', { name: /撤销|重掷/ })).toHaveCount(0);
});
