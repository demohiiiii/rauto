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

export interface OrchestratedStageDefinition {
  id: string;
  load(): Promise<unknown>;
}

export function orchestrationStagePresentation(
  stage = "",
): OrchestrationStageDisplay {
  const normalized =
    stage === "workflow" || stage === "orchestrate" ? stage : "block";
  return {
    blockActive: normalized === "block",
    newButtonLabelKey:
      normalized === "workflow" ? "txWorkflowAddBlockBtn" : "newBtn",
    orchestrationActive: normalized === "orchestrate",
    titleText: t(
      normalized === "workflow"
        ? "txStageWorkflow"
        : normalized === "orchestrate"
          ? "txStageOrchestrate"
          : "txStageBlock",
    ),
    workflowActive: normalized === "workflow",
  };
}

export function orchestratedPagePresentation(
  shellState: OrchestratedShellState = {
    currentTxStage: "block",
  },
): OrchestrationStageDisplay {
  return orchestrationStagePresentation(shellState.currentTxStage);
}

export function orchestratedActiveStageDefinition(
  stageDisplay: Partial<OrchestrationStageDisplay> = {},
  stageDefinitions: readonly OrchestratedStageDefinition[] = [],
): OrchestratedStageDefinition | null {
  if (stageDefinitions.length === 0) return null;
  if (stageDisplay.blockActive) return stageDefinitions[0] || null;
  if (stageDisplay.workflowActive) return stageDefinitions[1] || null;
  return stageDefinitions[2] || stageDefinitions[0] || null;
}
