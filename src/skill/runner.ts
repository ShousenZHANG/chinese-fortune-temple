// Main-thread side of the Skill worker: one runTool() call per tool invocation, load progress as events.
import type { LoadStage, ToolCall, ToolResult, WorkerReply, WorkerRequest } from './protocol';

export class SkillRunner {
  private readonly worker: Worker;
  private nextId = 1;
  private readonly pending = new Map<number, { resolve(r: ToolResult): void; reject(e: Error): void }>();

  constructor(archive: string, onStage: (stage: LoadStage, detail?: string) => void = () => {}) {
    this.worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = (event: MessageEvent<WorkerReply>) => {
      const reply = event.data;
      if (reply.type === 'stage') {
        onStage(reply.stage, reply.detail);
        return;
      }
      const waiting = this.pending.get(reply.id);
      this.pending.delete(reply.id);
      if (reply.type === 'result') waiting?.resolve(reply.result);
      else waiting?.reject(new Error(reply.message));
    };
    this.send({ type: 'boot', base: import.meta.env.BASE_URL, archive });
  }

  runTool(call: ToolCall): Promise<ToolResult> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.send({ type: 'run', id, call });
    });
  }

  private send(message: WorkerRequest): void {
    this.worker.postMessage(message);
  }
}
