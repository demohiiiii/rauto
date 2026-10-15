import {
  orchestrationInlineWorkflowPreview,
  orchestrationWorkflowPreview,
  orchestrationWorkflowPreviewFormState,
} from "../model/orchestrationWorkflowPreview.js";
import {
  txWorkflowFlowGraph,
  txWorkflowFormModelFromJson,
  txWorkflowFindBlock,
  txWorkflowNormalizeCommandSelection,
} from "$domains/transactions/index.js";
import type {
  TransactionBlockCanvasState,
  TxWorkflowFormModel,
  TxBlockCommandTarget,
} from "$domains/transactions/index.js";
import type { FlowWorkflowBlockNodeData } from "../../../components/fragments/flowWorkflowTypes.js";
import type {
  JsonObject,
  OrchestrationJobModel,
  OrchestrationPlanFormModel,
  OrchestrationStageModel,
  OrchestrationWorkflowPreview,
} from "../model/types.js";

const STAGE_WIDTH = 380;
const STAGE_GAP = 132;
const STAGE_TOP = 96;
const STAGE_HEADER_HEIGHT = 72;
const STAGE_INSERT_SIZE = 44;
const JOB_GAP = 28;
const JOB_TOP = 92;
const JOB_SIDE = 20;
const STAGE_BOTTOM = 56;

type WorkflowPreviewMap = Record<string, OrchestrationWorkflowPreview>;
type WorkflowModelMap = Record<string, TxWorkflowFormModel>;
type WorkflowGraphMap = Record<string, ReturnType<typeof txWorkflowFlowGraph>>;

export type OrchestrationFlowSelection =
  | { kind: "job"; jobIndex: number; stageIndex: number }
  | { kind: "stage"; stageIndex: number }
  | {
      blockIndex: number;
      editorId?: string;
      stepIndex?: number;
      operation?: TxBlockCommandTarget;
      jobIndex: number;
      kind: "workflow-block";
      stageIndex: number;
    };

interface OrchestrationFlowPosition {
  x: number;
  y: number;
}

interface OrchestrationFlowNodeBase {
  draggable: false;
  extent?: "parent";
  height: number;
  id: string;
  parentId?: string;
  position: OrchestrationFlowPosition;
  selectable: boolean;
  style?: string;
  width: number;
}

export interface OrchestrationStageFlowNode extends OrchestrationFlowNodeBase {
  data: {
    empty: boolean;
    jobCount: number;
    kind: "stage";
    sequence: number;
    stageIndex: number;
    strategy: "parallel" | "serial";
    title: string;
  };
  type: "stage";
}

export interface OrchestrationStageInsertFlowNode extends OrchestrationFlowNodeBase {
  data: {
    hasSource: boolean;
    hasTarget: boolean;
    insertIndex: number;
    kind: "stage-insert";
    stageCount: number;
  };
  type: "stageInsert";
}

export interface OrchestrationJobFlowNode extends OrchestrationFlowNodeBase {
  data: {
    actionKind: "tx_workflow";
    actionSource: "workflow_json" | "workflow_template";
    blockCount: number;
    canAddBlock: boolean;
    connectsToStageOutput: boolean;
    emptyWorkflow: boolean;
    jobIndex: number;
    kind: "job";
    previewError: string;
    previewStatus: OrchestrationWorkflowPreview["previewStatus"];
    sourceKind: OrchestrationWorkflowPreview["sourceKind"];
    sourceName: string;
    stageIndex: number;
    stageStrategy: "parallel" | "serial";
    strategy: "parallel" | "serial";
    targetCount: number;
    title: string;
    unresolvedCount: number;
    workflowName: string;
  };
  type: "job";
}

export interface OrchestrationWorkflowBlockFlowNode extends OrchestrationFlowNodeBase {
  data: FlowWorkflowBlockNodeData & {
    blockIndex: number;
    jobIndex: number;
    kind: "workflow-block";
    stageIndex: number;
    unresolvedCount: number;
  };
  type: "workflowBlock";
}

export type OrchestrationFlowNode =
  | OrchestrationJobFlowNode
  | OrchestrationStageFlowNode
  | OrchestrationStageInsertFlowNode
  | OrchestrationWorkflowBlockFlowNode;

