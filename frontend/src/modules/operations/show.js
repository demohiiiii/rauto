import {
  createBatchShowInputPanelWorkspace as createBatchShowInputPanelWorkspaceState,
  createBatchShowResultsPanelWorkspace as createBatchShowResultsPanelWorkspaceState,
  createShowPageWorkspace as createShowPageWorkspaceState,
  createSingleShowPanelWorkspace as createSingleShowPanelWorkspaceState,
  exportShowParsedOutputItemExcel,
  showConnectionTargetState,
  showExecutionConnectionProfileState,
} from "./showQueryWorkspaces.js";

export {
  exportShowParsedOutputItemExcel,
  showConnectionTargetState,
  showExecutionConnectionProfileState,
} from "./showQueryWorkspaces.js";

export function createShowPageWorkspace(options = {}) {
  return createShowPageWorkspaceState(options);
}

export function createSingleShowPanelWorkspace() {
  return createSingleShowPanelWorkspaceState();
}

export function createBatchShowInputPanelWorkspace() {
  return createBatchShowInputPanelWorkspaceState();
}

export function createBatchShowResultsPanelWorkspace() {
  return createBatchShowResultsPanelWorkspaceState();
}
