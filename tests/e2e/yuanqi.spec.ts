import { expect, test } from '@playwright/test';

// 缘起 (spec story 67): where everything comes from and under which licence. The book list and the life-guide
// source are read from the Skill itself, so they cannot drift from the package the site runs.
test('缘起 lists the Skill, every bundled book with its licence, the life guide, the runtimes and the art', async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto('/');
  await page.getByRole('region', { name: '中庭', exact: true }).getByRole('link', { name: '缘起' }).click();
  await expect(page.getByRole('heading', { name: '缘起', level: 2 })).toBeVisible();

  await expect(page.getByTestId('skill-source')).toContainText('chinese-fortune v6.3.1');
  await expect(page.getByTestId('skill-source')).toContainText('bf3b759');
  const books = page.getByRole('table', { name: '随包古籍' });
  await expect(books.locator('tbody tr')).toHaveCount(15, { timeout: 150_000 });
  await expect(books).toContainText('协纪辨方书');
  await expect(books).toContainText('CC BY-SA 4.0');
  await expect(page.getByTestId('life-source')).toContainText('《高性价比人生指南》');
  await expect(page.getByTestId('life-source')).toContainText('CC BY 4.0');
  // The page names the analytics beacon and says what it sends and what it never carries.
  await expect(page.getByTestId('analytics-note')).toContainText('Cloudflare Web Analytics');
  await expect(page.getByTestId('analytics-note')).toContainText('不用 cookie');
  await expect(page.getByTestId('analytics-note')).toContainText('出生资料、心愿、所问之事和签文都不在其中');
  for (const text of ['Pyodide', 'MPL-2.0', 'lunar-python', 'tzdata', 'GPT Image', '合成']) {
    await expect(page.locator('main')).toContainText(text);
  }
});

test('缘起 opened directly waits for the Skill instead of failing before it has loaded', async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto('/#/yuanqi');
  await expect(page.getByRole('table', { name: '随包古籍' }).locator('tbody tr')).toHaveCount(15, { timeout: 150_000 });
  await expect(page.getByTestId('life-source')).toContainText('CC BY 4.0');
});
