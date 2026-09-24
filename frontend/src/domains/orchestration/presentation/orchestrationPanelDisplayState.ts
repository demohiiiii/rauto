import { t } from "../../../lib/i18n.js";

interface OrchestratedShellState {
  currentTxStage: string;
}

export interface OrchestrationStageDisplay {
  blockActive: boolean;
  newButtonLabelKey: string;
  orchestrationActive: boolean;
  titleText: string;
  workflowActive: boolean;
}

export function orchestrationStagePresentation(
  stage = "",
): OrchestrationStageDisplay {
  const normalized = stage === "orchestrate" ? stage : "workflow";
  return {
    blockActive: false,
    newButtonLabelKey: "txWorkflowAddBlockBtn",
    orchestrationActive: normalized === "orchestrate",
    titleText: t(
      normalized === "workflow"
        ? "txStageWorkflow"
        : normalized === "orchestrate"
          ? "txStageOrchestrate"
          : "txStageOrchestrate",
    ),
    workflowActive: normalized === "workflow",
  };
}

export function orchestratedPagePresentation(
  shellState: OrchestratedShellState = {
    currentTxStage: "workflow",
  },
): OrchestrationStageDisplay {
  return orchestrationStagePresentation(shellState.currentTxStage);
}

export function orchestratedActiveStageDefinition<TDefinition>(
  stageDisplay: Partial<OrchestrationStageDisplay> = {},
  stageDefinitions: readonly TDefinition[] = [],
): TDefinition | null {
  if (stageDefinitions.length === 0) return null;
  if (stageDisplay.workflowActive) return stageDefinitions[0] || null;
  return stageDefinitions[1] || stageDefinitions[0] || null;
}
