import { safeString, selectOptionsWithCurrent } from "../lib/ui.js";
import { tr } from "../lib/i18n.js";

export function builtinProfileDetectDetailsPresentation() {
  return {
    detectProfileTitle: tr("labelDetectProfile", "detect_profile"),
    detectProfileEmpty: tr(
      "detectProfileEmpty",
      "No detect_profile configured.",
    ),
    errorPatternsEmpty: tr("detectErrorPatternsEmpty", "No error patterns."),
    errorPatternsTitle: tr("detectErrorPatternsLabel", "Error patterns"),
    initialRulesTitle: tr("detectInitialRulesLabel", "Initial rules"),
    probesEmpty: tr("detectProbesEmpty", "No probes."),
    probesTitle: tr("detectProbesLabel", "Probes"),
    rulesEmpty: tr("detectRulesEmpty", "No rules."),
    rulesTitle: tr("detectRulesLabel", "Rules"),
  };
}

export function builtinProfileHooksDetailsPresentation() {
  return {
    ariaLabelText: tr("builtinHooksAria"),
    recordOutputLabel: tr("fieldHookRecordOutput", "record_output"),
    title: tr("labelHooks", "hooks"),
  };
}

export function builtinProfileStateListsPresentation() {
  return {
    formatSysLabel: tr("fieldFormatSys", "format_sys"),
    interactionsTitle: tr("labelInteractions", "interactions"),
    isDynamicLabel: tr("fieldIsDynamic", "is_dynamic"),
    isExitLabel: tr("fieldIsExit", "is_exit"),
    promptsTitle: tr("labelPrompts", "prompts"),
    recordInputLabel: tr("fieldRecordInput", "record_input"),
    sysPromptsTitle: tr("labelSysPrompts", "sys_prompts"),
    transitionsTitle: tr("labelTransitions", "transitions"),
  };
}

function normalizeCommandExecutionConfig(config) {
  let commandExecution = { marker: "", mode: "prompt_driven" };
  if (config && config !== "prompt_driven") {
    if (typeof config === "string") {
      commandExecution = { marker: "", mode: config };
    } else if (config.shell_exit_status) {
      commandExecution = {
        marker: config.shell_exit_status.marker || "",
        mode: "shell_exit_status",
      };
    }
  }
  return {
    ...commandExecution,
    showShellExitMarker: commandExecution.mode === "shell_exit_status",
  };
}

function profileValues(listRows) {
  return Array.isArray(listRows) ? listRows : [];
}

function profilePatternEditorRows(patterns = []) {
  return profileValues(patterns).map((pattern, patternIndex) => ({
    pattern: safeString(pattern ?? ""),
    patternIndex,
  }));
}

function profileInteractionEditorRow(interactionRow = {}) {
  return {
    input: safeString(interactionRow?.input ?? ""),
    isDynamic: !!interactionRow?.is_dynamic,
    patternRows: profilePatternEditorRows(interactionRow?.patterns),
    recordInput: !!interactionRow?.record_input,
  };
}

function profilePromptPatternEditorRow(promptPatternRow = {}) {
  return {
    patternRows: profilePatternEditorRows(promptPatternRow?.patterns),
    state: safeString(promptPatternRow?.state ?? ""),
  };
}

function profileSysPromptEditorRow(sysPromptRow = {}) {
  return {
    pattern: safeString(sysPromptRow?.pattern ?? ""),
    state: safeString(sysPromptRow?.state ?? ""),
    sys_name_group: safeString(sysPromptRow?.sys_name_group ?? ""),
  };
}

function profileTransitionEditorRow(transitionRow = {}) {
  return {
    command: safeString(transitionRow?.command ?? ""),
    format_sys: !!transitionRow?.format_sys,
    from: safeString(transitionRow?.from ?? ""),
    is_exit: !!transitionRow?.is_exit,
    to: safeString(transitionRow?.to ?? ""),
  };
}

function profileListRowEditorKindPresentation(kind = "simple") {
  const normalizedKind = kind || "simple";
  return {
    editorKind: normalizedKind,
    showInteractionsEditor: normalizedKind === "interactions",
    showPromptsEditor: normalizedKind === "prompts",
    showSimpleEditor: normalizedKind === "simple",
    showSysPromptsEditor: normalizedKind === "sys_prompts",
    showTransitionsEditor: normalizedKind === "transitions",
  };
}

