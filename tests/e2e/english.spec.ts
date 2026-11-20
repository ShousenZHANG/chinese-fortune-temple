import { expect, test } from '@playwright/test';

// Spec story 10: an English-speaking visitor gets the interface in English; the choice can be switched and is kept.
test.use({ locale: 'en-US' });

test('an English browser gets the court in English, and the switch to Chinese is remembered', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('.tagline')).toContainText('every reading points to its classical source');
  const scene = page.getByRole('region', { name: 'Courtyard view' });
  await expect(scene.getByRole('link', { name: 'Coin Hall' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Courtyard', exact: true })).toContainText('Toss three coins six times');
  await expect(page.getByRole('button', { name: 'Mute' })).toBeVisible();

  await page.getByRole('button', { name: '中文' }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
  await expect(page.getByRole('region', { name: '中庭全景' }).getByRole('link', { name: '求签殿' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'English' })).toBeVisible();
  await expect(page.locator('.tagline')).toContainText('每一签都能查到古籍出处');
});
