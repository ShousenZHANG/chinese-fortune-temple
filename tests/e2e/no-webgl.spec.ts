import { expect, test } from '@playwright/test';

// v2 spec 场景模式, rule 1: a browser without WebGL cannot draw the 3D temple, so it gets the 2.5D painting even
// when the address asks for 3D, and every hall still opens.
test.use({ launchOptions: { args: ['--disable-webgl'] } });

test('a browser without WebGL gets the 2.5D painting even with ?scene=3d', async ({ page }) => {
  await page.goto('/?scene=3d');
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('img', { name: /有据山寺全景/ })).toBeVisible();
  await expect(page.getByRole('img', { name: /三维中庭/ })).toHaveCount(0);
  await page.getByRole('region', { name: '中庭全景' }).getByRole('link', { name: '许愿树' }).click();
  await expect(page.getByRole('heading', { name: '许愿树' })).toBeVisible();
});
