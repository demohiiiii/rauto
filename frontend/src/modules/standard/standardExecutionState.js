import { get, writable } from "svelte/store";
import { safeString } from "../../lib/ui.js";
import { t } from "../../lib/i18n.js";
import {
  defaultStandardExecMode,
  normalizeStandardExecMode,
} from "../../config/dashboardModes.js";
import { executeCommandFlow as executeCommandFlowRequest } from "../../api/client.js";
import {
  buildFlowVarsPayload,
  ensureFlowRunTemplateDetail,
  parseBuiltinFlowTemplateValue,
} from "../templates/templatesFlowRuntimeState.js";
import {
  applyRecordDrawerRecording,
  recordLevelPayload,
} from "../overlays/overlays.js";
import { refreshExecutionModeOptionsForCurrentConnection } from "../profiles/profiles.js";
import {
  connectionPayload,
  ensureConnectionTargetSelected,
} from "../connections/connections.js";
import { parsedOutputSheetsFromParsedOutputItems } from "../operations/results.js";

export const EMPTY_RESULT = { kind: "empty" };
export const DEFAULT_STANDARD_PAGE_MODE = normalizeStandardExecMode(
  defaultStandardExecMode,
);
export const refreshStandardExecutionModeOptions =
  refreshExecutionModeOptionsForCurrentConnection;

function createStandardStateContext() {
  return {
    commandFlowExecutionResult: writable(EMPTY_RESULT),
    standardFormFieldsState: new Map(),
  };
}

let standardStateContext = null;

function currentStandardStateContext() {
  if (!standardStateContext) {
    standardStateContext = createStandardStateContext();
  }
  return standardStateContext;
}

export function commandFlowExecutionResultState() {
  return currentStandardStateContext().commandFlowExecutionResult;
}

export function createStandardLoadingKeysStore(createLoadingRunner) {
  const loadingKeysStore = writable([]);
  const loadingRunner = createLoadingRunner(
    () => get(loadingKeysStore),
    (nextKeys) => loadingKeysStore.set(Array.isArray(nextKeys) ? nextKeys : []),
  );
  return { loadingKeysStore, loadingRunner };
}

export function createStandardTextfsmStateStore() {
  return writable({
    enabled: false,
    strictErrors: false,
    template: "",
  });
}

export function setStandardTextfsmEnabled(textfsmStateStore, enabled = false) {
  textfsmStateStore.update((textfsmState) => ({
    ...textfsmState,
    enabled: !!enabled,
  }));
}

export function setStandardTextfsmStrictErrors(
  textfsmStateStore,
  strictErrors = false,
) {
  textfsmStateStore.update((textfsmState) => ({
    ...textfsmState,
    strictErrors: !!strictErrors,
  }));
}

export function setStandardTextfsmTemplate(textfsmStateStore, template = "") {
  textfsmStateStore.update((textfsmState) => ({
    ...textfsmState,
    template: safeString(template),
  }));
}

function setCommandFlowExecutionResult(executionResult = {}) {
  currentStandardStateContext().commandFlowExecutionResult.set(
    executionResult || EMPTY_RESULT,
  );
}

function setStandardFormFields(key, fields = {}) {
  currentStandardStateContext().standardFormFieldsState.set(
    key,
    fields && typeof fields === "object" && !Array.isArray(fields)
      ? { ...fields }
      : {},
  );
}

function standardFormFields(key) {
  const fields = currentStandardStateContext().standardFormFieldsState.get(key);
  return fields && typeof fields === "object" && !Array.isArray(fields)
    ? fields
    : {};
}

function textfsmPayload() {
  const textfsmForm = standardFormFields("textfsm");
  return {
    textfsm_template:
      safeString(
        textfsmForm.textfsmTemplate ?? textfsmForm.textfsm_template ?? "",
      ).trim() || null,
    parse_textfsm: !!(textfsmForm.parseTextfsm ?? textfsmForm.parse_textfsm),
    textfsm_platform:
      safeString(
        textfsmForm.textfsmPlatform ?? textfsmForm.textfsm_platform ?? "",
      ).trim() || null,
    textfsm_strict_errors: !!(
      textfsmForm.textfsmStrictErrors ?? textfsmForm.textfsm_strict_errors
    ),
  };
}