export interface OrchestrationFlowEdge {
  id: string;
  kind:
    | "parallel-job"
    | "serial-job"
    | "serial-job-output"
    | "stage-insert-link"
    | "stage-sequence"
    | "workflow-block";
  source: string;
  sourceHandle?: string;
  target: string;
  targetHandle?: string;
  type: "smoothstep" | "straight";
}

export interface OrchestrationFlowGraph {
  edges: OrchestrationFlowEdge[];
  nodes: OrchestrationFlowNode[];
}

function objectValue(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}

function textValue(value: string | null | undefined, fallback = ""): string {
  if (value == null) return fallback;
  return value.trim() || fallback;
}

function jobTargetCount(job: OrchestrationJobModel): number {
  return (
    (job.targetGroups?.length ?? 0) +
    (job.targetTags?.length ?? 0) +
    (job.targets?.length ?? 0)
  );
}

function previewKey(stageIndex: number, jobIndex: number): string {
  return `${stageIndex}:${jobIndex}`;
}

function jobWorkflowPreview(
  job: OrchestrationJobModel,
  stageIndex: number,
  jobIndex: number,
  workflowPreviews: WorkflowPreviewMap = {},
): OrchestrationWorkflowPreview {
  const workflow = job.action?.txWorkflow;
  const templateName = textValue(workflow?.workflowTemplateName);
  if (templateName) {
    return (
      workflowPreviews[previewKey(stageIndex, jobIndex)] ||
      orchestrationWorkflowPreview({
        sourceKind: "template",
        sourceName: templateName,
        status: "loading",
      })
    );
  }
  return orchestrationInlineWorkflowPreview(workflow?.workflow ?? {});
}

function jobLayout(job: OrchestrationJobModel, graphs: WorkflowGraphMap) {
  return graphs[job.editorId].group;
}

function stageWidth(
  stage: OrchestrationStageModel,
  graphs: WorkflowGraphMap,
): number {
  return Math.max(
    STAGE_WIDTH,
    ...stage.jobs.map((job) => jobLayout(job, graphs).width + JOB_SIDE * 2),
  );
}

function stageHeight(
  stage: OrchestrationStageModel,
  graphs: WorkflowGraphMap,
): number {
  const jobs = stage.jobs ?? [];
  return Math.max(
    220,
    JOB_TOP +
      jobs.reduce((sum, job) => sum + jobLayout(job, graphs).height, 0) +
      Math.max(0, jobs.length - 1) * JOB_GAP +
      STAGE_BOTTOM,
  );
}

function jobTop(
  stage: OrchestrationStageModel,
  jobIndex: number,
  graphs: WorkflowGraphMap,
): number {
  return (
    JOB_TOP +
    stage.jobs
      .slice(0, jobIndex)
      .reduce(
        (offset, job) => offset + jobLayout(job, graphs).height + JOB_GAP,
        0,
      )
  );
}

function stageNode(
  stage: OrchestrationStageModel,
  stageIndex: number,
  width: number,
  height: number,
  x: number,
  centerY: number,
): OrchestrationStageFlowNode {
  const jobs = stage.jobs ?? [];
  return {
    id: `stage-${stageIndex}`,
    type: "stage",
    position: { x, y: centerY - height / 2 },
    data: {
      kind: "stage",
      stageIndex,
      sequence: stageIndex + 1,
      title: textValue(stage.name, `Stage ${stageIndex + 1}`),
      strategy: stage.strategy === "parallel" ? "parallel" : "serial",
      jobCount: jobs.length,
      empty: jobs.length === 0,
    },
    selectable: true,
    draggable: false,
    width,
    height,
  };
}

function stageInsertNode(
  insertIndex: number,
  stageCount: number,
  x: number,
  centerY: number,
): OrchestrationStageInsertFlowNode {
  return {
    id: `stage-insert-${insertIndex}`,
    type: "stageInsert",
    position: { x, y: centerY - STAGE_INSERT_SIZE / 2 },
    data: {
      kind: "stage-insert",
      insertIndex,
      stageCount,
      hasTarget: stageCount > 0,
      hasSource: insertIndex < stageCount,
    },
    selectable: false,
    draggable: false,
    width: STAGE_INSERT_SIZE,
    height: STAGE_INSERT_SIZE,
  };
}

