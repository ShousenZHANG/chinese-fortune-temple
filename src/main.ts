// The footer names the Skill release this build fetched and verified (scripts/fetch-skill.mjs); the Skill worker
// starts loading at once so the first hall is ready by the time the visitor reaches it.
import './styles.css';
import { mountApp } from './app';
import type { LoadStage, ToolCall, ToolResult } from './skill/protocol';
import { runTool, startSkill } from './skill/session';

declare global {
  interface Window {
    // The single entry the halls (and the parity test) use to reach the Skill.
    temple: { runTool(call: ToolCall): Promise<ToolResult> };
  }
}

const STAGES: Record<LoadStage, string> = {
  python: '正在加载 Python…',
  skill: '正在解开算法包…',
  ready: '算法包已就绪',
  failed: '算法包没有加载成功，请刷新再试',
};

async function start(): Promise<void> {
  const label = document.querySelector<HTMLElement>('[data-testid="skill-version"]');
  const stage = document.querySelector<HTMLElement>('[data-testid="skill-stage"]');
  const root = document.querySelector<HTMLElement>('#app');
  if (root) mountApp(root);
  try {
    const manifest = await startSkill((next) => {
      document.documentElement.dataset.skillStage = next;
      if (stage) stage.textContent = STAGES[next];
    });
    if (label) label.textContent = `chinese-fortune v${manifest.version} · ${manifest.commit.slice(0, 7)}`;
    window.temple = { runTool };
  } catch {
    if (label) label.textContent = '算法包没有加载成功，请刷新再试';
  }
}

void start();
