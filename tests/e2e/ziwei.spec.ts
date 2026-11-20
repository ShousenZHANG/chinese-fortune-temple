import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';

// 紫微殿 (spec stories 37–40): one person with a known hour, one topic, ziwei_calc --focus-palace. 阿丙 is the
// parity cases ziwei-*-city: born in a leap fourth month, at a clock time whose true solar time is one 时辰 earlier.
test.use({ timezoneId: 'Asia/Shanghai' });

const BACKUP = {
  format: 'youju-shansi-backup', version: 1, exportedAt: '2026-11-20T00:00:00.000Z',
  pilgrims: [
    { id: 'c', name: '阿丙', gender: 'male', date: { calendar: 'solar', year: 2001, month: 5, day: 26 },
      time: { known: true, hour: 19, minute: 10 }, city: '北京', addedAt: '2026-11-20T00:00:00.000Z' },
    { id: 'd', name: '阿丁', gender: 'female', date: { calendar: 'solar', year: 1995, month: 3, day: 8 },
      time: { known: false }, city: '上海', addedAt: '2026-11-20T00:00:01.000Z' },
  ],
};

interface Focus {
  say: string;
  career?: { first_answer: { text: string }[] };
  condition_charts: { condition: string; say: string; same: boolean }[];
  terms: Record<string, string>;
}

async function focus(id: string): Promise<Focus> {
  const results = JSON.parse(await readFile('tests/parity/reference.json', 'utf8')).results;
  return JSON.parse(results[id].stdout).focus;
}

async function seed(page: Page) {
  await page.goto('/#/xiangke');
  await page.getByLabel('从文件导入').setInputFiles({ name: 'backup.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(BACKUP)) });
  await expect(page.getByTestId('pilgrim')).toHaveCount(2);
}

test('a career chart opens with the Skill\'s three sentences and lists both leap-month readings', async ({ page }) => {
  test.setTimeout(180_000);
  await seed(page);
  await page.goto('/#/ziwei');
  await expect(page.getByLabel('谁的命盘')).toHaveText('阿丙（男）');
  await expect(page.getByText('时辰不知道的 1 位不在列表里')).toBeVisible();
  await page.getByRole('radio', { name: '事业（官禄宫）' }).check();
  await page.getByRole('button', { name: '排盘' }).click();

  const card = page.getByRole('article', { name: '签文卡' });
  await expect(card).toBeVisible({ timeout: 150_000 });
  await expect(card.getByRole('heading')).toHaveText('阿丙的官禄宫');
  const career = await focus('ziwei-career-city');
  await expect(card.getByTestId('first-answer').locator('p')).toHaveText(career.career!.first_answer.map((p) => p.text));

  await card.getByText('看盘面').click();
  await expect(card.getByRole('table', { name: '几种排法' })).toContainText('闰四月按五月排');
  await expect(card).toContainText(`三方四正：${career.terms['三方四正']}`);
});

test('a love chart opens with the palace sentence and each other reading the Skill lists', async ({ page }) => {
  test.setTimeout(180_000);
  await seed(page);
  await page.goto('/#/ziwei');
  await page.getByRole('radio', { name: '感情（夫妻宫）' }).check();
  await page.getByRole('button', { name: '排盘' }).click();

  const card = page.getByRole('article', { name: '签文卡' });
  await expect(card).toBeVisible({ timeout: 150_000 });
  const love = await focus('ziwei-love-city');
  const others = love.condition_charts.filter((chart) => !chart.same).map((chart) => `${chart.condition}：${chart.say}`);
  await expect(card.getByTestId('first-answer').locator('p')).toHaveText([love.say, ...others]);
});