function jobNode(
  job: OrchestrationJobModel,
  stage: OrchestrationStageModel,
  stageIndex: number,
  jobIndex: number,
  workflowPreviews: WorkflowPreviewMap,
  graphs: WorkflowGraphMap,
): OrchestrationJobFlowNode {
  const stageStrategy = stage.strategy === "parallel" ? "parallel" : "serial";
  const preview = jobWorkflowPreview(
    job,
    stageIndex,
    jobIndex,
    workflowPreviews,
  );
  const layout = jobLayout(job, graphs);
  return {
    id: `stage-${stageIndex}-job-${jobIndex}`,
    type: "job",
    parentId: `stage-${stageIndex}`,
    extent: "parent",
    position: { x: JOB_SIDE, y: jobTop(stage, jobIndex, graphs) },
    data: {
      kind: "job",
      stageIndex,
      jobIndex,
      title: textValue(job.name, `Job ${jobIndex + 1}`),
      strategy: job.strategy === "parallel" ? "parallel" : "serial",
      stageStrategy,
      connectsToStageOutput:
        stageStrategy === "parallel" || jobIndex === stage.jobs.length - 1,
      actionKind: "tx_workflow",
      actionSource:
        preview.sourceKind === "template"
          ? "workflow_template"
          : "workflow_json",
      targetCount: jobTargetCount(job),
      sourceKind: preview.sourceKind,
      sourceName: preview.sourceName,
      previewStatus: preview.previewStatus,
      workflowName: preview.workflowName,
      blockCount: graphs[job.editorId].blocks.length,
      unresolvedCount: preview.unresolvedCount,
      previewError: preview.errorMessage,
      emptyWorkflow: graphs[job.editorId].blocks.length === 0,
      canAddBlock: preview.sourceKind === "manual",
    },
    selectable: true,
    draggable: false,
    width: layout.width,
    height: layout.height,
  };
}

function workflowBlockNodes(
  job: OrchestrationJobModel,
  stageIndex: number,
  jobIndex: number,
  workflowPreviews: WorkflowPreviewMap,
  graphs: WorkflowGraphMap,
): OrchestrationWorkflowBlockFlowNode[] {
  const preview = jobWorkflowPreview(
    job,
    stageIndex,
    jobIndex,
    workflowPreviews,
  );
  const jobId = `stage-${stageIndex}-job-${jobIndex}`;
  return graphs[job.editorId].blocks.map((block, blockIndex) => ({
    ...block,
    id: `${jobId}-block-${blockIndex}`,
    type: "workflowBlock",
    parentId: jobId,
    extent: "parent",
    data: {
      ...block.data,
      kind: "workflow-block",
      stageIndex,
      jobIndex,
      blockIndex,
      sourceKind:
        preview.sourceKind === "template" ? "template" : block.data.sourceKind,
      unresolvedCount: preview.unresolvedCount,
    },
    selectable: true,
    draggable: false,
  }));
}

function stageEdges(
  stages: readonly OrchestrationStageModel[],
): OrchestrationFlowEdge[] {
  return stages.flatMap((_stage, stageIndex) => {
    const insertIndex = stageIndex + 1;
    const edges: OrchestrationFlowEdge[] = [
      {
        id: `stage-${stageIndex}-insert-${insertIndex}`,
        source: `stage-${stageIndex}`,
        sourceHandle: "stage-output",
        target: `stage-insert-${insertIndex}`,
        kind: "stage-insert-link",
        type: "straight",
      },
    ];
    if (insertIndex < stages.length) {
      edges.push({
        id: `stage-insert-${insertIndex}-stage-${insertIndex}`,
        source: `stage-insert-${insertIndex}`,
        target: `stage-${insertIndex}`,
        targetHandle: "stage-input",
        kind: "stage-sequence",
        type: "straight",
      });
    }
    return edges;
  });
}

