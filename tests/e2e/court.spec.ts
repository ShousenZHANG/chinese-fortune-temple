import { expect, test, type Page } from '@playwright/test';

// The 2D courtyard is dressed with the GPT Image set processed by scripts/art.py into public/art.
async function brokenImages(page: Page): Promise<string[]> {
  return page.locator('main img').evaluateAll((images) =>
    (images as HTMLImageElement[]).filter((image) => !image.complete || image.naturalWidth === 0).map((image) => image.src));
}

test('the courtyard shows the temple, a guide, and every hall through its moon gate', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('img', { name: /有据山寺全景/ })).toBeVisible();
  await expect(page.getByTestId('guide')).toContainText('求签殿');

  for (const name of ['求签殿', '月老殿', '黄历亭', '问心堂', '紫微殿', '许愿树']) {
    await expect(page.locator('.hall-tile', { hasText: name }).locator('img.moon')).toHaveCount(1);
  }
  await expect(page.getByRole('link', { name: /求签殿/ })).toHaveAttribute('href', '#/qiuqian');
  await expect(page.getByRole('link', { name: /月老殿/ })).toHaveAttribute('href', '#/yuelao');
  await expect(page.getByRole('link', { name: /紫微殿/ })).toHaveAttribute('href', '#/ziwei');
  await expect(page.getByRole('link', { name: /黄历亭/ })).toHaveAttribute('href', '#/huangli');
  await expect(page.getByRole('link', { name: /问心堂/ })).toHaveAttribute('href', '#/wenxin');
  await expect(page.getByRole('link', { name: /许愿树/ })).toHaveAttribute('href', '#/xuyuan');
  await expect(page.locator('.hall-tile.closed')).toHaveCount(0);

  await page.locator('main img').last().scrollIntoViewIfNeeded();
  await expect.poll(() => brokenImages(page)).toEqual([]);
});

test('the hall page carries its own picture and the site has an icon', async ({ page }) => {
  await page.goto('/#/qiuqian');
  await expect(page.locator('.hall img.moon')).toHaveCount(1);
  await expect.poll(() => brokenImages(page)).toEqual([]);

  for (const link of await page.locator('link[rel~="icon"], link[rel="apple-touch-icon"]').all()) {
    const href = await link.getAttribute('href');
    expect((await page.request.get(href ?? '')).ok(), href ?? '').toBe(true);
  }
  await expect(page.locator('link[rel~="icon"]')).not.toHaveCount(0);
});
