import {
  createTransactionWorkflowCanvasWorkspace,
  txWorkflowFormModelFromJson,
  txWorkflowFormModelToJsonText,
} from "$domains/transactions/index.js";
import type {
  TransactionWorkflowCanvasWorkspace,
  TxWorkflowFormModel,
  TxBlockCommandTarget,
} from "$domains/transactions/index.js";
import { plainObject } from "$lib/jsonValue.js";
import { readonly, writable } from "svelte/store";
import type { Unsubscriber } from "svelte/store";
import type { TransactionBlockCanvasState } from "$domains/transactions/index.js";
import { orchestrationUpdateInlineWorkflow } from "../model/orchestrationTxWorkflowActions.js";
import { orchestrationWorkflowPreviewFormState } from "../model/orchestrationWorkflowPreview.js";
import type {
  OrchestrationJobModel,
  OrchestrationPlanFormModel,
  OrchestrationWorkflowPreview,
} from "../model/types.js";

interface Entry {
  model: TxWorkflowFormModel;
  source: string | null;
  // Preserve editor IDs while the parent still exposes the source we just changed.
  pendingSource?: string;
  workspace: TransactionWorkflowCanvasWorkspace;
  unsubscribe?: Unsubscriber;
}

export function createOrchestrationWorkflowCanvasRegistry({
  getModel,
  onChange,
  canModify,
  getSelectedId,
  getSelectedStepIndex = () => null,
  getSelectedOperation = () => "run",
  onSelect,
  onSelectStep,
  onSelectWholeRollback,
  templateOptions,
}: {
  getModel: () => OrchestrationPlanFormModel;
  onChange: (model: OrchestrationPlanFormModel) => void;
  canModify: () => boolean;
  getSelectedId: (jobId: string) => string | null;
  getSelectedStepIndex?: (jobId: string) => number | null;
  getSelectedOperation?: (jobId: string) => TxBlockCommandTarget;
  onSelect: (jobId: string, editorId: string | null) => void;
  onSelectStep?: (
    jobId: string,
    editorId: string,
    stepIndex: number,
    operation?: "run" | "rollback",
  ) => void;
  onSelectWholeRollback?: (jobId: string, editorId: string) => void;
  templateOptions?: Parameters<
    typeof createTransactionWorkflowCanvasWorkspace
  >[0]["templateOptions"];
}) {
  const entries = new Map<string, Entry>();
  const canvasStates = writable<
    Record<string, Record<string, TransactionBlockCanvasState>>
  >({});
  function findJob(jobId: string) {
    for (const [stageIndex, stage] of getModel().stages.entries()) {
      const jobIndex = stage.jobs.findIndex((job) => job.editorId === jobId);
      if (jobIndex >= 0)
        return { job: stage.jobs[jobIndex], stageIndex, jobIndex };
    }
    return null;
  }
  function source(
    job: OrchestrationJobModel,
    preview?: OrchestrationWorkflowPreview,
  ) {
    const template = job.action.txWorkflow.workflowTemplateName;
    const workflow = template
      ? (preview?.workflow ?? {})
      : (job.action.txWorkflow.workflow ?? {});
    return { workflow, text: JSON.stringify([template || "", workflow]) };
  }
  function refreshManual(jobId: string, entry: Entry): TxWorkflowFormModel {
    const current = findJob(jobId);
    if (current && !current.job.action.txWorkflow.workflowTemplateName) {
      const next = source(current.job);
      if (next.text !== entry.source && next.text !== entry.pendingSource) {
        const parsed = orchestrationWorkflowPreviewFormState(next.workflow);
        entry.model = parsed.formModel ?? txWorkflowFormModelFromJson({});
        entry.source = parsed.formModel ? next.text : null;
        entry.pendingSource = undefined;
      }
    }
    return entry.model;
  }
  function update(jobId: string, next: TxWorkflowFormModel): void {
    const entry = entries.get(jobId);
    const current = findJob(jobId);
    if (
      !entry ||
      !current ||
      !canModify() ||
      current.job.action.txWorkflow.workflowTemplateName
    )
      return;
    const currentSource = source(current.job).text;
    if (currentSource !== entry.source && currentSource !== entry.pendingSource)
      return;
    const workflow: unknown = JSON.parse(txWorkflowFormModelToJsonText(next));
    if (!plainObject(workflow)) return;
    entry.model = next;
    entry.pendingSource = currentSource;
    entry.source = JSON.stringify(["", workflow]);
    onChange(
      orchestrationUpdateInlineWorkflow(
        getModel(),
        current.stageIndex,
        current.jobIndex,
        workflow,
      ),
    );
  }
  function models(
    previews: Record<string, OrchestrationWorkflowPreview>,
  ): Record<string, TxWorkflowFormModel> {
    const live = new Set<string>();
    const result: Record<string, TxWorkflowFormModel> = {};
    getModel().stages.forEach((stage, stageIndex) =>
      stage.jobs.forEach((job, jobIndex) => {
        const jobId = job.editorId;
        live.add(jobId);
        const next = source(job, previews[`${stageIndex}:${jobIndex}`]);
        let entry = entries.get(jobId);
        if (!entry) {
          const parsed = orchestrationWorkflowPreviewFormState(next.workflow);
          const created: Entry = {
            model: parsed.formModel ?? txWorkflowFormModelFromJson({}),
            source: parsed.formModel ? next.text : null,
            workspace: createTransactionWorkflowCanvasWorkspace({
              getModel: () => refreshManual(jobId, created),
              onChange: (model) => update(jobId, model),
              canModify: () =>
                canModify() &&
                !!findJob(jobId) &&
                !findJob(jobId)?.job.action.txWorkflow.workflowTemplateName,
              getSelectedId: () => getSelectedId(jobId),
              getSelectedStepIndex: () => getSelectedStepIndex(jobId),
              getSelectedOperation: () => getSelectedOperation(jobId),
              onSelect: (id) => onSelect(jobId, id),
              onSelectStep: onSelectStep
                ? (id, index, operation) =>
                    onSelectStep(jobId, id, index, operation)
                : undefined,
              onSelectWholeRollback: onSelectWholeRollback
                ? (id) => onSelectWholeRollback(jobId, id)
                : undefined,
              templateOptions,
            }),
          };
          entries.set(jobId, created);
          created.unsubscribe =
            created.workspace.templates.canvasStateStore.subscribe((state) =>
              canvasStates.update((states) => ({ ...states, [jobId]: state })),
            );
          entry = created;
        } else if (
          entry.source !== next.text &&
          entry.pendingSource !== next.text
        ) {
          const parsed = orchestrationWorkflowPreviewFormState(next.workflow);
          entry.model = parsed.formModel ?? txWorkflowFormModelFromJson({});
          entry.source = parsed.formModel ? next.text : null;
          entry.pendingSource = undefined;
        }
        if (entry.source === next.text) entry.pendingSource = undefined;
        entry.workspace.sync();
        result[jobId] = entry.model;
      }),
    );
    for (const [id, entry] of entries)
      if (!live.has(id)) {
        entry.unsubscribe?.();
        entry.workspace.destroy();
        entries.delete(id);
        canvasStates.update((states) => {
          const next = { ...states };
          delete next[id];
          return next;
        });
      }
    return result;
  }
  return {
    models,
    canvasStateStore: readonly(canvasStates),
    update,
    get: (jobId: string) => entries.get(jobId)?.workspace ?? null,
    destroy: () => {
      for (const entry of entries.values()) {
        entry.unsubscribe?.();
        entry.workspace.destroy();
      }
      entries.clear();
      canvasStates.set({});
    },
  };
}
