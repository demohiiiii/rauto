import { orchestrationInlineWorkflowPreview } from "../model/orchestrationWorkflowPreview.js";
import type {
  JsonObject,
  OrchestrationJobModel,
  OrchestrationPlanFormModel,
  OrchestrationStageModel,
  OrchestrationWorkflowPreview,
  OrchestrationWorkflowPreviewRow,
} from "../model/types.js";

const STAGE_WIDTH = 380;
const STAGE_GAP = 132;
const STAGE_TOP = 96;
const STAGE_HEADER_HEIGHT = 72;
const STAGE_INSERT_SIZE = 44;
const JOB_GAP = 28;
const JOB_TOP = 92;
const JOB_SIDE = 20;
const JOB_HEADER_HEIGHT = 116;
const WORKFLOW_BLOCK_TOP_GAP = 20;
const JOB_EMPTY_BODY_HEIGHT = 72;
const JOB_BOTTOM = 18;
const JOB_ADD_BLOCK_HEIGHT = 44;
const WORKFLOW_BLOCK_BASE_HEIGHT = 82;
const WORKFLOW_COMMAND_ROW_HEIGHT = 26;
const WORKFLOW_BLOCK_GAP = 12;
const WORKFLOW_BLOCK_SIDE = 16;
const STAGE_BOTTOM = 56;

type WorkflowPreviewMap = Record<string, OrchestrationWorkflowPreview>;

export interface OrchestrationFlowGraph {
  edges: JsonObject[];
  nodes: JsonObject[];
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
      workflowPreviews[previewKey(stageIndex, jobIndex)] || {
        allRows: [],
        sourceKind: "template",
        sourceName: templateName,
        previewStatus: "loading",
        workflowName: "Template preview",
        blockCount: 0,
        rows: [],
        overflowCount: 0,
        unresolvedCount: 0,
        unresolvedPaths: [],
        errorMessage: "",
        workflow: {},
      }
    );
  }
  return orchestrationInlineWorkflowPreview(workflow?.workflow ?? {});
}

function previewRows(
  preview: OrchestrationWorkflowPreview,
): OrchestrationWorkflowPreviewRow[] {
  const rows = preview.allRows || preview.rows;
  return Array.isArray(rows) ? rows : [];
}

function workflowBlockCommands(row: OrchestrationWorkflowPreviewRow): string[] {
  const commands = row.operationTexts
    .map((command) => command.trim())
    .filter(Boolean);
  return commands.length ? commands : [textValue(row.operationText, "-")];
}

function workflowBlockHeight(row: OrchestrationWorkflowPreviewRow): number {
  return (
    WORKFLOW_BLOCK_BASE_HEIGHT +
    Math.max(0, workflowBlockCommands(row).length - 1) *
      WORKFLOW_COMMAND_ROW_HEIGHT
  );
}

function jobBottomHeight(preview: OrchestrationWorkflowPreview): number {
  return (
    JOB_BOTTOM + (preview.sourceKind === "manual" ? JOB_ADD_BLOCK_HEIGHT : 0)
  );
}

function jobHeight(preview: OrchestrationWorkflowPreview): number {
  const rows = previewRows(preview);
  const bodyHeight = rows.length
    ? rows.reduce((height, row) => height + workflowBlockHeight(row), 0) +
      Math.max(0, rows.length - 1) * WORKFLOW_BLOCK_GAP
    : JOB_EMPTY_BODY_HEIGHT;
  return (
    JOB_HEADER_HEIGHT +
    WORKFLOW_BLOCK_TOP_GAP +
    bodyHeight +
    jobBottomHeight(preview)
  );
}

function stageHeight(
  stage: OrchestrationStageModel,
  stageIndex: number,
  workflowPreviews: WorkflowPreviewMap,
): number {
  const jobs = stage.jobs ?? [];
  const contentHeight = jobs.reduce<number>(
    (height, job, jobIndex) =>
      height +
      jobHeight(
        jobWorkflowPreview(job, stageIndex, jobIndex, workflowPreviews),
      ),
    0,
  );
  return Math.max(
    220,
    JOB_TOP +
      contentHeight +
      Math.max(0, jobs.length - 1) * JOB_GAP +
      STAGE_BOTTOM,
  );
}

