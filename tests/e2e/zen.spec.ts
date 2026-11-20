import { expect, test } from '@playwright/test';

// Spec stories 2, 7, 59, 60: a random 法名 at the gate, a 禅台 to knock the wooden fish, tell 108 beads, strike the
// bell and bow, and one switch that mutes every sound. Counts and the name stay in this browser.

test('the gate gives a two-character 法名 that stays, and can be changed', async ({ page }) => {
  await page.goto('/');
  const name = page.getByTestId('dharma-name');
  await expect(name).toHaveText(/^[一-鿿]{2}$/);
  const first = await name.textContent();
  await expect(page.getByTestId('guide')).toContainText(`${first}，`);
  await page.reload();
  await expect(name).toHaveText(first ?? '');
  await page.getByRole('button', { name: '换一个法名' }).click();
  await expect(name).not.toHaveText(first ?? '');
});

test('the 禅台 counts knocks and beads, strikes the bell, and bows', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  const zen = page.getByRole('region', { name: '禅台' });
  for (let i = 0; i < 3; i += 1) await zen.getByRole('button', { name: '敲木鱼' }).click();
  await expect(zen.getByTestId('knocks')).toHaveText('敲了 3 下');
  await zen.getByRole('button', { name: '拨一颗念珠' }).click();
  await expect(zen.getByTestId('beads')).toHaveText('1 / 108');
  await zen.getByRole('button', { name: '撞钟' }).click();
  await zen.getByRole('button', { name: '合掌' }).click();
  await expect(page.getByTestId('guide').locator('img')).toHaveAttribute('src', /monk-bow/);
  await page.reload();
  await expect(zen.getByTestId('knocks')).toHaveText('敲了 3 下');
  expect(errors).toEqual([]);
});

test('one switch mutes every sound and is remembered', async ({ page }) => {
  await page.goto('/');
  const mute = page.getByRole('button', { name: '静音' });
  await expect(mute).toHaveAttribute('aria-pressed', 'false');
  await mute.click();
  await expect(mute).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await expect(mute).toHaveAttribute('aria-pressed', 'true');
});
