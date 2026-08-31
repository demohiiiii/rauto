export interface ShowConnectionSummary {
  device_profile?: unknown;
  groups?: unknown;
  labels?: unknown;
  name?: unknown;
  [key: string]: unknown;
}

export interface ShowObjectDefinition {
  object?: unknown;
  [key: string]: unknown;
}

export interface ShowObjectsPayload {
  objects?: ShowObjectDefinition[];
  platform?: string;
  [key: string]: unknown;
}

export interface BatchShowTargetSelection {
  connections?: ShowConnectionSummary[];
  groups?: unknown[];
  labels?: unknown[];
  targets?: unknown[];
}

export interface ShowApi {
  execute(payload: Record<string, unknown>): Promise<Record<string, unknown>>;
  executeBatch(
    payload: Record<string, unknown>,
  ): Promise<Record<string, unknown>>;
  exportExcel(payload: Record<string, unknown>): Promise<{
    blob: Blob;
    filename?: string;
  }>;
  listObjects(payload: Record<string, unknown>): Promise<ShowObjectsPayload>;
}

export type ShowExecutionResult =
  | { kind: "empty" }
  | { kind: "running" }
  | { kind: "error"; message: string }
  | {
      basePayload: Record<string, unknown>;
      kind: "result";
      results: Record<string, unknown>[];
    };

export type BatchShowExecutionResult =
  | { kind: "empty" }
  | { kind: "running" }
  | { kind: "error"; message: string }
  | {
      kind: "result";
      resultPayload: Record<string, unknown>;
    };

export type BatchShowObjectAvailabilityStatus =
  | "empty"
  | "error"
  | "loading"
  | "missing-profile"
  | "no-targets"
  | "ready"
  | "waiting";

export interface BatchShowObjectAvailability {
  connectionCount: number;
  errorMessage?: string;
  missingProfileNames: string[];
  objectCount: number;
  profiles: string[];
  status: BatchShowObjectAvailabilityStatus;
}

export interface ShowCommandPreviewRow {
  commandText: string;
  fields: {
    command: string;
    mapping: string;
    mode: string;
    platform: string;
    source: string;
    textfsm: string;
  };
  objectName: string;
}

export interface ShowStateContext {
  batchShowExecutionResult: Writable<BatchShowExecutionResult>;
  batchShowObjectAvailability: Writable<BatchShowObjectAvailability>;
  batchShowObjectsRequestSeq: number;
  showCommandPreviewRows: Writable<Record<string, ShowCommandPreviewRow[]>>;
  showExecutionResult: Writable<ShowExecutionResult>;
  showFormFieldsState: Map<string, Record<string, unknown>>;
  showObjectPlatformState: Map<string, string>;
  showObjectsRequestSeq: number;
}

export interface SavedConnectionSelectSnapshot {
  connections?: ShowConnectionSummary[];
  options?: unknown[];
  selected?: string;
}

export interface ShowRuntime {
  applyRecording(payload: unknown): void;
  connectionPayload(): Record<string, unknown>;
  connectionTargetState: Readable<Record<string, unknown>>;
  currentExecutionProfile(): unknown;
  ensureConnectionTargetSelected(): boolean;
  executionConnectionProfileState: Readable<string>;
  hidePickerMenu(key: string): void;
  pickerValues(key: string): string[];
  recordLevelPayload(): unknown;
  refreshExecutionModeOptions(): unknown;
  refreshPickerSelected(key: string): void;
  savedConnectionSelectState: Readable<SavedConnectionSelectSnapshot>;
  setCustomObjectsChangedCallback(callback: () => unknown): void;
  setObjectPickerOptions(
    key: string,
    objects: ShowObjectDefinition[],
    selected: string[],
    onRefreshed: () => void,
  ): boolean;
  showObjectOptionMeta(
    pickerKey: string,
    objectName: string,
  ): Record<string, unknown>;
}

export interface ShowModeOptionRow {
  labelText: string;
  valueText: string;
}

export interface ShowPageDisplay {
  batchActive: boolean;
  queryAriaLabel: string;
  singleActive: boolean;
  title: string;
}

export interface ShowObjectSelectionDisplay {
  commandLabel: string;
  mappingLabel: string;
  modeOptionRows: ShowModeOptionRow[];
  modePlaceholder: string;
  objectLabel: string;
  objectPlaceholder: string;
  platformLabel: string;
  previewEmptyText: string;
  previewTitle: string;
  sourceLabel: string;
  textfsmLabel: string;
}
import type { Readable, Writable } from "svelte/store";
