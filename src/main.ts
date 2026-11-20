// The footer names the Skill release this build fetched and verified (scripts/fetch-skill.mjs); the Skill worker
// starts loading at once so the first hall is ready by the time the visitor reaches it.
import './styles.css';
import { mountApp } from './app';
import type { LoadStage, ToolCall, ToolResult } from './skill/protocol';
import { LANG_EVENT, tr } from './i18n';
import { runTool, startSkill } from './skill/session';

declare global {
  interface Window {
    // The single entry the halls (and the parity test) use to reach the Skill.
    temple: { runTool(call: ToolCall): Promise<ToolResult> };
  }
}

const STAGES: Record<LoadStage, () => string> = {
  python: () => tr('正在加载 Python…', 'Loading Python…'),
  skill: () => tr('正在解开算法包…', 'Unpacking the Skill…'),
  ready: () => tr('算法包已就绪', 'The Skill is ready'),
  failed: () => tr('算法包没有加载成功，请刷新再试', 'The Skill did not load. Please refresh the page.'),
};

let current: LoadStage | null = null;

async function start(): Promise<void> {
  const label = document.querySelector<HTMLElement>('[data-testid="skill-version"]');
  const stage = document.querySelector<HTMLElement>('[data-testid="skill-stage"]');
  const root = document.querySelector<HTMLElement>('#app');
  if (root) mountApp(root);
  window.addEventListener(LANG_EVENT, () => {
    if (stage && current) stage.textContent = STAGES[current]();
  });
  try {
    const manifest = await startSkill((next) => {
      document.documentElement.dataset.skillStage = next;
      current = next;
      if (stage) stage.textContent = STAGES[next]();
    });
    if (label) label.textContent = `chinese-fortune v${manifest.version} · ${manifest.commit.slice(0, 7)}`;
    window.temple = { runTool };
  } catch {
    if (label) label.textContent = STAGES.failed();
  }
}

// Stories 8, 9: the service worker caches the whole site, so a second visit opens at once and works offline.
// `ready` resolves once a worker is active, which is after its install has cached every file.
function registerOffline(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  const label = document.querySelector<HTMLElement>('[data-testid="offline-ready"]');
  const show = () => { if (label) label.textContent = tr('已缓存，断网也能用', 'Cached: works offline'); };
  navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).then(() => navigator.serviceWorker.ready).then(() => {
    show();
    window.addEventListener(LANG_EVENT, show);
  }).catch(() => undefined);
}

void start();
registerOffline();
