import {
  createDirectExecutionPanelWorkspace as createDirectExecutionPanelWorkspaceState,
  createFlowExecutionPanelWorkspace as createFlowExecutionPanelWorkspaceState,
  createStandardPageWorkspace as createStandardPageWorkspaceState,
  createTemplateExecutionPanelWorkspace as createTemplateExecutionPanelWorkspaceState,
  createTemplateExecutionResultsPanelWorkspace as createTemplateExecutionResultsPanelWorkspaceState,
  executeCommandFlow as executeCommandFlowRequest,
  executeTemplate as executeTemplateRequest,
  exportStandardParsedOutputItemExcel,
  templateContentText,
} from "./standardExecutions.js";

export {
  exportStandardParsedOutputItemExcel,
  templateContentText,
} from "./standardExecutions.js";

export {
  standardFlowVarsFieldState,
  standardFlowVarsPresentation,
  standardRunFlowTemplateSelectState,
  standardRunTemplateSelectState,
  setStandardFlowVarDraftValue,
  setStandardFlowVarsJsonOverridesText,
} from "./standardExecutions.js";

export {
  standardExecutionConnectionProfileState,
  STANDARD_MODE_SELECT,
  refreshStandardExecutionModeOptions,
  standardModeSelection,
  STANDARD_TEXTFSM_PLATFORM_SELECT,
  standardTextfsmPlatformSelection,
} from "./standardExecutions.js";

export function createStandardPageWorkspace() {
  return createStandardPageWorkspaceState();
}

export function createTemplateExecutionPanelWorkspace() {
  return createTemplateExecutionPanelWorkspaceState();
}

export function createDirectExecutionPanelWorkspace() {
  return createDirectExecutionPanelWorkspaceState();
}

export function createFlowExecutionPanelWorkspace() {
  return createFlowExecutionPanelWorkspaceState();
}

export function createTemplateExecutionResultsPanelWorkspace() {
  return createTemplateExecutionResultsPanelWorkspaceState();
}

export async function executeCommandFlow() {
  return executeCommandFlowRequest();
}

export async function executeTemplate() {
  return executeTemplateRequest();
}
