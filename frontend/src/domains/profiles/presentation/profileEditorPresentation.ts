import { tr } from "../../../lib/i18n.js";
import { safeString, selectOptionsWithCurrent } from "../../../lib/ui.js";
import {
  normalizeCommandExecutionConfig,
  recordValue,
} from "../model/customProfileForm.js";
import {
  defaultHookOperation,
  normalizeHookCommand,
  normalizeHookFlow,
  normalizeHookInteraction,
  normalizeHooks,
  profileValues,
} from "../model/profileEditor.js";
import type { NormalizedHookInteraction } from "../model/profileEditor.js";
import type { UnknownRecord } from "../model/types.js";

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
    commandKindLabel: tr("hookOperationKindCommand", "command"),
    commandLabel: tr("fieldHookCommand", "command"),
    description: tr(
      "hookEditorDescription",
      "Configure this hook and the operation it runs.",
    ),
    failurePolicyLabel: tr("fieldHookFailurePolicy", "failure_policy"),
    flowKindLabel: tr("hookOperationKindFlow", "flow"),
    flowSettingsTitle: tr("hookFlowSettings", "Flow settings"),
    flowStepsTitle: tr("hookFlowSteps", "Command steps"),
    kindLabel: tr("fieldHookOperationKind", "operation kind"),
    maxStepsLabel: tr("fieldHookMaxSteps", "max steps"),
    modeLabel: tr("fieldHookMode", "mode"),
    nameLabel: tr("fieldHookName", "hook name"),
    interaction: profileHookInteractionEditorDisplay(),
    recordOutputLabel: tr("fieldHookRecordOutput", "record_output"),
    stateLabel: tr("fieldHookState", "state"),
    stepLabel: tr("hookFlowStep", "Step"),
    stopOnErrorLabel: tr("fieldHookStopOnError", "stop on error"),
    timeoutLabel: tr("fieldHookTimeout", "timeout"),
    title: tr("labelHooks", "hooks"),
    triggerLabel: tr("fieldHookTrigger", "trigger"),
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

function profilePatternEditorRows(patterns: unknown) {
  return profileValues(patterns).map((pattern, patternIndex) => ({
    pattern: safeString(pattern ?? ""),
    patternIndex,
  }));
}

function profileInteractionEditorRow(interactionRow: unknown = {}) {
  const row = recordValue(interactionRow);
  return {
    input: safeString(row.input ?? ""),
    isDynamic: !!row.is_dynamic,
    patternRows: profilePatternEditorRows(row.patterns),
    recordInput: !!row.record_input,
    state: safeString(row.state ?? ""),
  };
}

function profilePromptPatternEditorRow(promptPatternRow: unknown = {}) {
  const row = recordValue(promptPatternRow);
  return {
    patternRows: profilePatternEditorRows(row.patterns),
    state: safeString(row.state ?? ""),
  };
}

function profileSysPromptEditorRow(sysPromptRow: unknown = {}) {
  const row = recordValue(sysPromptRow);
  return {
    pattern: safeString(row.pattern ?? ""),
    state: safeString(row.state ?? ""),
    sys_name_group: safeString(row.sys_name_group ?? ""),
  };
}

function profileTransitionEditorRow(transitionRow: unknown = {}) {
  const row = recordValue(transitionRow);
  return {
    command: safeString(row.command ?? ""),
    format_sys: !!row.format_sys,
    from: safeString(row.from ?? ""),
    is_exit: !!row.is_exit,
    to: safeString(row.to ?? ""),
  };
}

function profileListRowEditorKindPresentation(kind: unknown = "simple") {
  const editorKind = safeString(kind || "simple");
  return {
    editorKind,
    showInteractionsEditor: editorKind === "interactions",
    showPromptsEditor: editorKind === "prompts",
    showSimpleEditor: editorKind === "simple",
    showSysPromptsEditor: editorKind === "sys_prompts",
    showTransitionsEditor: editorKind === "transitions",
  };
}

