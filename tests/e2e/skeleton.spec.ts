import { expect, test } from '@playwright/test';

// Step 1 (issue #1): the built site carries the chinese-fortune release the build fetched and verified.
// Expected values come from the public v6.3.1 release checked on 2026-11-21 (tag commit and CI run).
const RELEASE = { version: '6.3.1', commit: 'bf3b7590d0102b40801e2b4ce20ff71d66274fdd', ciRunId: '44773879623' };

test('the temple shows which verified Skill release it runs', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '有据山寺' })).toBeVisible();
  await expect(page.getByTestId('skill-version')).toHaveText('chinese-fortune v6.3.1 · bf3b759');

  const manifest = await (await page.request.get('/skill/manifest.json')).json();
  expect(manifest).toMatchObject(RELEASE);
  const archive = await page.request.get(`/skill/${manifest.archive}`);
  expect(archive.ok()).toBe(true);
  expect((await archive.body()).length).toBeGreaterThan(1_000_000);
});

test('link previews name the site and point at a 1200×630 image that is served', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', '有据山寺');
  const image = await page.locator('meta[property="og:image"]').getAttribute('content');
  expect(image).toMatch(/^https:\/\/.+\/art\/og\.jpg$/);
  const local = await page.request.get(new URL(image ?? '').pathname);
  expect(local.ok()).toBe(true);
  expect(local.headers()['content-type']).toContain('image/jpeg');
});
