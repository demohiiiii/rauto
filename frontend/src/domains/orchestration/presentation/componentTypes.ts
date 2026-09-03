import type { Component } from "svelte";
import type { JsonTemplateActionContext } from "$domains/transactions/index.js";

export interface OrchestratedStageTextFile {
  text(): Promise<string>;
}

export interface OrchestratedStageProps {
  active?: boolean;
  newButtonLabelKey?: string;
  onCreateJsonTemplateDraft?: (
    actionContext?: JsonTemplateActionContext | null,
  ) => void;
  onEditorInput?: (text: string) => void;
  onExecute?: () => void;
  onImportFile?: (
    file: OrchestratedStageTextFile,
    actionContext?: JsonTemplateActionContext | null,
  ) => void;
  onLoadJsonTemplate?: (
    templateName: string,
    actionContext?: JsonTemplateActionContext | null,
  ) => void;
  onPreview?: () => void;
  onSaveJsonTemplate?: () => void;
}

export type OrchestratedStageComponent = Component<OrchestratedStageProps>;

export interface OrchestratedStageComponentModule {
  default: OrchestratedStageComponent;
}

export interface OrchestratedStageDefinition {
  id: "block" | "orchestrate" | "workflow";
  load(): Promise<OrchestratedStageComponentModule>;
}
