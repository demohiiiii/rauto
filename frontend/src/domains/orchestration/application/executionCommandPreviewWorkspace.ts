import { get, writable } from "svelte/store";
import { t } from "$lib/i18n.js";
import type { ConnectionRequestPayload } from "$domains/connections/index.js";
import type { RenderedWorkflow } from "$domains/transactions/index.js";
import type {
  ExecuteOrchestrationResponse,
  OrchestrationJsonObject,
} from "../model/types.js";
import {
  orchestrationInlineExecutionPayload,
  txWorkflowInlineExecutionPayload,
} from "../model/orchestratedExecutionPayloads.js";
import type {
  OrchestrationExecutionRequest,
  TxWorkflowExecutionRequest,
  TxWorkflowExecutionResponse,
} from "../model/orchestratedExecutionPayloads.js";

export interface ExecutionCommandPreviewInput {
  feature: "tx-workflow" | "orchestrate";
  sourceText: string;
  varsText: string;
  connection?: ConnectionRequestPayload;
}

export interface RenderedWorkflowPreviewEntry {
  stageName: string;
  jobName: string;
  connectionName: string;
  host: string;
  workflow: RenderedWorkflow;
}

export interface ExecutionCommandPreviewPort {
  executeTxWorkflow(
    request: TxWorkflowExecutionRequest,
    signal: AbortSignal,
  ): Promise<TxWorkflowExecutionResponse>;
  executeOrchestration(
    request: OrchestrationExecutionRequest,
    signal: AbortSignal,
  ): Promise<ExecuteOrchestrationResponse>;
}

interface PreviewState {
  open: boolean;
  loading: boolean;
  stale: boolean;
  error: string;
  entries: RenderedWorkflowPreviewEntry[];
}

function parseVars(text: string): OrchestrationJsonObject {
  const value: unknown = text.trim() ? JSON.parse(text) : {};
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(t("renderedCommandsVarsInvalid"));
  return value as OrchestrationJsonObject;
}

export function createExecutionCommandPreviewWorkspace(
  port: ExecutionCommandPreviewPort,
) {
  const empty = (): PreviewState => ({
    open: false,
    loading: false,
    stale: false,
    error: "",
    entries: [],
  });
  const state = writable<PreviewState>(empty());
  let input: ExecutionCommandPreviewInput | null = null;
  let inputKey = "";
  let generation = 0;
  let controller: AbortController | null = null;
  let destroyed = false;

  function cancel(): void {
    generation += 1;
    controller?.abort();
    controller = null;
  }

  function updateInput(next: ExecutionCommandPreviewInput): void {
    if (destroyed) return;
    const key = JSON.stringify(next);
    if (key === inputKey) return;
    inputKey = key;
    input = structuredClone(next);
    cancel();
    state.update((current) => ({
      ...current,
      loading: false,
      stale: current.open,
      error: "",
      entries: [],
    }));
  }

  async function refresh(): Promise<void> {
    if (destroyed || !input || !get(state).open) return;
    cancel();
    const token = generation;
    controller = new AbortController();
    const signal = controller.signal;
    const snapshot = input;
    state.set({
      open: true,
      loading: true,
      stale: false,
      error: "",
      entries: [],
    });
    try {
      const vars = parseVars(snapshot.varsText);
      let entries: RenderedWorkflowPreviewEntry[];
      if (snapshot.feature === "tx-workflow") {
        if (!snapshot.connection)
          throw new Error(t("connectionTargetRequired"));
        const response = await port.executeTxWorkflow(
          {
            ...txWorkflowInlineExecutionPayload({
              connection: snapshot.connection,
              dryRun: true,
              workflowText: snapshot.sourceText,
              workflowVars: vars,
            }),
            preview_commands: true,
          },
          signal,
        );
        entries = [
          {
            stageName: "",
            jobName: "",
            connectionName: snapshot.connection.connection_name || "",
            host: snapshot.connection.host || "",
            workflow: response.workflow,
          },
        ];
      } else {
        const response = await port.executeOrchestration(
          {
            ...orchestrationInlineExecutionPayload({
              connection: snapshot.connection,
              dryRun: true,
              planText: snapshot.sourceText,
              planVars: vars,
            }),
            preview_commands: true,
          },
          signal,
        );
        if (!response.rendered_workflows)
          throw new Error(t("renderedCommandsUnavailable"));
        entries = response.rendered_workflows.map((entry) => ({
          stageName: entry.stage_name,
          jobName: entry.job_name,
          connectionName: entry.connection_name || "",
          host: entry.host,
          workflow: entry.workflow,
        }));
      }
      if (!destroyed && token === generation)
        state.set({
          open: true,
          loading: false,
          stale: false,
          error: "",
          entries,
        });
    } catch (error) {
      if (!destroyed && token === generation)
        state.set({
          open: true,
          loading: false,
          stale: false,
          error: error instanceof Error ? error.message : String(error),
          entries: [],
        });
    }
  }

  function close(): void {
    cancel();
    state.set(empty());
  }

  return {
    state,
    updateInput,
    async show(next: ExecutionCommandPreviewInput): Promise<void> {
      if (destroyed) return;
      updateInput(next);
      state.update((current) => ({ ...current, open: true }));
      await refresh();
    },
    refresh,
    close,
    destroy(): void {
      destroyed = true;
      close();
    },
  };
}
