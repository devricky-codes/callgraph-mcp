/**
 * Progress tracker for tools to report operation stages and timing
 */
import { logVerbose } from './logger';

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
  private verbose: boolean = process.env.FLOWMAP_VERBOSE !== 'false';

  constructor(private toolName: string) {
    if (this.verbose) {
      logVerbose(`[${toolName}] Starting analysis...`);
    }
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

    if (this.verbose) {
      logVerbose(`[${this.toolName}] Step ${this.currentStep}: ${stage} (${duration}ms)`);
    }
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
}