function jobEdges(
  stage: OrchestrationStageModel,
  stageIndex: number,
): OrchestrationFlowEdge[] {
  const jobs = stage.jobs ?? [];
  if (stage.strategy === "parallel") {
    return jobs.map((_job, jobIndex) => ({
      id: `stage-${stageIndex}-parallel-job-${jobIndex}`,
      source: `stage-${stageIndex}-job-${jobIndex}`,
      sourceHandle: "stage-out",
      target: `stage-${stageIndex}`,
      targetHandle: "jobs-output",
      kind: "parallel-job",
      type: "straight",
    }));
  }
  const serialEdges: OrchestrationFlowEdge[] = jobs
    .slice(0, -1)
    .map((_job, jobIndex) => ({
      id: `stage-${stageIndex}-job-edge-${jobIndex}-${jobIndex + 1}`,
      source: `stage-${stageIndex}-job-${jobIndex}`,
      sourceHandle: "serial-out",
      target: `stage-${stageIndex}-job-${jobIndex + 1}`,
      targetHandle: "serial-in",
      kind: "serial-job",
      type: "smoothstep",
    }));
  if (jobs.length === 0) return serialEdges;
  const lastJobIndex = jobs.length - 1;
  serialEdges.push({
    id: `stage-${stageIndex}-serial-output`,
    source: `stage-${stageIndex}-job-${lastJobIndex}`,
    sourceHandle: "stage-out",
    target: `stage-${stageIndex}`,
    targetHandle: "jobs-output",
    kind: "serial-job-output",
    type: "straight",
  });
  return serialEdges;
}

function workflowBlockEdges(
  stage: OrchestrationStageModel,
  stageIndex: number,
  graphs: WorkflowGraphMap,
): OrchestrationFlowEdge[] {
  return (stage.jobs ?? []).flatMap((job, jobIndex) => {
    const rows = graphs[job.editorId].blocks;
    const jobId = `stage-${stageIndex}-job-${jobIndex}`;
    return rows.slice(0, -1).map((_row, blockIndex) => ({
      id: `${jobId}-block-edge-${blockIndex}-${blockIndex + 1}`,
      source: `${jobId}-block-${blockIndex}`,
      sourceHandle: "block-output",
      target: `${jobId}-block-${blockIndex + 1}`,
      targetHandle: "block-input",
      kind: "workflow-block",
      type: "smoothstep",
    }));
  });
}

export function orchestrationFlowGraph(
  model: Pick<OrchestrationPlanFormModel, "stages"> = { stages: [] },
  workflowPreviews: WorkflowPreviewMap = {},
  workflowModels: WorkflowModelMap = {},
  workflowBlockStates: Record<
    string,
    Record<string, TransactionBlockCanvasState>
  > = {},
): OrchestrationFlowGraph {
  const stages = model.stages ?? [];
  const graphs: WorkflowGraphMap = {};
  stages.forEach((stage, stageIndex) =>
    stage.jobs.forEach((job, jobIndex) => {
      const preview = jobWorkflowPreview(
        job,
        stageIndex,
        jobIndex,
        workflowPreviews,
      );
      graphs[job.editorId] = txWorkflowFlowGraph(
        workflowModels[job.editorId] ??
          orchestrationWorkflowPreviewFormState(preview.workflow).formModel ??
          txWorkflowFormModelFromJson({}),
        {
          canAddBlock: preview.sourceKind === "manual",
          blockStates: workflowBlockStates[job.editorId],
        },
      );
    }),
  );
  const heights = stages.map((stage) => stageHeight(stage, graphs));
  const widths = stages.map((stage) => stageWidth(stage, graphs));
  let nextX = 0;
  const positions = widths.map((width) => {
    const x = nextX;
    nextX += width + STAGE_GAP;
    return x;
  });
  const centerY = STAGE_TOP + Math.max(STAGE_HEADER_HEIGHT, ...heights) / 2;
  const nodes: OrchestrationFlowNode[] = stages.flatMap((stage, stageIndex) => [
    stageNode(
      stage,
      stageIndex,
      widths[stageIndex],
      heights[stageIndex],
      positions[stageIndex],
      centerY,
    ),
    ...stage.jobs.flatMap((job, jobIndex) => [
      jobNode(job, stage, stageIndex, jobIndex, workflowPreviews, graphs),
      ...workflowBlockNodes(
        job,
        stageIndex,
        jobIndex,
        workflowPreviews,
        graphs,
      ),
    ]),
  ]);
  if (!stages.length) nodes.push(stageInsertNode(0, 0, 0, centerY));
  else
    nodes.push(
      ...stages.map((_stage, index) =>
        stageInsertNode(
          index + 1,
          stages.length,
          positions[index] +
            widths[index] +
            (STAGE_GAP - STAGE_INSERT_SIZE) / 2,
          centerY,
        ),
      ),
    );
  return {
    nodes,
    edges: [
      ...stageEdges(stages),
      ...stages.flatMap((stage, index) => jobEdges(stage, index)),
      ...stages.flatMap((stage, index) =>
        workflowBlockEdges(stage, index, graphs),
      ),
    ],
  };
}

