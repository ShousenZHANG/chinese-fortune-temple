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

test('in English the Pilgrim Book form, the Coin Hall and the Wish Tree work, and readings stay in Chinese', async ({ page }) => {
  test.setTimeout(180_000);
  await page.clock.setFixedTime(new Date('2026-11-18T08:00:00Z'));
  await page.goto('/#/xiangke');
  await page.getByLabel('Name', { exact: true }).fill('Ajia');
  await page.getByRole('radio', { name: 'Male', exact: true }).check();
  await page.getByLabel('Year', { exact: true }).fill('1990');
  await page.getByLabel('Month', { exact: true }).fill('6');
  await page.getByLabel('Day', { exact: true }).fill('12');
  await page.getByLabel('Hour unknown').check();
  await page.getByLabel('Birthplace').fill('北京');
  await expect(page.getByTestId('city-facts')).toHaveText('北京: 116.4°E, time zone Asia/Shanghai');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByTestId('pilgrim')).toContainText('Gregorian 1990-06-12, hour unknown, 北京');

  await page.goto('/#/qiuqian');
  await page.getByRole('button', { name: '这次面试能不能过' }).click();
  await page.getByRole('button', { name: 'Use this time zone' }).click();
  for (const value of [8, 6, 7, 8, 9, 7]) {
    const coins = page.getByRole('button', { name: /^Coin [123]$/ });
    for (let i = 0; i < 3; i += 1) {
      const wanted = i < value - 6 ? 'true' : 'false';
      if ((await coins.nth(i).getAttribute('aria-pressed')) !== wanted) await coins.nth(i).click();
    }
    await page.getByRole('button', { name: 'Record as set' }).click();
  }
  const card = page.getByRole('article', { name: 'Reading card' });
  await expect(card).toBeVisible({ timeout: 150_000 });
  await expect(card).toContainText('Below is the Skill’s own Chinese text');
  await expect(card.getByTestId('first-answer')).toContainText('风山渐');
  await expect(card.getByRole('button', { name: 'Follow-up' })).toBeVisible();

  await page.goto('/#/xuyuan');
  await page.getByRole('radio', { name: 'Study', exact: true }).check();
  await page.getByLabel('Your wish').fill('pass the exam');
  await page.getByRole('button', { name: 'In three months' }).click();
  await page.getByRole('button', { name: 'Hang the wish tag' }).click();
  await expect(page.getByTestId('wish-status')).toHaveText('Made');
  await expect(page.getByTestId('wish')).toContainText('Study');
});
