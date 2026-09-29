import type { Component } from "svelte";
import type { JsonObject } from "$domains/transactions/index.js";

export interface OrchestratedStageProps {
  active?: boolean;
  onEditorInput?: (text: string) => void;
  onExecute?: () => void;
  onSaveBlockTemplate?: (block: JsonObject) => void | Promise<void>;
}

export type OrchestratedStageComponent = Component<OrchestratedStageProps>;

export interface OrchestratedStageComponentModule {
  default: OrchestratedStageComponent;
}

export interface OrchestratedStageDefinition {
  id: "block" | "orchestrate" | "workflow";
  load(): Promise<OrchestratedStageComponentModule>;
}
