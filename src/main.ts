// The footer names the Skill release this build fetched and verified (scripts/fetch-skill.mjs); the Skill worker
// starts loading at once so the first hall is ready by the time the visitor reaches it.
import type { ToolCall, ToolResult } from './skill/protocol';
import { SkillRunner } from './skill/runner';

interface SkillManifest {
  version: string;
  commit: string;
  archive: string;
  sources: Record<string, { commit: string; files: { path: string; sha: string }[] }>;
}

declare global {
  interface Window {
    // The single entry the halls (and the parity test) use to reach the Skill.
    temple: { runTool(call: ToolCall): Promise<ToolResult> };
  }
}

async function start(): Promise<void> {
  const label = document.querySelector<HTMLElement>('[data-testid="skill-version"]');
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}skill/manifest.json`);
    if (!response.ok) throw new Error(String(response.status));
    const manifest = (await response.json()) as SkillManifest;
    if (label) label.textContent = `chinese-fortune v${manifest.version} · ${manifest.commit.slice(0, 7)}`;
    const runner = new SkillRunner(manifest.archive, manifest.sources, (stage) => {
      document.documentElement.dataset.skillStage = stage;
    });
    window.temple = { runTool: (call) => runner.runTool(call) };
  } catch {
    if (label) label.textContent = '算法包没有加载成功，请刷新再试';
  }
}

void start();
