import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

// Spec stories 46 and 48: a wish made from a 签文卡 remembers which card it came from, and any wish still made can
// be put in the phone's calendar as an .ics file that names only the category, not the wish itself.
test.use({ timezoneId: 'Asia/Shanghai' });

test('a wish made from a 签文卡 records the card it came from', async ({ page }) => {
  test.setTimeout(180_000);
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

  await card.getByRole('button', { name: '就此事许个愿' }).click();
  await expect(page.getByRole('heading', { name: '许愿树' })).toBeVisible();
  await expect(page.getByTestId('wish-source')).toHaveText('这个愿来自签：风山渐 之 山风蛊（所问：这次面试能不能过）');
  await page.getByRole('radio', { name: '事业', exact: true }).check();
  await page.getByLabel('心愿').fill('面试顺利');
  await page.getByRole('button', { name: '一个月后' }).click();
  await page.getByRole('button', { name: '挂上许愿牌' }).click();
  await expect(page.getByTestId('wish')).toContainText('来自签：风山渐 之 山风蛊（这次面试能不能过）');
});

test('a wish still made downloads as a calendar reminder that keeps the wish itself private', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-20T02:00:00Z'));
  await page.goto('/#/xuyuan');
  await page.getByRole('radio', { name: '学业', exact: true }).check();
  await page.getByLabel('心愿').fill('明年顺利考上研究生');
  await page.getByRole('button', { name: '三个月后' }).click();
  await page.getByRole('button', { name: '挂上许愿牌' }).click();

  const download = page.waitForEvent('download');
  await page.getByTestId('wish').getByRole('button', { name: '放进日历' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('有据山寺-还愿-2027-02-20.ics');
  const ics = await readFile(await file.path(), 'utf8');
  expect(ics).toContain('BEGIN:VCALENDAR\r\n');
  expect(ics).toContain('DTSTART;VALUE=DATE:20270220\r\n');
  expect(ics).toContain('SUMMARY:回有据山寺还愿（学业）\r\n');
  expect(ics).not.toContain('研究生');
});
