/**
 * Progress tracker for tools to report operation stages and timing
 */
export interface ProgressStep {
  step: number;
  stage: string;
  timestamp: number;
  durationMs: number;
}

export class ProgressTracker {
  private steps: ProgressStep[] = [];
  private startTime: number = Date.now();
  private stageStartTime: number = Date.now();
  private currentStep: number = 0;

  constructor(private toolName: string) {
    this.logToStderr(`[${toolName}] Starting analysis...`);
  }

  reportProgress(stage: string): void {
    const now = Date.now();
    const duration = now - this.stageStartTime;
    this.currentStep++;

    this.steps.push({
      step: this.currentStep,
      stage,
      timestamp: now,
      durationMs: duration,
    });

    this.logToStderr(`[${this.toolName}] Step ${this.currentStep}: ${stage} (${duration}ms)`);
    this.stageStartTime = now;
  }

  getProgress(): ProgressStep[] {
    return this.steps;
  }

  getTotalDurationMs(): number {
    return Date.now() - this.startTime;
  }

  getSummary(): string {
    const total = this.getTotalDurationMs();
    return `${this.steps.length} steps in ${total}ms`;
  }

  private logToStderr(message: string): void {
    process.stderr.write(message + '\n');
  }
}
