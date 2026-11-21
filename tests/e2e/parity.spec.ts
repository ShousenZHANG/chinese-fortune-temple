import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

// The second agreed seam (issue #1): the Worker runs the same Skill code as the CLI, so its output must match the
// Skill's own CLI byte for byte (line endings normalised). reference.json is regenerated from the pinned package.
const { cases } = JSON.parse(readFileSync('tests/parity/cases.json', 'utf8'));
const { results } = JSON.parse(readFileSync('tests/parity/reference.json', 'utf8'));

declare global {
  interface Window {
    temple: { runTool(call: { skill?: string; script: string; argv: string[]; stdin?: string }): Promise<{ exitCode: number; stdout: string }> };
  }
}

test.describe.configure({ mode: 'serial' });

for (const c of cases) {
  test(`worker matches the Skill CLI: ${c.id}`, async ({ page }) => {
    // The comparison does not depend on the screen, so one project is enough.
    test.skip(test.info().project.name !== 'desktop', 'desktop only');
    test.setTimeout(180_000);
    await page.goto('/');
    await page.waitForFunction(() => window.temple !== undefined);
    const got = await page.evaluate((call) => window.temple.runTool(call), {
      skill: c.skill, script: c.script, argv: c.argv, stdin: c.stdin,
    });
    expect(got.exitCode).toBe(results[c.id].exitCode);
    expect(got.stdout.replace(/\r\n/g, '\n')).toBe(results[c.id].stdout);
  });
}

// Switching skills in one Worker drops the other skill's modules and puts the right scripts directory first.
// Running chinese-fortune, then life-guide, then chinese-fortune again must still match the CLI every time.
// Both skills ship safety_stop.py; at v6.3.1 the two copies are identical, so this checks the switch itself,
// not which copy is picked once they differ.
test('one worker switches skills without mixing their modules', async ({ page }) => {
  test.skip(test.info().project.name !== 'desktop', 'desktop only');
  test.setTimeout(240_000);
  await page.goto('/');
  await page.waitForFunction(() => window.temple !== undefined);
  for (const id of ['router-emergency', 'life-emergency', 'router-emergency', 'life-decide']) {
    const c = cases.find((item: { id: string }) => item.id === id);
    const got = await page.evaluate((call) => window.temple.runTool(call), {
      skill: c.skill, script: c.script, argv: c.argv, stdin: c.stdin,
    });
    expect(got.exitCode, id).toBe(results[id].exitCode);
    expect(got.stdout.replace(/\r\n/g, '\n'), id).toBe(results[id].stdout);
  }
});
