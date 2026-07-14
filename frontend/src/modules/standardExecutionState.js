import { get, writable } from "svelte/store";
import { safeString } from "../lib/ui.js";
import { t } from "../lib/i18n.js";
import {
  defaultStandardExecMode,
  normalizeStandardExecMode,
} from "../config/dashboardModes.js";
import {
  executeCommand,
  executeCommandFlow as executeCommandFlowRequest,
  executeTemplate as executeTemplateRequest,
  getTemplate,
  renderTemplate,
} from "../api/client.js";
import {
  buildFlowVarsPayload,
  ensureFlowRunTemplateDetail,
  getCurrentFlowTemplateFieldDraft,
  getLastFlowRunTemplateDetail,
  loadFlowTemplates,
  parseBuiltinFlowTemplateValue,
  setRunFlowTemplateSelectValue,
  setRunTemplateSelectValue,
  updateFlowTemplateVarFields,
} from "./templates.js";
import { applyRecordDrawerRecording, recordLevelPayload } from "./overlays.js";
import { refreshExecutionModeOptionsForCurrentConnection } from "./profiles.js";
import {
  connectionPayload,
  ensureConnectionTargetSelected,
} from "./connections.js";
import { parsedOutputSheetsFromParsedOutputItems } from "./results.js";

export const EMPTY_RESULT = { kind: "empty" };
export const DEFAULT_STANDARD_PAGE_MODE = normalizeStandardExecMode(
  defaultStandardExecMode,
);
export const refreshStandardExecutionModeOptions =
  refreshExecutionModeOptionsForCurrentConnection;

function createStandardStateContext() {
  return {
    commandFlowExecutionResult: writable(EMPTY_RESULT),
    directExecutionResult: writable(EMPTY_RESULT),
    standardFormFieldsState: new Map(),
    templateContentText: writable(""),
    templateExecutionResult: writable(EMPTY_RESULT),
    templatePreviewResult: writable(EMPTY_RESULT),
  };
}

let standardStateContext = null;

function currentStandardStateContext() {
  if (!standardStateContext) {
    standardStateContext = createStandardStateContext();
  }
  return standardStateContext;
}

export const templateContentText =
  currentStandardStateContext().templateContentText;

export function directExecutionResultState() {
  return currentStandardStateContext().directExecutionResult;
}

export function commandFlowExecutionResultState() {
  return currentStandardStateContext().commandFlowExecutionResult;
}

export function templatePreviewResultState() {
  return currentStandardStateContext().templatePreviewResult;
}

export function templateExecutionResultState() {
  return currentStandardStateContext().templateExecutionResult;
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

function standardTemplateNameValue(templateName = "") {
  return String(templateName || "").trim();
}

export function standardTemplateVarsObject(varsValue = {}) {
  if (varsValue && typeof varsValue === "object" && !Array.isArray(varsValue)) {
    return { ...varsValue };
  }
  const raw = safeString(varsValue).trim();
  if (!raw) {
    return {};
  }
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("template vars must be a JSON object");
  }
  return parsed;
}

function standardTemplateVarsText(varsValue = {}) {
  return JSON.stringify(standardTemplateVarsObject(varsValue), null, 2);
}

const setCommandFlowExecutionResult = (executionResult = {}) =>
  currentStandardStateContext().commandFlowExecutionResult.set(
    executionResult || EMPTY_RESULT,
  );
const setTemplatePreviewResult = (previewResult = {}) =>
  currentStandardStateContext().templatePreviewResult.set(
    previewResult || EMPTY_RESULT,
  );
const setTemplateExecutionResult = (executionResult = {}) =>
  currentStandardStateContext().templateExecutionResult.set(
    executionResult || EMPTY_RESULT,
  );

