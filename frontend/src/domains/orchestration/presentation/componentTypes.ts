import type { Component } from "svelte";

export interface OrchestratedStageProps {
  active?: boolean;
  onEditorInput?: (text: string) => void;
  onExecute?: () => void;
}

export type OrchestratedStageComponent = Component<OrchestratedStageProps>;

export interface OrchestratedStageComponentModule {
  default: OrchestratedStageComponent;
}

export interface OrchestratedStageDefinition {
  id: "block" | "orchestrate" | "workflow";
  load(): Promise<OrchestratedStageComponentModule>;
}