export function normalizeCommandFlowExecutionSource(source = {}) {
  const kind = source?.kind === "temporary" ? "temporary" : "saved";
  if (kind === "temporary") {
    const content = String(source?.content ?? "");
    if (!content.trim()) {
      throw new Error(t("flowDraftContentRequired"));
    }
    return { content, kind };
  }

  const templateSelection = String(source?.templateSelection ?? "").trim();
  if (!templateSelection) {
    throw new Error(t("flowTemplateNameRequired"));
  }
  return {
    builtinTemplateName: parseBuiltinFlowTemplateValue(templateSelection),
    kind,
    templateSelection,
  };
}

export function commandFlowExecutionPayload({
  connection,
  recordLevel,
  source,
  textfsm = {},
  vars,
}) {
  const normalizedSource = normalizeCommandFlowExecutionSource(source);
  const sourcePayload =
    normalizedSource.kind === "temporary"
      ? { content: normalizedSource.content }
      : {
          template_name: normalizedSource.builtinTemplateName
            ? null
            : normalizedSource.templateSelection,
          builtin_template_name: normalizedSource.builtinTemplateName,
        };
  return {
    ...sourcePayload,
    vars,
    ...textfsm,
    connection,
    record_level: recordLevel,
  };
}

function setStandardTextfsmPayload(nextTextfsmPayload = {}) {
  setStandardFormFields("textfsm", nextTextfsmPayload);
}

export function setStandardTextfsmFields(textfsmFields = {}) {
  setStandardTextfsmPayload({
    parseTextfsm: !!textfsmFields.enabled,
    textfsmPlatform: safeString(textfsmFields.platform),
    textfsmStrictErrors: !!textfsmFields.strictErrors,
    textfsmTemplate: safeString(textfsmFields.template),
  });
}

export async function executeCommandFlow(executionSource = null) {
  if (!ensureConnectionTargetSelected()) return;
  setCommandFlowExecutionResult({ kind: "running" });
  try {
    const flowForm = standardFormFields("flow");
    const source = normalizeCommandFlowExecutionSource(
      executionSource || {
        kind: "saved",
        templateSelection: flowForm.templateSelection,
      },
    );
    if (source.kind === "saved") {
      await ensureFlowRunTemplateDetail(source.templateSelection, {
        silent: true,
      });
    }
    const flowResult = await executeCommandFlowRequest(
      commandFlowExecutionPayload({
        connection: connectionPayload(),
        recordLevel: recordLevelPayload(),
        source,
        textfsm: textfsmPayload(),
        vars: buildFlowVarsPayload(),
      }),
    );
    setCommandFlowExecutionResult({
      kind: "result",
      resultPayload: flowResult,
    });
    applyRecordDrawerRecording(flowResult);
  } catch (error) {
    setCommandFlowExecutionResult({ kind: "error", message: error.message });
  }
}

export async function exportCommandFlowExcel(exportParsedOutputSheetsExcel) {
  await exportParsedOutputSheetsExcel(commandFlowParsedOutputSheets(), {
    filename: "textfsm-flow.xlsx",
  });
}

export function commandFlowParsedOutputSheets(
  flowExecutionResult = get(
    currentStandardStateContext().commandFlowExecutionResult,
  ),
) {
  const resultPayload =
    flowExecutionResult?.kind === "result"
      ? flowExecutionResult.resultPayload
      : null;
  const outputs = Array.isArray(resultPayload?.outputs)
    ? resultPayload.outputs
    : [];
  return parsedOutputSheetsFromParsedOutputItems(outputs, {
    sheetName: (flowOutput, index) =>
      flowOutput.command || `command_${index + 1}`,
  });
}
