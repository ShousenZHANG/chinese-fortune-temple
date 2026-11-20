// One Skill worker for the whole page. Halls call runJson(); the footer and the card read the manifest.
import type { LoadStage, ToolCall, ToolResult } from './protocol';
import { SkillRunner } from './runner';

export interface SkillManifest {
  repo: string;
  version: string;
  commit: string;
  archive: string;
  sources: Record<string, { commit: string; files: { path: string; sha: string }[] }>;
  /** Third-party packages vendored in the Skill, read from their METADATA at build time. */
  vendored: { name: string; version: string; license: string }[];
}

/** The tool ran but did not give a usable answer; message is for the visitor. */
export class ToolFailed extends Error {}

let manifest: SkillManifest | null = null;
let settle: { resolve(runner: SkillRunner): void; reject(error: Error): void };
// Halls and pages may ask before the manifest has arrived (a page opened directly by its address); they wait here.
const runner = new Promise<SkillRunner>((resolve, reject) => { settle = { resolve, reject }; });
runner.catch(() => undefined);

export async function startSkill(onStage: (stage: LoadStage) => void): Promise<SkillManifest> {
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}skill/manifest.json`);
    if (!response.ok) throw new Error(`manifest answered ${response.status}`);
    manifest = (await response.json()) as SkillManifest;
    settle.resolve(new SkillRunner(manifest.archive, manifest.sources, onStage));
    return manifest;
  } catch (error) {
    settle.reject(new ToolFailed('算法包没有加载成功，请刷新页面再试。'));
    throw error;
  }
}

export function skillVersion(): string {
  return manifest ? `chinese-fortune v${manifest.version}` : 'chinese-fortune';
}

export async function runTool(call: ToolCall): Promise<ToolResult> {
  return (await runner).runTool(call);
}

/** Runs a tool that prints one JSON object and returns it, or throws ToolFailed with the tool's own reason. */
export async function runJson<T = Record<string, unknown>>(call: ToolCall): Promise<T> {
  const result = await runTool(call);
  let value: unknown;
  try {
    value = JSON.parse(result.stdout);
  } catch {
    throw new ToolFailed(`${call.script} 没有给出结果（退出码 ${result.exitCode}）。`);
  }
  const record = value as { ok?: boolean; error?: unknown; message?: unknown };
  if (result.exitCode !== 0 || record.ok === false) {
    const reason = record.message ?? record.error ?? `退出码 ${result.exitCode}`;
    throw new ToolFailed(`${call.script} 没有算成：${typeof reason === 'string' ? reason : JSON.stringify(reason)}`);
  }
  return value as T;
}
