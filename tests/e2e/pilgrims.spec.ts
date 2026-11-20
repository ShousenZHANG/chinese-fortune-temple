import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';

// 香客簿 (spec stories 11–18): people are kept in this browser only, survive a reload, and leave and come back
// through one exported file. Everyone here is fictional.
async function addPilgrim(page: Page, person: {
  name: string; gender: '男' | '女'; calendar?: '农历'; date: [string, string, string]; time?: string; city: string;
}) {
  await page.getByLabel('称呼').fill(person.name);
  await page.getByRole('radio', { name: person.gender, exact: true }).check();
  if (person.calendar) await page.getByRole('radio', { name: person.calendar }).check();
  await page.getByLabel('年', { exact: true }).fill(person.date[0]);
  await page.getByLabel('月', { exact: true }).fill(person.date[1]);
  await page.getByLabel('日', { exact: true }).fill(person.date[2]);
  if (person.time) await page.getByLabel('出生时间').fill(person.time);
  else await page.getByLabel('时辰不知道').check();
  await page.getByLabel('出生地').fill(person.city);
  await page.getByRole('button', { name: '存下' }).click();
}

test('香客簿 keeps people on this device, exports them, clears them and imports them back', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('region', { name: '中庭', exact: true }).getByRole('link', { name: '香客簿' }).click();
  await expect(page.getByTestId('pilgrim-empty')).toBeVisible();

  await page.getByLabel('出生地').fill('北京');
  await expect(page.getByTestId('city-facts')).toHaveText('北京：东经 116.4°，时区 Asia/Shanghai');
  await addPilgrim(page, { name: '阿甲', gender: '男', date: ['1990', '6', '12'], city: '北京' });
  // Saving is asynchronous and clears the form when done; wait for it before typing the next person.
  await expect(page.getByRole('status')).toHaveText('已存下「阿甲」。');
  await addPilgrim(page, { name: '阿乙', gender: '女', calendar: '农历', date: ['1992', '8', '22'], time: '08:30', city: '香港' });
  await expect(page.getByRole('status')).toHaveText('已存下「阿乙」。');

  const rows = page.getByTestId('pilgrim');
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText('阿甲');
  await expect(rows.nth(0)).toContainText('公历 1990-06-12，时辰不知道，北京');
  await expect(rows.nth(1)).toContainText('农历 1992 年八月廿二 08:30，香港');

  await page.reload();
  await expect(rows).toHaveCount(2);

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出成文件' }).click();
  const file = await (await download).path();
  const backup = JSON.parse(await readFile(file, 'utf8'));
  expect(backup).toMatchObject({ format: 'youju-shansi-backup', version: 2, wishes: [] });
  expect(backup.pilgrims.map((p: { name: string }) => p.name)).toEqual(['阿甲', '阿乙']);

  await page.getByRole('button', { name: '清除全部' }).click();
  await expect(rows).toHaveCount(2);
  await page.getByRole('button', { name: '确认清除' }).click();
  await expect(page.getByTestId('pilgrim-empty')).toBeVisible();
  await page.reload();
  await expect(page.getByTestId('pilgrim-empty')).toBeVisible();

  await page.getByLabel('从文件导入').setInputFiles(file);
  await expect(rows).toHaveCount(2);
  await expect(page.getByRole('status')).toHaveText('导入了 2 位香客。');
});

test('a file that is not a 香客簿 backup is refused and changes nothing', async ({ page }) => {
  await page.goto('/#/xiangke');
  await page.getByLabel('从文件导入').setInputFiles({ name: 'notes.json', mimeType: 'application/json',
    buffer: Buffer.from('{"pilgrims": [{"name": "x"}]}') });
  await expect(page.getByRole('alert')).toContainText('不是有据山寺导出的香客簿文件');
  await expect(page.getByTestId('pilgrim-empty')).toBeVisible();
});

test('a date that does not exist is caught before it is saved', async ({ page }) => {
  await page.goto('/#/xiangke');
  await addPilgrim(page, { name: '阿丙', gender: '女', date: ['1991', '2', '30'], city: '上海' });
  await expect(page.getByRole('alert')).toHaveText('公历 1991 年 2 月没有 30 日。');
  await expect(page.getByTestId('pilgrim-empty')).toBeVisible();
});
