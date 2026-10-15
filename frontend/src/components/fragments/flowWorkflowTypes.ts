export type FlowWorkflowCommandRow = FlowWorkflowNodeActions & {
  selected?: boolean;
  onSelect?: () => void;
  rollbackSelected?: boolean;
  onSelectRollback?: () => void;
  controlNode?: FlowWorkflowBlockNodeData;
  summaryText: string;
  kindText?: string;
  rollbackSummaryText?: string;
  rollbackKindText?: string;
  canSplit?: boolean;
  splitDisabled?: boolean;
  splitLabel?: string;
  splitHint?: string;
  onSplit?: () => void;
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

export type FlowWorkflowAddActions = {
  readonly?: boolean;
  canAddBlock?: boolean;
  addBlockLabel: string;
  onAddBlock?: () => void;
  addControlActions?: { label: string; onAdd: () => void }[];
};

export type FlowWorkflowBlockNodeData = FlowWorkflowNodeActions & {
  commandsOnly?: boolean;
  id?: string;
  selected?: boolean;
  onSelect?: () => void;
  title: string;
  sequenceText: string;
  sourceKind: "manual" | "template";
  commandRows: FlowWorkflowCommandRow[];
  perStepRollbackEnabled?: boolean;
  canAddCommand?: boolean;
  addCommandLabel?: string;
  onAddCommand?: () => void;
  addCommandControlActions?: { label: string; onAdd: () => void }[];
  metaText?: string;
  emptyCommandText?: string;
  hasSource: boolean;
  hasTarget: boolean;
  structure?: {
    kind: "loop" | "choice";
    canAddBranch?: boolean;
    addBranchLabel?: string;
    onAddBranch?: () => void;
    branches: (Partial<FlowWorkflowAddActions> &
      FlowWorkflowNodeActions & {
        id: string;
        title: string;
        conditionText?: string;
        conditionLabel?: string;
        onChangeCondition?: (value: string) => void;
        canDelete?: boolean;
        entries: FlowWorkflowBlockNodeData[];
        emptyText: string;
      })[];
  };
  wholeResourceRollback?: {
    kindText: string;
    summaryText: string;
    selected?: boolean;
    onSelect?: () => void;
  } | null;
};

export type FlowWorkflowGroupNodeData = FlowWorkflowNodeActions &
  FlowWorkflowAddActions & {
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
    hasSerialHandles?: boolean;
    connectsToStageOutput?: boolean;
  };
