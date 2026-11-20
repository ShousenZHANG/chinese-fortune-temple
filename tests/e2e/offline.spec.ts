import { expect, test } from '@playwright/test';

// Spec stories 8 and 9: after one visit the service worker has the whole site, the Python runtime and the Skill
// package, so the temple opens and casts with no network at all.
test.use({ serviceWorkers: 'allow', timezoneId: 'Asia/Shanghai' });

test('after one visit the temple opens and casts with the network off', async ({ page, context }) => {
  test.setTimeout(240_000);
  await page.goto('/');
  await expect(page.getByTestId('offline-ready')).toHaveText('已缓存，断网也能用', { timeout: 120_000 });

  // A second visit: a fresh page in the same browser, with the network gone.
  await context.setOffline(true);
  const again = await context.newPage();
  await again.clock.setFixedTime(new Date('2026-11-18T08:00:00Z'));
  await again.goto('/#/qiuqian');
  await again.getByRole('button', { name: '这次面试能不能过' }).click();
  await again.getByRole('button', { name: '就按这个时区' }).click();
  for (const value of [8, 6, 7, 8, 9, 7]) {
    const coins = again.getByRole('button', { name: /第[一二三]枚铜钱/ });
    for (let i = 0; i < 3; i += 1) {
      const wanted = i < value - 6 ? 'true' : 'false';
      if ((await coins.nth(i).getAttribute('aria-pressed')) !== wanted) await coins.nth(i).click();
    }
    await again.getByRole('button', { name: '照这样记下' }).click();
  }
  await expect(again.getByRole('article', { name: '签文卡' })).toContainText('风山渐', { timeout: 150_000 });
});
