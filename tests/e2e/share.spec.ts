import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';

// Share images (spec stories 43, 54, 57): drawn on this device; birth dates, hours and pillars never go in; a wish's
// own words only when the visitor ticks the box. The preview's alt text lists exactly what was drawn.
test.use({ timezoneId: 'Asia/Shanghai' });

async function castInterview(page: Page) {
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
}

test('a 签文卡 share image is drawn here, and the question can be left off', async ({ page }) => {
  test.setTimeout(180_000);
  await castInterview(page);
  const card = page.getByRole('article', { name: '签文卡' });
  await expect(card).toBeVisible({ timeout: 150_000 });
  await card.getByRole('button', { name: '生成分享图' }).click();

  const preview = page.getByTestId('share-preview');
  await expect(preview).toHaveAttribute('alt', /风山渐 之 山风蛊.*所问：这次面试能不能过/);
  await expect.poll(() => preview.evaluate((img: HTMLImageElement) => [img.naturalWidth, img.naturalHeight])).toEqual([1024, 1536]);
  await page.getByLabel('分享图上写出所问之事').uncheck();
  await expect(preview).not.toHaveAttribute('alt', /所问/);

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '保存图片' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('有据山寺-签文.png');
  const bytes = await readFile(await file.path());
  expect(bytes.subarray(1, 4).toString('ascii')).toBe('PNG');
});

test('a 合婚 share image carries the names but no pillar or birth year', async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto('/#/xiangke');
  await page.getByLabel('从文件导入').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({
    format: 'youju-shansi-backup', version: 2, exportedAt: '2026-11-20T00:00:00.000Z', wishes: [], pilgrims: [
      { id: 'a', name: '阿甲', gender: 'male', date: { calendar: 'solar', year: 1990, month: 6, day: 12 }, time: { known: false },
        city: '北京', addedAt: '2026-11-20T00:00:00.000Z' },
      { id: 'b', name: '阿乙', gender: 'female', date: { calendar: 'solar', year: 1992, month: 9, day: 18 }, time: { known: false },
        city: '北京', addedAt: '2026-11-20T00:00:01.000Z' }] })) });
  await page.goto('/#/yuelao');
  await page.getByRole('button', { name: '系红绳' }).click();
  const card = page.getByRole('article', { name: '签文卡' });
  await expect(card).toBeVisible({ timeout: 150_000 });
  await expect(card).toContainText('庚午');
  await card.getByRole('button', { name: '生成分享图' }).click();
  const preview = page.getByTestId('share-preview');
  await expect(preview).toHaveAttribute('alt', /阿甲与阿乙/);
  await expect(preview).not.toHaveAttribute('alt', /庚午|壬申|1990|1992|年柱/);
});

test('a 还愿 share image shows the category, dates and 已还愿, and the wish only when asked', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-20T02:00:00Z'));
  await page.goto('/#/xuyuan');
  await page.getByRole('radio', { name: '学业', exact: true }).check();
  await page.getByLabel('心愿').fill('明年顺利考上研究生');
  await page.getByRole('button', { name: '一个月后' }).click();
  await page.getByRole('button', { name: '挂上许愿牌' }).click();
  const wish = page.getByTestId('wish');
  await wish.getByRole('button', { name: '还愿' }).click();
  await wish.getByRole('button', { name: '挂一条红绸' }).click();
  await page.getByText('生成还愿分享图').click();

  const preview = page.getByTestId('share-preview');
  await expect(preview).toHaveAttribute('alt', /学业之愿，已还愿.*许于 2026-11-20，还于 2026-11-20.*这是仪式，不是推算/);
  await expect(preview).not.toHaveAttribute('alt', /研究生/);
  await page.getByLabel('分享图上写出心愿原文').check();
  await expect(preview).toHaveAttribute('alt', /心愿：明年顺利考上研究生/);
});