function setSelectedTemplateContentText(content = "") {
  currentStandardStateContext().templateContentText.set(safeString(content));
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

function selectedTemplateContent() {
  const templateForm = standardFormFields("template");
  return (
    safeString(get(currentStandardStateContext().templateContentText)).trim() ||
    safeString(templateForm.templateName || "").trim()
  );
}

function parseVars() {
  const templateForm = standardFormFields("template");
  if (
    templateForm.vars &&
    typeof templateForm.vars === "object" &&
    !Array.isArray(templateForm.vars)
  ) {
    return standardTemplateVarsObject(templateForm.vars);
  }
  return standardTemplateVarsObject(templateForm.varsText ?? "");
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

function directCommandPayload({ connection, recordLevel }) {
  const directForm = standardFormFields("direct");
  return {
    command: safeString(directForm.command ?? "").trim(),
    mode: safeString(directForm.mode ?? "").trim() || null,
    ...textfsmPayload(),
    connection,
    record_level: recordLevel,
  };
}

function templateExecutionPayload({ connection, recordLevel }) {
  const templateForm = standardFormFields("template");
  return {
    template: selectedTemplateContent(),
    vars: parseVars(),
    mode: safeString(templateForm.mode ?? "").trim() || null,
    ...textfsmPayload(),
    connection,
    record_level: recordLevel,
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

function setDirectExecutionResult(executionResult = {}) {
  currentStandardStateContext().directExecutionResult.set(
    executionResult || EMPTY_RESULT,
  );
}

export function setDirectExecutionFields(commandText = "", commandMode = "") {
  setStandardFormFields("direct", { command: commandText, mode: commandMode });
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

export async function executeDirectCommand() {
  if (!ensureConnectionTargetSelected()) {
    return;
  }
  setDirectExecutionResult({ kind: "running" });
  try {
    const connection = connectionPayload();
    const payload = directCommandPayload({
      connection,
      recordLevel: recordLevelPayload(),
    });
    const commandResult = await executeCommand(payload);
    setDirectExecutionResult({
      kind: "result",
      output: safeString(commandResult.output),
      parsedItem: {
        ...commandResult,
        command: payload.command,
        device: connection.connection_name || connection.host,
      },
    });
    applyRecordDrawerRecording(commandResult);
  } catch (error) {
    setDirectExecutionResult({ kind: "error", message: error.message });
  }
}

export async function executeCommandFlow(executionSource = null) {
  if (!ensureConnectionTargetSelected()) {
    return;
  }
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

async function loadFlowTemplateDetail() {
  const flowForm = standardFormFields("flow");
  const name = safeString(flowForm.templateSelection ?? "").trim();
  if (!name) {
    updateFlowTemplateVarFields(null, {});
    return;
  }
  try {
    await ensureFlowRunTemplateDetail(name);
  } catch {
    // The field renderer already displays the error.
  }
}

export async function prepareCommandFlowOnActive() {
  await loadFlowTemplates();
  await loadFlowTemplateDetail();
}

export function refreshCommandFlowLanguageFields() {
  updateFlowTemplateVarFields(
    getLastFlowRunTemplateDetail(),
    getCurrentFlowTemplateFieldDraft(),
  );
}

export function setCommandFlowFields(templateSelection = "") {
  setStandardFormFields("flow", {
    templateSelection,
  });
}

export function selectCommandFlowTemplate(templateName = "") {
  const nextName = safeString(templateName).trim();
  setRunFlowTemplateSelectValue(nextName);
  setCommandFlowFields(nextName);
  void loadFlowTemplateDetail();
}

export async function exportCommandFlowExcel(exportParsedOutputSheetsExcel) {
  await exportParsedOutputSheetsExcel(commandFlowParsedOutputSheets(), {
    filename: "textfsm-flow.xlsx",
  });
}

export async function executeTemplate() {
  if (!ensureConnectionTargetSelected()) {
    return;
  }
  setTemplateExecutionResult({ kind: "running" });
  try {
    const templateResult = await executeTemplateRequest(
      templateExecutionPayload({
        connection: connectionPayload(),
        recordLevel: recordLevelPayload(),
      }),
    );
    setTemplateExecutionResult({
      kind: "result",
      resultPayload: templateResult,
    });
    applyRecordDrawerRecording(templateResult);
  } catch (error) {
    setTemplateExecutionResult({ kind: "error", message: error.message });
  }
}

export async function previewTemplate() {
  setTemplatePreviewResult({ kind: "running" });
  try {
    const renderPayload = await renderTemplate({
      template: selectedTemplateContent(),
      vars: parseVars(),
      connection: connectionPayload(),
    });
    setTemplatePreviewResult({
      kind: "result",
      renderedCommands: renderPayload.rendered_commands || "",
    });
  } catch (error) {
    setTemplatePreviewResult({ kind: "error", message: error.message });
  }
}

export async function loadSelectedTemplateContent() {
  const templateForm = standardFormFields("template");
  const name = standardTemplateNameValue(templateForm.templateName ?? "");
  if (!name) {
    setSelectedTemplateContentText("");
    return;
  }
  try {
    const templatePayload = await getTemplate(name);
    setSelectedTemplateContentText(templatePayload.content || "");
  } catch (error) {
    setSelectedTemplateContentText("");
    setTemplatePreviewResult({ kind: "error", message: error.message });
  }
}

export function setTemplateExecutionFields(
  templateName = "",
  mode = "",
  vars = {},
) {
  const nextVars = standardTemplateVarsObject(vars);
  setStandardFormFields("template", {
    mode,
    templateName,
    vars: nextVars,
    varsText: standardTemplateVarsText(nextVars),
  });
}

export function setStandardRunTemplateSelectValue(templateName = "") {
  setRunTemplateSelectValue(standardTemplateNameValue(templateName));
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