function profileModeOptionRows(modeOptions = [], selectedMode = "") {
  return selectOptionsWithCurrent(modeOptions, selectedMode).map(
    (modeOptionValue) => ({
      labelText: modeOptionValue,
      valueText: modeOptionValue,
    }),
  );
}

function profilePromptPatternsRowEditorDisplay() {
  return {
    addPatternButtonLabel: tr("addPatternInlineBtn", "Add pattern"),
    deleteButtonLabel: tr("deleteInlineBtn", "Delete"),
    statePlaceholder: tr("fieldState", "state"),
  };
}

export function profileListRowEditorPresentation({
  kind = "simple",
  profileListRow = null,
} = {}) {
  return {
    ...profileListRowEditorKindPresentation(kind),
    deleteButtonLabel: tr("deleteInlineBtn", "Delete"),
    interactionEditorDisplay:
      profileInteractionRowEditorPresentation(profileListRow),
    patternPlaceholder: tr("fieldPattern", "pattern"),
    patternListDisplay: profilePatternListEditorDisplay(),
    promptPatternDisplay: profilePromptPatternEditorRow(profileListRow),
    promptPatternEditorDisplay: profilePromptPatternsRowEditorDisplay(),
    statePlaceholder: tr("fieldState", "state"),
    sysPromptDisplay: profileSysPromptEditorRow(profileListRow),
    sysNameGroupPlaceholder: tr("fieldSysNameGroup", "sys name group"),
    transitionEditorDisplay:
      profileTransitionRowEditorPresentation(profileListRow),
  };
}

export function profileInteractionRowEditorPresentation(interactionRow = null) {
  return {
    addPatternButtonLabel: tr("addPatternInlineBtn", "Add pattern"),
    deleteButtonLabel: tr("deleteInlineBtn", "Delete"),
    inputPlaceholder: tr("fieldInput", "input"),
    interactionDisplay: profileInteractionEditorRow(interactionRow),
    isDynamicLabel: tr("fieldIsDynamic", "is dynamic"),
    recordInputLabel: tr("fieldRecordInput", "record input"),
  };
}

export function profileTransitionRowEditorPresentation(transitionRow = null) {
  return {
    commandPlaceholder: tr("fieldCommand", "command"),
    deleteButtonLabel: tr("deleteInlineBtn", "Delete"),
    formatSysLabel: tr("fieldFormatSys", "format sys"),
    fromPlaceholder: tr("fieldFrom", "from"),
    isExitLabel: tr("fieldIsExit", "is exit"),
    toPlaceholder: tr("fieldTo", "to"),
    transitionDisplay: profileTransitionEditorRow(transitionRow),
  };
}

export function profileHookRowEditorDisplay({
  hookRow = {},
  modeOptions = [],
} = {}) {
  const hookDisplay = {
    failurePolicy: safeString(hookRow?.failure_policy || "best_effort"),
    name: safeString(hookRow?.name ?? ""),
    recordOutput: !!hookRow?.record_output,
    state: safeString(hookRow?.state ?? ""),
  };
  return {
    deleteButtonLabel: tr("deleteInlineBtn", "Delete"),
    failurePolicyLabel: tr("fieldHookFailurePolicy", "failure_policy"),
    failurePolicyRows: [
      {
        label: tr("hookFailureBestEffort", "best_effort"),
        value: "best_effort",
      },
      { label: tr("hookFailureRequired", "required"), value: "required" },
    ],
    namePlaceholder: tr("fieldHookName", "hook name"),
    recordOutputLabel: tr("fieldHookRecordOutput", "record output"),
    stateLabel: tr("fieldHookState", "state"),
    hookDisplay,
    stateModeOptionRows: profileModeOptionRows(modeOptions, hookDisplay.state),
  };
}

export function profileHookFlowEditorDisplay(flow = {}) {
  return {
    addButtonLabel: tr("addInlineBtn", "Add"),
    maxSteps: safeString(flow?.max_steps ?? ""),
    maxStepsPlaceholder: tr("fieldHookMaxSteps", "max steps"),
    steps: Array.isArray(flow?.steps) ? flow.steps : [],
    stopOnErrorLabel: tr("fieldHookStopOnError", "stop on error"),
    stopOnError: !!flow?.stop_on_error,
  };
}

function defaultHookOperation() {
  return {
    kind: "command",
    mode: "Enable",
    command: "terminal length 0",
    timeout: 60,
  };
}

