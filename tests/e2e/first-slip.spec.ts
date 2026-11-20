import { expect, test } from '@playwright/test';

// Spec story 5: from opening the page to the first slip in under 60 seconds, on a first visit (nothing cached).
// The coins are the hall's own random tosses: every one of the 4096 casts passes answer_check for the preset
// questions (checked on the CLI), so any toss gives a card. Against a local server this bounds the page's own
// work (Python start-up, the Skill, the card's self-check), not a visitor's download time.
test('a first visit gets its first slip within 60 seconds', async ({ page }) => {
  test.setTimeout(90_000);
  const start = Date.now();
  await page.goto('/');
  await page.getByRole('region', { name: '中庭全景' }).getByRole('link', { name: '求签殿' }).click();
  await page.getByRole('button', { name: '这次面试能不能过' }).click();
  await page.getByRole('button', { name: '就按这个时区' }).click();
  for (let i = 0; i < 6; i += 1) await page.getByRole('button', { name: '掷一次' }).click();
  await expect(page.getByRole('article', { name: '签文卡' })).toBeVisible({ timeout: 60_000 });
  const seconds = (Date.now() - start) / 1000;
  test.info().annotations.push({ type: 'first slip', description: `${seconds.toFixed(1)} s` });
  expect(seconds).toBeLessThan(60);
});
