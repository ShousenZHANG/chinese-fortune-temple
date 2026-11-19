// The footer names the Skill release this build fetched and verified (scripts/fetch-skill.mjs).
interface SkillManifest {
  version: string;
  commit: string;
}

async function showSkillVersion(): Promise<void> {
  const label = document.querySelector<HTMLElement>('[data-testid="skill-version"]');
  if (!label) return;
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}skill/manifest.json`);
    if (!response.ok) throw new Error(String(response.status));
    const manifest = (await response.json()) as SkillManifest;
    label.textContent = `chinese-fortune v${manifest.version} · ${manifest.commit.slice(0, 7)}`;
  } catch {
    label.textContent = '算法包没有加载成功，请刷新再试';
  }
}

void showSkillVersion();