function normalizeHookCommand(operation) {
  if (!operation || typeof operation !== "object") {
    return defaultHookOperation();
  }
  return {
    kind: "command",
    mode: operation.mode || "Enable",
    command: operation.command || "",
    timeout: operation.timeout == null ? 60 : operation.timeout,
  };
}

function normalizeHookCommandRow(operation = {}) {
  const command = normalizeHookCommand(operation);
  return {
    command: safeString(command.command ?? ""),
    mode: safeString(command.mode || "Enable"),
    timeout: command.timeout == null ? "" : safeString(command.timeout),
  };
}

export function profileHookFlowStepsEditorDisplay({
  modeOptions = [],
  steps = [],
} = {}) {
  return {
    commandPlaceholder: tr("fieldHookCommand", "command"),
    deleteButtonLabel: tr("deleteInlineBtn", "Delete"),
    hookFlowStepRows: (Array.isArray(steps) ? steps : []).map(
      (hookFlowStepRow, hookFlowStepIndex) => {
        const commandRow = normalizeHookCommandRow(hookFlowStepRow);
        return {
          ...commandRow,
          modeOptionRows: profileModeOptionRows(modeOptions, commandRow.mode),
          stepIndex: hookFlowStepIndex,
        };
      },
    ),
    modeLabel: tr("fieldHookMode", "mode"),
    timeoutPlaceholder: tr("fieldHookTimeout", "timeout"),
  };
}

export function profilePatternListEditorDisplay() {
  return {
    deleteButtonLabel: tr("deleteInlineBtn", "Delete"),
  };
}

export function hookOperationEditorDisplay(
  row = {},
  { modeOptions = [] } = {},
) {
  const kind = row?.kind || "command";
  const commandRow = normalizeHookCommandRow(row?.command);
  const unsupportedLabel = safeString(row?.unsupportedLabel || "");
  const unsupportedOperation = safeString(row?.unsupportedOperation || "");
  return {
    commandDisplay: {
      commandText: commandRow.command,
      mode: commandRow.mode,
      timeoutValue: commandRow.timeout,
    },
    commandPlaceholder: tr("fieldHookCommand", "command"),
    commandModeLabel: tr("fieldHookMode", "mode"),
    commandModeOptionRows: profileModeOptionRows(modeOptions, commandRow.mode),
    flow: row?.flow || {},
    kindLabel: tr("fieldHookOperationKind", "operation kind"),
    kindOptionRows: [
      { label: tr("hookOperationKindCommand", "command"), value: "command" },
      { label: tr("hookOperationKindFlow", "flow"), value: "flow" },
      {
        label: tr("hookOperationKindUnsupported", "unsupported"),
        value: "unsupported",
      },
    ],
    selectedKind: kind,
    showCommandEditor: kind === "command",
    showFlowEditor: kind === "flow",
    showUnsupportedEditor: kind !== "command" && kind !== "flow",
    timeoutPlaceholder: tr("fieldHookTimeout", "timeout"),
    unsupportedDisplay: {
      hasLabel: !!unsupportedLabel,
      labelText: unsupportedLabel,
      operationText: unsupportedOperation,
    },
    unsupportedOperationHint: tr(
      "hookUnsupportedOperationHint",
      "unsupported operation",
    ),
  };
}

export const profileListRowFieldPatches = {
  interactionInput(input = "") {
    return { input };
  },
  interactionIsDynamic(is_dynamic = false) {
    return { is_dynamic };
  },
  interactionRecordInput(record_input = false) {
    return { record_input };
  },
  promptState(state = "") {
    return { state };
  },
  sysPromptPattern(pattern = "") {
    return { pattern };
  },
  sysPromptState(state = "") {
    return { state };
  },
  sysPromptNameGroup(sys_name_group = "") {
    return { sys_name_group };
  },
  transitionCommand(command = "") {
    return { command };
  },
  transitionFormatSys(format_sys = false) {
    return { format_sys };
  },
  transitionFrom(from = "") {
    return { from };
  },
  transitionIsExit(is_exit = false) {
    return { is_exit };
  },
  transitionTo(to = "") {
    return { to };
  },
};

export function profileHookRowStatePatch(state = "") {
  return { state };
}

export function profileHookRowNamePatch(name = "") {
  return { name };
}

export function profileHookRowFailurePolicyPatch(failure_policy = "") {
  return { failure_policy };
}

export function profileHookRowRecordOutputPatch(record_output = false) {
  return { record_output };
}

export function profileHookCommandModePatch(mode = "") {
  return { mode };
}