export function orchestrationNormalizeFlowSelection(
  model: Pick<OrchestrationPlanFormModel, "stages"> = { stages: [] },
  selection: unknown,
  workflowPreviews: WorkflowPreviewMap = {},
  workflowModels: WorkflowModelMap = {},
  workflowBlockStates: Record<
    string,
    Record<string, TransactionBlockCanvasState>
  > = {},
): OrchestrationFlowSelection | null {
  const selectionValue = objectValue(selection);
  if (!Object.keys(selectionValue).length) return null;
  const stages = model.stages ?? [];
  const stageIndex = Number(selectionValue.stageIndex);
  if (!Number.isInteger(stageIndex) || stageIndex < 0 || !stages[stageIndex]) {
    return null;
  }
  if (selectionValue.kind === "stage") {
    return selectionValue.stageIndex === stageIndex
      ? (selectionValue as OrchestrationFlowSelection)
      : { kind: "stage", stageIndex };
  }
  const jobIndex = Number(selectionValue.jobIndex);
  const jobs = stages[stageIndex].jobs ?? [];
  if (!Number.isInteger(jobIndex) || jobIndex < 0 || !jobs[jobIndex]) {
    return null;
  }
  if (selectionValue.kind === "job") {
    return selectionValue.stageIndex === stageIndex &&
      selectionValue.jobIndex === jobIndex
      ? (selectionValue as OrchestrationFlowSelection)
      : { kind: "job", stageIndex, jobIndex };
  }
  if (selectionValue.kind !== "workflow-block") return null;
  const editorId =
    typeof selectionValue.editorId === "string"
      ? selectionValue.editorId
      : null;
  let location =
    editorId && workflowModels[jobs[jobIndex].editorId]
      ? txWorkflowFindBlock(workflowModels[jobs[jobIndex].editorId], editorId)
      : null;
  if (editorId && !location) return null;
  const selectedBlock = location?.block;
  while (location?.parentId)
    location = txWorkflowFindBlock(
      workflowModels[jobs[jobIndex].editorId],
      location.parentId,
    );
  const blockIndex = location?.blockIndex ?? Number(selectionValue.blockIndex);
  if (!Number.isInteger(blockIndex) || blockIndex < 0) return null;
  const job = jobs[jobIndex];
  const txWorkflow = job.action?.txWorkflow;
  const templateName = textValue(txWorkflow?.workflowTemplateName);
  const workflow = templateName
    ? jobWorkflowPreview(job, stageIndex, jobIndex, workflowPreviews).workflow
    : txWorkflow?.workflow;
  const blockCount =
    workflowModels[job.editorId]?.blocks.length ??
    (Array.isArray(workflow?.blocks) ? workflow.blocks.length : 0);
  if (blockIndex >= blockCount) return null;
  const blockModel =
    (editorId
      ? workflowBlockStates[job.editorId]?.[editorId]?.formModel
      : null) ??
    selectedBlock?.inlineBlock ??
    workflowModels[job.editorId]?.blocks[blockIndex]?.inlineBlock;
  const commandSelection = txWorkflowNormalizeCommandSelection(blockModel, {
    stepIndex:
      typeof selectionValue.stepIndex === "number"
        ? selectionValue.stepIndex
        : undefined,
    operation:
      selectionValue.operation === "run" ||
      selectionValue.operation === "rollback" ||
      selectionValue.operation === "whole_resource_rollback"
        ? selectionValue.operation
        : undefined,
  });
  const { stepIndex, operation } = commandSelection;
  return selectionValue.stageIndex === stageIndex &&
    selectionValue.jobIndex === jobIndex &&
    selectionValue.blockIndex === blockIndex &&
    selectionValue.stepIndex === stepIndex &&
    selectionValue.operation === operation
    ? (selectionValue as OrchestrationFlowSelection)
    : {
        kind: "workflow-block",
        stageIndex,
        jobIndex,
        blockIndex,
        ...(editorId ? { editorId } : {}),
        ...commandSelection,
      };
}
