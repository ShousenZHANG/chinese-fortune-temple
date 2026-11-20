import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';

// 黄历亭 (spec stories 29–33). "Now" is fixed and the zone confirmed, so the requests equal the parity cases
// week-xiangzhu (fortune_reading --markdown) and month-moving (huangli_query --month). Everyone is fictional.
test.use({ timezoneId: 'Asia/Shanghai' });

const person = (id: string, name: string, year: number, month: number, day: number, time: object) => ({
  id, name, gender: 'male', date: { calendar: 'solar', year, month, day }, time, city: '北京', addedAt: `2026-11-20T00:00:0${id}.000Z`,
});

async function seed(page: Page, people: object[]) {
  await page.clock.setFixedTime(new Date('2026-11-20T02:00:00Z'));
  await page.goto('/#/xiangke');
  await page.getByLabel('从文件导入').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({
    format: 'youju-shansi-backup', version: 1, exportedAt: '2026-11-20T00:00:00.000Z', pilgrims: people })) });
  await expect(page.getByTestId('pilgrim')).toHaveCount(people.length);
  await page.goto('/#/huangli');
  await page.getByRole('button', { name: '就按这个时区' }).click();
}

async function reference(id: string): Promise<string> {
  return JSON.parse(await readFile('tests/parity/reference.json', 'utf8')).results[id].stdout;
}

test('this week is graded by birth year, opening with the Skill\'s own lead and date range', async ({ page }) => {
  test.setTimeout(180_000);
  await seed(page, [person('1', '阿甲', 1990, 6, 12, { known: true, hour: 21, minute: 25 })]);
  await page.getByRole('radio', { name: '这周哪天好' }).check();
  await page.getByRole('button', { name: '看日子' }).click();

  const card = page.getByRole('article', { name: '签文卡' });
  await expect(card).toBeVisible({ timeout: 150_000 });
  const paragraphs = (await reference('week-xiangzhu')).split('\n\n').map((p) => p.trim()).filter(Boolean);
  const lead = paragraphs.slice(0, paragraphs.findIndex((p) => p.startsWith('日期：')) + 1);
  await expect(card.getByTestId('first-answer').locator('p')).toHaveText(lead);

  await card.getByText('看盘面').click();
  await expect(card.getByRole('table', { name: '逐日等级' })).toContainText('11月17日');
  await expect(card).not.toContainText('写回答时');
});

test('a month lists the calendar facts first, then grades the days by birth year on request', async ({ page }) => {
  test.setTimeout(240_000);
  await seed(page, [person('2', '我', 1987, 10, 20, { known: false })]);
  await page.getByRole('radio', { name: '某个月哪天办事' }).check();
  await page.getByLabel('哪个月').fill('2026-12');
  await page.getByLabel('办什么事').selectOption('搬家');
  await page.getByRole('button', { name: '看日子' }).click();

  const cards = page.getByRole('article', { name: '签文卡' });
  await expect(cards).toHaveCount(1, { timeout: 150_000 });
  const month = JSON.parse(await reference('month-moving'));
  await expect(cards.first().getByTestId('first-answer').locator('p')).toHaveText([month.say, month.not_ranked]);

  await page.getByRole('button', { name: /按我的生年分等级/ }).click();
  await expect(cards).toHaveCount(2, { timeout: 150_000 });
  await expect(cards.last().getByTestId('first-answer')).toContainText('忌搬家');
});