export function profileHookCommandTextPatch(command = "") {
  return { command };
}

export function profileHookCommandTimeoutPatch(timeout = "") {
  return { timeout };
}

export function profileHookFlowStopOnErrorPatch(stop_on_error = false) {
  return { stop_on_error };
}

export function profileHookFlowMaxStepsPatch(max_steps = "") {
  return { max_steps };
}

export function profileHookFlowStepModePatch(mode = "") {
  return { mode };
}

export function profileHookFlowStepCommandPatch(command = "") {
  return { command };
}

export function profileHookFlowStepTimeoutPatch(timeout = "") {
  return { timeout };
}

function normalizeHooks(hooks) {
  return {
    after_connect: Array.isArray(hooks?.after_connect)
      ? hooks.after_connect
      : [],
    before_disconnect: Array.isArray(hooks?.before_disconnect)
      ? hooks.before_disconnect
      : [],
    after_enter_state:
      hooks?.after_enter_state && typeof hooks.after_enter_state === "object"
        ? hooks.after_enter_state
        : {},
    before_exit_state:
      hooks?.before_exit_state && typeof hooks.before_exit_state === "object"
        ? hooks.before_exit_state
        : {},
  };
}

function normalizeHookFlow(operation) {
  const flow = operation && operation.kind === "flow" ? operation : {};
  const steps = Array.isArray(flow.steps) ? flow.steps : [];
  return {
    kind: "flow",
    steps: steps.length > 0 ? steps : [defaultHookOperation()],
    stop_on_error: !!(flow.stop_on_error ?? true),
    max_steps: flow.max_steps == null ? "" : flow.max_steps,
  };
}

function readonlyStringList(readonlyValues) {
  return Array.isArray(readonlyValues)
    ? readonlyValues.map((readonlyValue) => safeString(readonlyValue ?? ""))
    : [];
}

function readonlyStringRows(readonlyValues) {
  return readonlyStringList(readonlyValues).map((readonlyValue, index) => ({
    index,
    value: readonlyValue,
  }));
}

const readonlyRows = (readonlyValues, mapper) =>
  Array.isArray(readonlyValues) ? readonlyValues.map(mapper) : [];

function readonlyDetectRuleRows(rules) {
  return readonlyRows(rules, (rule) => ({
    pattern: safeString(rule?.pattern ?? ""),
    weight: rule?.weight == null ? "50" : safeString(rule.weight),
  }));
}

function readonlyDetectProfileDisplay(detectProfile) {
  if (!detectProfile) {
    return {
      enabled: false,
      hasInitialRuleRows: false,
      hasProbeRows: false,
      initialRuleRows: [],
      probeRows: [],
    };
  }
  const initialRuleRows = readonlyDetectRuleRows(detectProfile.initial_rules);
  const probeRows = readonlyRows(detectProfile.probes, (probe) => {
    const errorPatterns = readonlyStringList(probe?.error_patterns);
    const ruleRows = readonlyDetectRuleRows(probe?.rules);
    return {
      command: safeString(probe?.command ?? ""),
      errorPatterns,
      hasErrorPatterns: errorPatterns.length > 0,
      hasRuleRows: ruleRows.length > 0,
      ruleRows,
    };
  });
  return {
    enabled: true,
    hasInitialRuleRows: initialRuleRows.length > 0,
    hasProbeRows: probeRows.length > 0,
    initialRuleRows,
    probeRows,
  };
}

function forEachProfileStateHook(stateHooks, visitHookEntry) {
  Object.entries(stateHooks).forEach(([state, hooksForState]) => {
    (Array.isArray(hooksForState) ? hooksForState : []).forEach((hookEntry) =>
      visitHookEntry(state, hookEntry),
    );
  });
}

function hookOperationLabel(operation) {
  if (!operation || typeof operation !== "object") return "";
  if (operation.kind === "command" || operation.command != null) {
    return safeString(operation.command).trim();
  }
  if (operation.kind === "flow") {
    const steps = Array.isArray(operation.steps) ? operation.steps : [];
    const first = safeString(steps[0]?.command).trim();
    if (!steps.length) return "flow";
    if (steps.length === 1) return first || "flow";
    return first
      ? `${first} ... (${steps.length} steps)`
      : `${steps.length} steps`;
  }
  return operation.kind || "";
}

function hookOperationKindLabel(operation) {
  if (!operation || typeof operation !== "object") return "command";
  if (operation.kind === "flow") return "flow";
  if (operation.kind === "command" || operation.command != null) {
    return "command";
  }
  return operation.kind || "unsupported";
}