function jobTop(
  stage: OrchestrationStageModel,
  stageIndex: number,
  jobIndex: number,
  workflowPreviews: WorkflowPreviewMap,
): number {
  return (
    JOB_TOP +
    (stage.jobs ?? [])
      .slice(0, jobIndex)
      .reduce<number>(
        (offset, previousJob, previousIndex) =>
          offset +
          jobHeight(
            jobWorkflowPreview(
              previousJob,
              stageIndex,
              previousIndex,
              workflowPreviews,
            ),
          ) +
          JOB_GAP,
        0,
      )
  );
}

function stageNode(
  stage: OrchestrationStageModel,
  stageIndex: number,
  _workflowPreviews: WorkflowPreviewMap,
  height: number,
  centerY: number,
): JsonObject {
  const jobs = stage.jobs ?? [];
  return {
    id: `stage-${stageIndex}`,
    type: "stage",
    position: {
      x: stageIndex * (STAGE_WIDTH + STAGE_GAP),
      y: centerY - height / 2,
    },
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
    width: STAGE_WIDTH,
    height,
  };
}

function stageInsertNode(
  insertIndex: number,
  stageCount: number,
  centerY: number,
): JsonObject {
  const previousStageIndex = Math.max(0, insertIndex - 1);
  return {
    id: `stage-insert-${insertIndex}`,
    type: "stageInsert",
    position: {
      x:
        stageCount === 0
          ? 0
          : previousStageIndex * (STAGE_WIDTH + STAGE_GAP) +
            STAGE_WIDTH +
            (STAGE_GAP - STAGE_INSERT_SIZE) / 2,
      y: centerY - STAGE_INSERT_SIZE / 2,
    },
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
  jobCount: number,
  workflowPreviews: WorkflowPreviewMap,
): JsonObject {
  const stageStrategy = stage.strategy === "parallel" ? "parallel" : "serial";
  const preview = jobWorkflowPreview(
    job,
    stageIndex,
    jobIndex,
    workflowPreviews,
  );
  const y = jobTop(stage, stageIndex, jobIndex, workflowPreviews);
  return {
    id: `stage-${stageIndex}-job-${jobIndex}`,
    type: "job",
    parentId: `stage-${stageIndex}`,
    extent: "parent",
    position: { x: JOB_SIDE, y },
    data: {
      kind: "job",
      stageIndex,
      jobIndex,
      title: textValue(job.name, `Job ${jobIndex + 1}`),
      strategy: job.strategy === "parallel" ? "parallel" : "serial",
      stageStrategy,
      connectsToStageOutput:
        stageStrategy === "parallel" || jobIndex === jobCount - 1,
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
      blockCount: preview.blockCount,
      previewRows: previewRows(preview),
      overflowCount: preview.overflowCount,
      unresolvedCount: preview.unresolvedCount,
      previewError: preview.errorMessage,
      emptyWorkflow: previewRows(preview).length === 0,
      canAddBlock: preview.sourceKind === "manual",
    },
    selectable: true,
    draggable: false,
    width: STAGE_WIDTH - JOB_SIDE * 2,
    height: jobHeight(preview),
  };
}

function workflowBlockNodes(
  job: OrchestrationJobModel,
  stageIndex: number,
  jobIndex: number,
  workflowPreviews: WorkflowPreviewMap,
): JsonObject[] {
  const preview = jobWorkflowPreview(
    job,
    stageIndex,
    jobIndex,
    workflowPreviews,
  );
  const jobId = `stage-${stageIndex}-job-${jobIndex}`;
  const rows = previewRows(preview);
  let blockY = JOB_HEADER_HEIGHT + WORKFLOW_BLOCK_TOP_GAP;
  return rows.map((row, blockIndex) => {
    const height = workflowBlockHeight(row);
    const node = {
      id: `${jobId}-block-${blockIndex}`,
      type: "workflowBlock",
      parentId: jobId,
      extent: "parent",
      position: { x: WORKFLOW_BLOCK_SIDE, y: blockY },
      data: {
        kind: "workflow-block",
        stageIndex,
        jobIndex,
        blockIndex,
        title: textValue(row.blockName, `Block ${blockIndex + 1}`),
        operationText: textValue(row.operationText, "-"),
        commandRows: workflowBlockCommands(row),
        sourceKind: preview.sourceKind,
        unresolvedCount: preview.unresolvedCount,
        hasTarget: blockIndex > 0,
        hasSource: blockIndex < rows.length - 1,
      },
      selectable: true,
      draggable: false,
      width: STAGE_WIDTH - JOB_SIDE * 2 - WORKFLOW_BLOCK_SIDE * 2,
      height,
    };
    blockY += height + WORKFLOW_BLOCK_GAP;
    return node;
  });
}

function stageEdges(stages: readonly OrchestrationStageModel[]): JsonObject[] {
  return stages.flatMap((_stage, stageIndex) => {
    const insertIndex = stageIndex + 1;
    const edges: JsonObject[] = [
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
): JsonObject[] {
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
  const serialEdges: JsonObject[] = jobs.slice(0, -1).map((_job, jobIndex) => ({
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
  workflowPreviews: WorkflowPreviewMap,
): JsonObject[] {
  return (stage.jobs ?? []).flatMap((job, jobIndex) => {
    const rows = previewRows(
      jobWorkflowPreview(job, stageIndex, jobIndex, workflowPreviews),
    );
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
): OrchestrationFlowGraph {
  const stages = model.stages ?? [];
  const stageHeights = stages.map((stage, stageIndex) =>
    stageHeight(stage, stageIndex, workflowPreviews),
  );
  const stageCenterY =
    STAGE_TOP + Math.max(STAGE_HEADER_HEIGHT, ...stageHeights) / 2;
  const nodes: JsonObject[] = stages.flatMap((stage, stageIndex) => {
    const jobs = stage.jobs ?? [];
    return [
      stageNode(
        stage,
        stageIndex,
        workflowPreviews,
        stageHeights[stageIndex],
        stageCenterY,
      ),
      ...jobs.flatMap((job, jobIndex) => [
        jobNode(
          job,
          stage,
          stageIndex,
          jobIndex,
          jobs.length,
          workflowPreviews,
        ),
        ...workflowBlockNodes(job, stageIndex, jobIndex, workflowPreviews),
      ]),
    ];
  });
  if (stages.length === 0) {
    nodes.push(stageInsertNode(0, 0, stageCenterY));
  } else {
    nodes.push(
      ...stages.map((_stage, stageIndex) =>
        stageInsertNode(stageIndex + 1, stages.length, stageCenterY),
      ),
    );
  }
  return {
    nodes,
    edges: [
      ...stageEdges(stages),
      ...stages.flatMap((stage, stageIndex) => jobEdges(stage, stageIndex)),
      ...stages.flatMap((stage, stageIndex) =>
        workflowBlockEdges(stage, stageIndex, workflowPreviews),
      ),
    ],
  };
}

export function orchestrationNormalizeFlowSelection(
  model: Pick<OrchestrationPlanFormModel, "stages"> = { stages: [] },
  selection: unknown,
  workflowPreviews: WorkflowPreviewMap = {},
): JsonObject | null {
  const selectionValue = objectValue(selection);
  if (!Object.keys(selectionValue).length) return null;
  const stages = model.stages ?? [];
  const stageIndex = Number(selectionValue.stageIndex);
  if (!Number.isInteger(stageIndex) || stageIndex < 0 || !stages[stageIndex]) {
    return null;
  }
  if (selectionValue.kind === "stage") {
    return selectionValue.stageIndex === stageIndex
      ? selectionValue
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
      ? selectionValue
      : { kind: "job", stageIndex, jobIndex };
  }
  if (selectionValue.kind !== "workflow-block") return null;
  const blockIndex = Number(selectionValue.blockIndex);
  if (!Number.isInteger(blockIndex) || blockIndex < 0) return null;
  const job = jobs[jobIndex];
  const txWorkflow = job.action?.txWorkflow;
  const templateName = textValue(txWorkflow?.workflowTemplateName);
  const blockCount = templateName
    ? previewRows(
        jobWorkflowPreview(job, stageIndex, jobIndex, workflowPreviews),
      ).length
    : Array.isArray(txWorkflow?.workflow?.blocks)
      ? txWorkflow.workflow.blocks.length
      : 0;
  if (blockIndex >= blockCount) return null;
  return selectionValue.stageIndex === stageIndex &&
    selectionValue.jobIndex === jobIndex &&
    selectionValue.blockIndex === blockIndex
    ? selectionValue
    : { kind: "workflow-block", stageIndex, jobIndex, blockIndex };
}
