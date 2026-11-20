import { expect, test } from '@playwright/test';

// The 2.5D court (spec stories 3, 4, 6): every hall is a link pinned on the painting; tapping one sends the guide
// walking there before the hall opens. With reduced motion the hall opens at once.

test('every hall is pinned on the painting, and tapping one walks the guide there first', async ({ page }) => {
  await page.goto('/');
  const scene = page.getByRole('region', { name: '中庭全景' });
  for (const name of ['求签殿', '月老殿', '问心堂', '紫微殿', '黄历亭', '许愿树', '香客簿']) {
    await expect(scene.getByRole('link', { name })).toBeVisible();
  }
  await scene.getByRole('link', { name: '求签殿' }).click();
  await expect(scene.getByTestId('walker')).toBeVisible();
  await expect(page).toHaveURL(/#\/qiuqian$/);
  await expect(page.getByRole('heading', { name: '求签殿' })).toBeVisible();
});

test('with reduced motion the hall opens without the walk', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('region', { name: '中庭全景' }).getByRole('link', { name: '许愿树' }).click();
  await expect(page).toHaveURL(/#\/xuyuan$/);
  await expect(page.getByRole('heading', { name: '许愿树' })).toBeVisible();
});
