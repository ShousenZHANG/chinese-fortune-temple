// The one interface the rest of the site uses to reach the Skill (spec, issue #1): the same shape as a CLI call,
// so the parity test can compare it with the Skill's own command line.
export interface ToolCall {
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
  | { type: 'boot'; base: string; archive: string }
  | { type: 'run'; id: number; call: ToolCall };

export type WorkerReply =
  | { type: 'stage'; stage: LoadStage; detail?: string }
  | { type: 'result'; id: number; result: ToolResult }
  | { type: 'error'; id: number; message: string };
