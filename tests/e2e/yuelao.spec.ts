import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';

// 月老殿 (spec stories 24–28): two people from 香客簿, a red thread, pair_facts. The two are the parity case
// pair-xieji, so the first layer must equal the Skill CLI's own `say` for them, word for word.
test.use({ timezoneId: 'Asia/Shanghai' });

const BACKUP = {
  format: 'youju-shansi-backup', version: 1, exportedAt: '2026-11-20T00:00:00.000Z',
  pilgrims: [
    { id: 'a', name: '阿甲', gender: 'male', date: { calendar: 'solar', year: 1990, month: 6, day: 12 },
      time: { known: false }, city: '北京', addedAt: '2026-11-20T00:00:00.000Z' },
    { id: 'b', name: '阿乙', gender: 'female', date: { calendar: 'solar', year: 1992, month: 9, day: 18 },
      time: { known: false }, city: '北京', addedAt: '2026-11-20T00:00:01.000Z' },
  ],
};

async function reference(id: string): Promise<{ say: string[] }> {
  const results = JSON.parse(await readFile('tests/parity/reference.json', 'utf8')).results;
  return JSON.parse(results[id].stdout);
}

async function seed(page: Page) {
  await page.goto('/#/xiangke');
  await page.getByLabel('从文件导入').setInputFiles({ name: 'backup.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(BACKUP)) });
  await expect(page.getByTestId('pilgrim')).toHaveCount(2);
}

test("two people tied with the red thread get the Skill's own pair facts, and no score", async ({ page }) => {
  test.setTimeout(180_000);
  await seed(page);
  await page.goto('/#/yuelao');
  await page.getByLabel('一方', { exact: true }).selectOption({ label: '阿甲（男）' });
  await page.getByLabel('另一方', { exact: true }).selectOption({ label: '阿乙（女）' });
  await page.getByRole('button', { name: '系红绳' }).click();

  const card = page.getByRole('article', { name: '签文卡' });
  await expect(card).toBeVisible({ timeout: 150_000 });
  await expect(card.getByRole('heading')).toHaveText('阿甲与阿乙');
  const expected = (await reference('pair-xuanze')).say;
  await expect(card.getByTestId('first-answer').locator('p')).toHaveText(expected);
  await expect(card).not.toContainText(/\d+\s*分(?!钟)/);

  await card.getByText('看原文').click();
  await card.getByRole('button', { name: 'xieji:c036:p0016' }).click();
  await expect(page.getByTestId('passage-xieji:c036:p0016').locator('blockquote')).toContainText('三元九宫');
});

// The 《协纪辨方书》 path is the parity case pair-xieji. chinese-fortune v6.3.0 withheld this card because its own
// quote of the start table did not match the bundled text; v6.3.1 quotes it verbatim, so the card now passes.
test('the 《协纪辨方书》 path gets the Skill’s own pair facts for that book', async ({ page }) => {
  test.setTimeout(180_000);
  await seed(page);
  await page.goto('/#/yuelao');
  await page.getByRole('radio', { name: /协纪辨方书/ }).check();
  await page.getByRole('button', { name: '系红绳' }).click();

  const card = page.getByRole('article', { name: '签文卡' });
  await expect(card).toBeVisible({ timeout: 150_000 });
  const expected = (await reference('pair-xieji')).say;
  await expect(card.getByTestId('first-answer').locator('p')).toHaveText(expected);
  await expect(card).toContainText('起兑七中元起坎一下元起巽四');
});

test('月老殿 sends visitors to 香客簿 when it holds fewer than two people', async ({ page }) => {
  await page.goto('/#/yuelao');
  await expect(page.getByText('香客簿里至少要有两个人')).toBeVisible();
  await page.getByRole('link', { name: '去香客簿添人' }).click();
  await expect(page.getByRole('heading', { name: '香客簿' })).toBeVisible();
});
