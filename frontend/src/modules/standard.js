import {
  createFlowExecutionPanelWorkspace as createFlowExecutionPanelWorkspaceState,
  createStandardPageWorkspace as createStandardPageWorkspaceState,
} from "./standardExecutionWorkspaces.js";

export { exportStandardParsedOutputItemExcel } from "./standardExecutionWorkspaces.js";
export { createStandardCommandExecutionWorkspace } from "./standardCommandExecutionWorkspace.js";

export {
  standardFlowVarsFieldState,
  standardFlowVarsPresentation,
  standardRunFlowTemplateSelectState,
  setStandardFlowVarDraftValue,
} from "./standardExecutionWorkspaces.js";

export {
  standardExecutionConnectionProfileState,
  STANDARD_MODE_SELECT,
  refreshStandardExecutionModeOptions,
  standardModeSelection,
  STANDARD_TEXTFSM_PLATFORM_SELECT,
  standardTextfsmPlatformSelection,
} from "./standardExecutionWorkspaces.js";

export function createStandardPageWorkspace() {
  return createStandardPageWorkspaceState();
}

export function createFlowExecutionPanelWorkspace() {
  return createFlowExecutionPanelWorkspaceState();
}
