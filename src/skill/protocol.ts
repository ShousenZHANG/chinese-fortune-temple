// The one interface the rest of the site uses to reach the Skill (spec, issue #1): the same shape as a CLI call,
// so the parity test can compare it with the Skill's own command line.
export type SkillName = 'chinese-fortune' | 'life-guide';

export interface ToolCall {
  /** Which skill's scripts directory the tool lives in; chinese-fortune when omitted. */
  skill?: SkillName;
  script: string;
  argv: string[];
  stdin?: string;
}

export interface ToolResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export type LoadStage = 'python' | 'skill' | 'ready' | 'failed';

export type WorkerRequest =
  | { type: 'boot'; base: string; archive: string; sources: Record<string, { files: { path: string }[] }> }
  | { type: 'run'; id: number; call: ToolCall };

export type WorkerReply =
  | { type: 'stage'; stage: LoadStage; detail?: string }
  | { type: 'result'; id: number; result: ToolResult }
  | { type: 'error'; id: number; message: string };
