import { expect, test, type Locator, type Page, type Request } from '@playwright/test';

// v2 spec 场景模式, 3D step 1: the courtyard is the 3D temple or the 2.5D painting, and the first rule that applies
// decides. 3D stays behind ?scene=3d until it is finished. The hall tiles and direct links work in both.

const painting = (page: Page) => page.getByRole('img', { name: /有据山寺全景/ });
const court3d = (page: Page) => page.getByRole('img', { name: /三维中庭/ });

/** How many colours a screenshot of the element has: a blank canvas has one, a lit scene many. */
async function colours(page: Page, element: Locator): Promise<number> {
  const png = await element.screenshot();
  return page.evaluate(async (src) => {
    const image = new Image();
    image.src = src;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return 0;
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, image.width, image.height).data;
    const seen = new Set<number>();
    for (let i = 0; i < pixels.length; i += 4) seen.add((pixels[i] << 16) | (pixels[i + 1] << 8) | pixels[i + 2]);
    return seen.size;
  }, `data:image/png;base64,${png.toString('base64')}`);
}

test('?scene=3d opens the 3D courtyard, which draws, and the halls are still a tap away', async ({ page }) => {
  await page.goto('/?scene=3d');
  await expect(court3d(page)).toBeVisible();
  await expect(painting(page)).toHaveCount(0);
  await expect.poll(() => colours(page, court3d(page))).toBeGreaterThan(20);

  await page.getByRole('region', { name: '中庭', exact: true }).getByRole('link', { name: /求签殿/ }).click();
  await expect(page.getByRole('heading', { name: '求签殿' })).toBeVisible();
  await page.getByRole('link', { name: '回中庭' }).click();
  await expect(court3d(page)).toBeVisible();
});

test('a plain visit gets the 2.5D painting, never downloads the 3D code, and is not offered 3D yet', async ({ page }) => {
  const scripts = (into: Set<string>) => (request: Request) => {
    if (request.resourceType() === 'script') into.add(new URL(request.url()).pathname);
  };
  const plain = new Set<string>();
  page.on('request', scripts(plain));
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await expect(painting(page)).toBeVisible();
  await expect(court3d(page)).toHaveCount(0);
  await page.getByRole('link', { name: '设置', exact: true }).click();
  await expect(page.getByRole('heading', { name: '设置', exact: true })).toBeVisible();
  await expect(page.getByRole('radiogroup', { name: '中庭画面' })).toHaveCount(0);

  page.removeAllListeners('request');
  const in3d = new Set<string>();
  page.on('request', scripts(in3d));
  await page.goto('/?scene=3d');
  await expect(court3d(page)).toBeVisible();
  expect([...in3d].filter((path) => !plain.has(path))).not.toEqual([]);
});

test('the 3D／2.5D switch in Settings takes effect and is remembered', async ({ page }) => {
  // Until 3D is finished the switch is offered to a visit that opened 3D by address, or has picked before.
  await page.goto('/?scene=3d#/shezhi');
  await page.getByRole('radiogroup', { name: '中庭画面' }).getByRole('radio', { name: '2.5D', exact: true }).check();

  // From here on the address has no ?scene=3d, so the pick alone decides.
  await page.goto('/#/shezhi');
  await page.getByRole('radiogroup', { name: '中庭画面' }).getByRole('radio', { name: '3D', exact: true }).check();
  await page.getByRole('link', { name: '回中庭' }).click();
  await expect(court3d(page)).toBeVisible();
  await page.reload();
  await expect(court3d(page)).toBeVisible();

  await page.getByRole('link', { name: '设置', exact: true }).click();
  await page.getByRole('radiogroup', { name: '中庭画面' }).getByRole('radio', { name: '2.5D', exact: true }).check();
  await page.getByRole('link', { name: '回中庭' }).click();
  await expect(painting(page)).toBeVisible();
  await expect(court3d(page)).toHaveCount(0);
  await page.reload();
  await page.waitForLoadState('networkidle');
  await expect(painting(page)).toBeVisible();
  await expect(court3d(page)).toHaveCount(0);
});

// Spec story 7: whatever the 3D court is doing, the hall list takes a first visit to its first slip within 60 s.
test('with ?scene=3d a first visit still gets its first slip within 60 seconds', async ({ page }) => {
  test.setTimeout(90_000);
  const start = Date.now();
  await page.goto('/?scene=3d');
  await page.getByRole('region', { name: '中庭', exact: true }).getByRole('link', { name: /求签殿/ }).click();
  await page.getByRole('button', { name: '这次面试能不能过' }).click();
  await page.getByRole('button', { name: '就按这个时区' }).click();
  for (let i = 0; i < 6; i += 1) await page.getByRole('button', { name: '掷一次' }).click();
  await expect(page.getByRole('article', { name: '签文卡' })).toBeVisible({ timeout: 60_000 });
  const seconds = (Date.now() - start) / 1000;
  test.info().annotations.push({ type: 'first slip with 3D', description: `${seconds.toFixed(1)} s` });
  expect(seconds).toBeLessThan(60);
});

test('with reduced motion a plain visit gets the 2.5D painting, and ?scene=3d still opens 3D', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await expect(painting(page)).toBeVisible();
  await expect(court3d(page)).toHaveCount(0);
  await page.goto('/?scene=3d');
  await expect(court3d(page)).toBeVisible();
});

test.describe('in English', () => {
  test.use({ locale: 'en-US' });

  test('the 3D court and the switch read in English', async ({ page }) => {
    await page.goto('/?scene=3d');
    await expect(page.getByRole('img', { name: /The courtyard in 3D/ })).toBeVisible();
    await page.getByRole('link', { name: 'Settings', exact: true }).click();
    const choice = page.getByRole('radiogroup', { name: 'Courtyard scene' });
    await expect(choice.getByRole('radio', { name: '3D', exact: true })).toBeChecked();
    await expect(page.getByText('This address carries ?scene=3d')).toBeVisible();
  });
});
