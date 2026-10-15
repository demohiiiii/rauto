import type { JsonObject } from "$lib/jsonValue.js";

export interface RenderedPrompt extends JsonObject {
  patterns: string[];
  response: string;
  record_input: boolean;
}

export interface RenderedCommand extends JsonObject {
  mode: string;
  command: string;
  multiline_mode: "split_lines" | "whole";
  timeout: number | null;
  dyn_params: { [key: string]: string | null };
  interaction: { prompts: RenderedPrompt[] };
}

export type RenderedOperation =
  | (RenderedCommand & { kind: "command" })
  | {
      kind: "flow";
      steps: RenderedCommand[];
      stop_on_error: boolean;
      max_steps: number | null;
    };

export type RenderedRollbackPolicy =
  | "none"
  | "per_step"
  | {
      whole_resource: {
        rollback: RenderedOperation;
        trigger_step_index: number;
      };
    };

export interface RenderedWorkflowStep extends JsonObject {
  run: RenderedOperation;
  rollback: RenderedOperation | null;
  rollback_on_failure: boolean;
}

export interface RenderedWorkflowBlock extends JsonObject {
  name: string;
  fail_fast: boolean;
  rollback_policy: RenderedRollbackPolicy;
  steps: RenderedWorkflowStep[];
}

export interface RenderedWorkflow extends JsonObject {
  name: string;
  fail_fast: boolean;
  blocks: RenderedWorkflowBlock[];
}

export function renderedOperationCommands(
  operation: RenderedOperation,
): RenderedCommand[] {
  return operation.kind === "command" ? [operation] : operation.steps;
}
