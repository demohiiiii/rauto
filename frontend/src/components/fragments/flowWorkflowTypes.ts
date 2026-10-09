export type FlowWorkflowCommandRow = {
  summaryText: string;
  kindText?: string;
  rollbackSummaryText?: string;
  rollbackKindText?: string;
};

export type FlowWorkflowNodeActions = {
  readonly?: boolean;
  editable?: boolean;
  canMovePrevious?: boolean;
  canMoveNext?: boolean;
  movePreviousLabel?: string;
  moveNextLabel?: string;
  duplicateLabel?: string;
  deleteLabel?: string;
  onMovePrevious?: () => void;
  onMoveNext?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
};

export type FlowWorkflowBlockNodeData = FlowWorkflowNodeActions & {
  title: string;
  sequenceText: string;
  sourceKind: "manual" | "template";
  commandRows: FlowWorkflowCommandRow[];
  metaText?: string;
  emptyCommandText?: string;
  hasSource: boolean;
  hasTarget: boolean;
  wholeResourceRollback?: {
    kindText: string;
    summaryText: string;
  } | null;
};

export type FlowWorkflowGroupNodeData = FlowWorkflowNodeActions & {
  title: string;
  sequenceText?: string;
  workflowName?: string;
  sourceKind: "manual" | "template";
  sourceLabelText: string;
  sourceName?: string;
  strategyText: string;
  targetCountText?: string;
  blockCountText: string;
  unresolvedText?: string;
  previewStatus: "ready" | "loading" | "error";
  previewError?: string;
  previewErrorText?: string;
  previewLoadingText?: string;
  emptyWorkflow: boolean;
  emptyWorkflowText: string;
  canAddBlock: boolean;
  addBlockLabel: string;
  onAddBlock?: () => void;
  hasSerialHandles?: boolean;
  connectsToStageOutput?: boolean;
};
