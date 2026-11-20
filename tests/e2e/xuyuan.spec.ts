import { expect, test, type Page } from '@playwright/test';

// 许愿树 and 愿望簿 (spec stories 45–57). "Today" is fixed at 2026-11-20 in Asia/Shanghai.
test.use({ timezoneId: 'Asia/Shanghai' });

async function open(page: Page) {
  await page.clock.setFixedTime(new Date('2026-11-20T02:00:00Z'));
  await page.goto('/#/xuyuan');
}

async function makeWish(page: Page, category: string, text: string) {
  await page.getByRole('radio', { name: category, exact: true }).check();
  await page.getByLabel('心愿').fill(text);
  await page.getByRole('button', { name: '三个月后' }).click();
  await page.getByRole('button', { name: '挂上许愿牌' }).click();
}

test('a wish is made, kept, and fulfilled with an offering on a card that says it is a ritual', async ({ page }) => {
  await open(page);
  await makeWish(page, '学业', '明年顺利考上研究生');
  const wish = page.getByTestId('wish');
  await expect(wish).toHaveCount(1);
  await expect(wish.getByTestId('wish-status')).toHaveText('已许');
  await expect(wish).toContainText('许于 2026-11-20，还愿日 2027-02-20');

  await page.reload();
  await expect(wish).toHaveCount(1);
  await wish.getByRole('button', { name: '还愿' }).click();
  await wish.getByRole('button', { name: '上一炷香' }).click();
  await expect(wish.getByTestId('wish-status')).toHaveText('已还');
  await expect(page.getByRole('article', { name: '还愿卡' })).toContainText('这是仪式，不是推算');
  await expect(page.getByTestId('merit')).toContainText('还愿 1 次');
});

test('a wish can be released without being called a failure', async ({ page }) => {
  await open(page);
  await makeWish(page, '姻缘', '遇到一个合得来的人');
  const wish = page.getByTestId('wish');
  await wish.getByRole('button', { name: '放下' }).click();
  await wish.getByRole('button', { name: '确认放下' }).click();
  await expect(wish.getByTestId('wish-status')).toHaveText('已放下');
  await expect(page.locator('main')).not.toContainText(/失败|招灾|报应/);
  await expect(page.getByTestId('merit')).toContainText('还愿 0 次');
});

test('a wish against someone else is refused gently, with the reason', async ({ page }) => {
  await open(page);
  await makeWish(page, '其他', '希望他出车祸');
  await expect(page.getByRole('alert')).toContainText('许愿树不收希望别人受害的愿望');
  await expect(page.getByTestId('wish-empty')).toBeVisible();
});

test('a health wish is taken, with a reminder to see a doctor', async ({ page }) => {
  await open(page);
  await makeWish(page, '健康', '希望妈妈的手术顺利');
  await expect(page.getByRole('status')).toContainText('身体不适先就医');
  await expect(page.getByTestId('wish')).toContainText('身体不适先就医');
});

test('a wish whose day has come is mentioned at the gate', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-20T02:00:00Z'));
  await page.goto('/#/xiangke');
  await page.getByLabel('从文件导入').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({
    format: 'youju-shansi-backup', version: 2, exportedAt: '2026-11-20T00:00:00.000Z', pilgrims: [],
    wishes: [{ id: 'w1', category: '学业', text: '期末考过', madeOn: '2026-08-20', returnOn: '2026-11-01', source: null,
      state: { status: 'made' } }] })) });
  await expect(page.getByRole('status')).toHaveText('导入了 0 位香客和 1 个愿望。');
  await page.getByRole('link', { name: '回中庭' }).click();
  const reminder = page.getByRole('complementary', { name: '还愿提醒' });
  await expect(reminder).toContainText('你在 2026 年 8 月许的学业之愿到了还愿的日子');
  await reminder.getByRole('link', { name: '去许愿树' }).click();
  await expect(page.getByTestId('wish')).toContainText('到还愿的日子了');
});