const BUILTIN_PROFILE_SIMPLE_SECTIONS = Object.freeze(
  [
    "labelMorePatterns|builtin-more-list|more_patterns",
    "labelErrorPatterns|builtin-error-list|error_patterns",
    "labelIgnoreErrors|builtin-ignore-list|ignore_errors",
    "labelPromptPrefix|builtin-prompt-prefix-list|prompt_prefix",
  ].map((simpleSectionDefinition) => {
    const [i18nKey, listId, title] = simpleSectionDefinition.split("|");
    return { i18nKey, listId, title };
  }),
);

export function builtinProfileReadonlyDisplay(profile = {}) {
  const hookRows = readonlyHookRows(profile?.hooks);
  return {
    commandExecution: normalizeCommandExecutionConfig(
      profile?.command_execution,
    ),
    detectProfile: readonlyDetectProfileDisplay(profile?.detect_profile),
    hasHookRows: hookRows.length > 0,
    hookRows,
    interactionRows: readonlyRows(profile?.interactions, (interactionRow) => ({
      input: safeString(interactionRow?.input ?? ""),
      isDynamic: !!interactionRow?.is_dynamic,
      patternRows: readonlyStringRows(interactionRow?.patterns),
      recordInput:
        interactionRow?.record_input === undefined
          ? true
          : !!interactionRow.record_input,
      state: safeString(interactionRow?.state ?? ""),
    })),
    promptRows: readonlyRows(profile?.prompts, (prompt) => ({
      patternRows: readonlyStringRows(prompt?.patterns),
      state: safeString(prompt?.state ?? ""),
    })),
    sysPromptRows: readonlyRows(profile?.sys_prompts, (sysPromptRow) => ({
      pattern: safeString(sysPromptRow?.pattern ?? ""),
      state: safeString(sysPromptRow?.state ?? ""),
      sysNameGroup: safeString(sysPromptRow?.sys_name_group ?? ""),
    })),
    simpleSections: BUILTIN_PROFILE_SIMPLE_SECTIONS.map(
      ({ i18nKey, listId, title }) => ({
        i18nKey,
        listId,
        title,
        values: readonlyStringList(profile?.[title]),
      }),
    ),
    transitionRows: readonlyRows(profile?.transitions, (transitionRow) => ({
      command: safeString(transitionRow?.command ?? ""),
      formatSys: !!transitionRow?.format_sys,
      from: safeString(transitionRow?.from ?? ""),
      isExit: !!transitionRow?.is_exit,
      to: safeString(transitionRow?.to ?? ""),
    })),
  };
}

function readonlyHookRows(hooks) {
  const normalized = normalizeHooks(hooks);
  const rows = [];
  const pushHookRow = (trigger, state, hookEntry = {}) => {
    const operation = hookEntry.operation || defaultHookOperation();
    const command = normalizeHookCommand(operation);
    const kind = hookOperationKindLabel(operation);
    rows.push({
      command: {
        command: safeString(command.command || hookOperationLabel(operation)),
        mode: safeString(command.mode),
        timeout: command.timeout == null ? "" : safeString(command.timeout),
      },
      failurePolicy: safeString(hookEntry.failure_policy || "best_effort"),
      flowSteps: normalizeHookFlow(operation).steps.map(
        (hookStep, hookStepIndex) => ({
          ...normalizeHookCommand(hookStep),
          stepNumberText: `#${hookStepIndex + 1}`,
        }),
      ),
      kind,
      name: safeString(hookEntry.name ?? ""),
      recordOutput: !!hookEntry.record_output,
      showFlowSteps: kind === "flow",
      state: safeString(state ?? ""),
      stateText: safeString(state ?? "") || "-",
      trigger,
    });
  };
  normalized.after_connect.forEach((hookEntry) =>
    pushHookRow("after_connect", "", hookEntry),
  );
  normalized.before_disconnect.forEach((hookEntry) =>
    pushHookRow("before_disconnect", "", hookEntry),
  );
  forEachProfileStateHook(normalized.after_enter_state, (state, hookEntry) =>
    pushHookRow("after_enter_state", state, hookEntry),
  );
  forEachProfileStateHook(normalized.before_exit_state, (state, hookEntry) =>
    pushHookRow("before_exit_state", state, hookEntry),
  );
  return rows;
}

export { profileValues };