function profileModeOptionRows(
  modeOptions: unknown,
  selectedMode: unknown = "",
) {
  const modes = profileValues(modeOptions).map(safeString);
  return selectOptionsWithCurrent(modes, safeString(selectedMode)).map(
    (modeOptionValue: string) => ({
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
}: { kind?: unknown; profileListRow?: unknown } = {}) {
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

export function profileInteractionRowEditorPresentation(
  interactionRow: unknown = null,
) {
  return {
    addPatternButtonLabel: tr("addPatternInlineBtn", "Add pattern"),
    deleteButtonLabel: tr("deleteInlineBtn", "Delete"),
    inputPlaceholder: tr("fieldInput", "input"),
    interactionDisplay: profileInteractionEditorRow(interactionRow),
    isDynamicLabel: tr("fieldIsDynamic", "is dynamic"),
    recordInputLabel: tr("fieldRecordInput", "record input"),
  };
}

export function profileTransitionRowEditorPresentation(
  transitionRow: unknown = null,
) {
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
}: { hookRow?: unknown; modeOptions?: unknown } = {}) {
  const row = recordValue(hookRow);
  const hookDisplay = {
    failurePolicy: safeString(row.failure_policy || "best_effort"),
    name: safeString(row.name ?? ""),
    recordOutput: !!row.record_output,
    state: safeString(row.state ?? ""),
  };
  return {
    description: tr(
      "hookEditorDescription",
      "Configure this hook and the operation it runs.",
    ),
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

export function profileHookFlowEditorDisplay(flow: unknown = {}) {
  const value = recordValue(flow);
  return {
    addButtonLabel: tr("hookFlowAddStep", "Add step"),
    emptyText: tr("hookFlowEmpty", "Add the first command step to this flow."),
    maxSteps: safeString(value.max_steps ?? ""),
    maxStepsDescription: tr(
      "hookFlowMaxStepsDescription",
      "Optional execution limit for this flow.",
    ),
    maxStepsPlaceholder: tr("fieldHookMaxSteps", "max steps"),
    settingsTitle: tr("hookFlowSettings", "Flow settings"),
    steps: profileValues(value.steps),
    stepsTitle: tr("hookFlowSteps", "Command steps"),
    stopOnErrorDescription: tr(
      "hookFlowStopOnErrorDescription",
      "Stop after the first failed command.",
    ),
    stopOnErrorLabel: tr("fieldHookStopOnError", "stop on error"),
    stopOnError: !!value.stop_on_error,
  };
}

function normalizeHookCommandRow(operation: unknown = {}) {
  const command = normalizeHookCommand(operation);
  return {
    command: safeString(command.command ?? ""),
    interaction: normalizeHookInteraction(command.interaction),
    mode: safeString(command.mode || "Enable"),
    timeout: command.timeout == null ? "" : safeString(command.timeout),
  };
}

export function profileHookInteractionEditorDisplay(interaction: unknown = {}) {
  const normalizedInteraction = normalizeHookInteraction(interaction);
  return {
    addPatternLabel: tr("hookInteractionAddPattern", "Add match"),
    addPromptLabel: tr("hookInteractionAddPrompt", "Add prompt"),
    deletePatternLabel: tr("hookInteractionDeletePattern", "Delete match"),
    deletePromptLabel: tr("hookInteractionDeletePrompt", "Delete prompt"),
    description: tr(
      "hookInteractionDescription",
      "Respond automatically when command output matches a prompt.",
    ),
    emptyText: tr(
      "hookInteractionEmpty",
      "No interactive prompt responses configured.",
    ),
    patternLabel: tr("hookInteractionPattern", "Prompt match"),
    patternPlaceholder: tr(
      "hookInteractionPatternPlaceholder",
      "Regex, for example Password:",
    ),
    promptLabel: tr("hookInteractionPrompt", "Prompt"),
    promptRows: normalizedInteraction.prompts.map((prompt, promptIndex) => ({
      ...prompt,
      patternRows: prompt.patterns.map((pattern, patternIndex) => ({
        pattern,
        patternIndex,
      })),
      promptIndex,
    })),
    recordInputDescription: tr(
      "hookInteractionRecordInputDescription",
      "Keep the matched prompt in captured output.",
    ),
    recordInputLabel: tr("hookInteractionRecordInput", "Record matched input"),
    responseLabel: tr("hookInteractionResponse", "Response"),
    responsePlaceholder: tr(
      "hookInteractionResponsePlaceholder",
      "Raw response; include a trailing newline when required",
    ),
    title: tr("hookInteractionTitle", "Interactive prompts"),
  };
}

export function profileHookFlowStepsEditorDisplay({
  modeOptions = [],
  steps = [],
}: { modeOptions?: unknown; steps?: unknown } = {}) {
  return {
    commandPlaceholder: tr("fieldHookCommand", "command"),
    deleteButtonLabel: tr("deleteInlineBtn", "Delete"),
    hookFlowStepRows: profileValues(steps).map(
      (hookFlowStepRow, hookFlowStepIndex) => {
        const commandRow = normalizeHookCommandRow(hookFlowStepRow);
        return {
          ...commandRow,
          interactionDisplay: profileHookInteractionEditorDisplay(
            commandRow.interaction,
          ),
          modeOptionRows: profileModeOptionRows(modeOptions, commandRow.mode),
          stepIndex: hookFlowStepIndex,
        };
      },
    ),
    modeLabel: tr("fieldHookMode", "mode"),
    stepLabel: tr("hookFlowStep", "Step"),
    timeoutPlaceholder: tr("fieldHookTimeout", "timeout"),
  };
}

export function profilePatternListEditorDisplay() {
  return { deleteButtonLabel: tr("deleteInlineBtn", "Delete") };
}

export function hookOperationEditorDisplay(
  row: unknown = {},
  { modeOptions = [] }: { modeOptions?: unknown } = {},
) {
  const value = recordValue(row);
  const kind = value.kind === "flow" ? "flow" : "command";
  const commandRow = normalizeHookCommandRow(value.command);
  return {
    commandDisplay: {
      commandText: commandRow.command,
      interaction: commandRow.interaction,
      interactionDisplay: profileHookInteractionEditorDisplay(
        commandRow.interaction,
      ),
      mode: commandRow.mode,
      timeoutValue: commandRow.timeout,
    },
    commandPlaceholder: tr("fieldHookCommand", "command"),
    commandModeLabel: tr("fieldHookMode", "mode"),
    commandModeOptionRows: profileModeOptionRows(modeOptions, commandRow.mode),
    commandDescription: tr(
      "hookCommandDescription",
      "Run one command when this hook is triggered.",
    ),
    flow: recordValue(value.flow),
    flowDescription: tr(
      "hookFlowDescription",
      "Run an ordered sequence of commands with individual modes and timeouts.",
    ),
    kindLabel: tr("fieldHookOperationKind", "operation kind"),
    kindOptionRows: [
      { label: tr("hookOperationKindCommand", "command"), value: "command" },
      { label: tr("hookOperationKindFlow", "flow"), value: "flow" },
    ],
    selectedKind: kind,
    showCommandEditor: kind === "command",
    showFlowEditor: kind === "flow",
    timeoutPlaceholder: tr("fieldHookTimeout", "timeout"),
  };
}

function readonlyStringList(readonlyValues: unknown): string[] {
  return profileValues(readonlyValues).map((value) => safeString(value ?? ""));
}

function readonlyStringRows(readonlyValues: unknown) {
  return readonlyStringList(readonlyValues).map((value, index) => ({
    index,
    value,
  }));
}

function readonlyRows<T>(
  readonlyValues: unknown,
  mapper: (row: UnknownRecord, index: number) => T,
): T[] {
  return profileValues(readonlyValues).map((row, index) =>
    mapper(recordValue(row), index),
  );
}

function readonlyDetectRuleRows(rules: unknown) {
  return readonlyRows(rules, (rule) => ({
    pattern: safeString(rule.pattern ?? ""),
    weight: rule.weight == null ? "50" : safeString(rule.weight),
  }));
}

function readonlyDetectProfileDisplay(detectProfile: unknown) {
  if (!detectProfile) {
    return {
      enabled: false,
      hasInitialRuleRows: false,
      hasProbeRows: false,
      initialRuleRows: [],
      probeRows: [],
    };
  }
  const value = recordValue(detectProfile);
  const initialRuleRows = readonlyDetectRuleRows(value.initial_rules);
  const probeRows = readonlyRows(value.probes, (probe) => {
    const errorPatterns = readonlyStringList(probe.error_patterns);
    const ruleRows = readonlyDetectRuleRows(probe.rules);
    return {
      command: safeString(probe.command ?? ""),
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

function forEachProfileStateHook(
  stateHooks: UnknownRecord,
  visitHookEntry: (state: string, hookEntry: UnknownRecord) => void,
): void {
  Object.entries(stateHooks).forEach(([state, hooksForState]) => {
    profileValues(hooksForState).forEach((hookEntry) =>
      visitHookEntry(state, recordValue(hookEntry)),
    );
  });
}

function hookOperationLabel(operation: unknown): string {
  const value = recordValue(operation);
  if (value.kind === "command" || value.command != null)
    return safeString(value.command).trim();
  if (value.kind === "flow") {
    const steps = profileValues(value.steps);
    const first = safeString(recordValue(steps[0]).command).trim();
    if (!steps.length) return "flow";
    if (steps.length === 1) return first || "flow";
    return first
      ? `${first} ... (${steps.length} steps)`
      : `${steps.length} steps`;
  }
  return safeString(value.kind || "");
}

function hookOperationKindLabel(operation: unknown): string {
  const value = recordValue(operation);
  if (value.kind === "flow") return "flow";
  if (value.kind === "command" || value.command != null) return "command";
  return safeString(value.kind || "unsupported");
}

const BUILTIN_PROFILE_SIMPLE_SECTIONS = Object.freeze(
  [
    "labelMorePatterns|builtin-more-list|more_patterns",
    "labelErrorPatterns|builtin-error-list|error_patterns",
    "labelIgnoreErrors|builtin-ignore-list|ignore_errors",
    "labelPromptPrefix|builtin-prompt-prefix-list|prompt_prefix",
  ].map((definition) => {
    const [i18nKey, listId, title] = definition.split("|");
    return { i18nKey, listId, title };
  }),
);

export function builtinProfileReadonlyDisplay(profile: unknown = {}) {
  const value = recordValue(profile);
  const hookRows = readonlyHookRows(value.hooks);
  return {
    commandExecution: normalizeCommandExecutionConfig(value.command_execution),
    detectProfile: readonlyDetectProfileDisplay(value.detect_profile),
    hasHookRows: hookRows.length > 0,
    hookRows,
    interactionRows: readonlyRows(value.interactions, (row) => ({
      input: safeString(row.input ?? ""),
      isDynamic: !!row.is_dynamic,
      patternRows: readonlyStringRows(row.patterns),
      recordInput: row.record_input === undefined ? true : !!row.record_input,
      state: safeString(row.state ?? ""),
    })),
    promptRows: readonlyRows(value.prompts, (row) => ({
      patternRows: readonlyStringRows(row.patterns),
      state: safeString(row.state ?? ""),
    })),
    sysPromptRows: readonlyRows(value.sys_prompts, (row) => ({
      pattern: safeString(row.pattern ?? ""),
      state: safeString(row.state ?? ""),
      sysNameGroup: safeString(row.sys_name_group ?? ""),
    })),
    simpleSections: BUILTIN_PROFILE_SIMPLE_SECTIONS.map(
      ({ i18nKey, listId, title }) => ({
        i18nKey,
        listId,
        title,
        values: readonlyStringList(value[title]),
      }),
    ),
    transitionRows: readonlyRows(value.transitions, (row) => ({
      command: safeString(row.command ?? ""),
      formatSys: !!row.format_sys,
      from: safeString(row.from ?? ""),
      isExit: !!row.is_exit,
      to: safeString(row.to ?? ""),
    })),
  };
}

function readonlyHookRows(hooks: unknown) {
  const normalized = normalizeHooks(hooks);
  const rows: Array<{
    command: {
      command: string;
      interaction: NormalizedHookInteraction;
      interactionDisplay: ReturnType<
        typeof profileHookInteractionEditorDisplay
      >;
      mode: string;
      timeout: string;
    };
    failurePolicy: string;
    flowMaxSteps: string;
    flowSteps: Array<{
      command: string;
      interaction: NormalizedHookInteraction;
      interactionDisplay: ReturnType<
        typeof profileHookInteractionEditorDisplay
      >;
      mode: string;
      stepIndex: number;
      stepNumberText: string;
      timeout: string;
    }>;
    flowStopOnError: boolean;
    kind: string;
    name: string;
    recordOutput: boolean;
    showFlowSteps: boolean;
    state: string;
    stateText: string;
    trigger: string;
  }> = [];
  const pushHookRow = (
    trigger: string,
    state: string,
    hookEntryValue: unknown = {},
  ) => {
    const hookEntry = recordValue(hookEntryValue);
    const operation = hookEntry.operation || defaultHookOperation();
    const command = normalizeHookCommand(operation);
    const flow = normalizeHookFlow(operation);
    const kind = hookOperationKindLabel(operation);
    rows.push({
      command: {
        command: safeString(command.command || hookOperationLabel(operation)),
        interaction: normalizeHookInteraction(command.interaction),
        interactionDisplay: profileHookInteractionEditorDisplay(
          command.interaction,
        ),
        mode: safeString(command.mode),
        timeout: command.timeout == null ? "" : safeString(command.timeout),
      },
      failurePolicy: safeString(hookEntry.failure_policy || "best_effort"),
      flowMaxSteps:
        flow.max_steps == null || flow.max_steps === ""
          ? "-"
          : safeString(flow.max_steps),
      flowSteps: flow.steps.map((hookStep, hookStepIndex) => {
        const step = recordValue(hookStep);
        const commandStep = normalizeHookCommand(step);
        return {
          command: safeString(commandStep.command ?? ""),
          interaction: normalizeHookInteraction(step.interaction),
          interactionDisplay: profileHookInteractionEditorDisplay(
            step.interaction,
          ),
          mode: safeString(commandStep.mode ?? ""),
          stepIndex: hookStepIndex,
          stepNumberText: `#${hookStepIndex + 1}`,
          timeout: safeString(commandStep.timeout ?? ""),
        };
      }),
      flowStopOnError: flow.stop_on_error,
      kind,
      name: safeString(hookEntry.name ?? ""),
      recordOutput: !!hookEntry.record_output,
      showFlowSteps: kind === "flow",
      state: safeString(state),
      stateText: safeString(state) || "-",
      trigger,
    });
  };
  normalized.after_connect.forEach((entry) =>
    pushHookRow("after_connect", "", entry),
  );
  normalized.before_disconnect.forEach((entry) =>
    pushHookRow("before_disconnect", "", entry),
  );
  forEachProfileStateHook(normalized.after_enter_state, (state, entry) =>
    pushHookRow("after_enter_state", state, entry),
  );
  forEachProfileStateHook(normalized.before_exit_state, (state, entry) =>
    pushHookRow("before_exit_state", state, entry),
  );
  return rows;
}
