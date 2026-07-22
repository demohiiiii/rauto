import { t, tr } from "../../lib/i18n.js";
import { createKeyedListState } from "../../lib/svelte.js";
import { safeString } from "../../lib/ui.js";
import { get as getStore, writable } from "svelte/store";

export const PROFILE_LIST = Object.freeze({
  errorPatterns: "errorPatterns",
  ignoreErrors: "ignoreErrors",
  interactions: "interactions",
  morePatterns: "morePatterns",
  promptPrefix: "promptPrefix",
  prompts: "prompts",
  sysPrompts: "sysPrompts",
  transitions: "transitions",
});

const PROFILE_LIST_KEYS = new Set(Object.values(PROFILE_LIST));
const PROFILE_LIST_ORDER = Object.freeze(Object.values(PROFILE_LIST));

export const HOOK_LIST = Object.freeze({
  afterConnect: "afterConnect",
  afterEnterState: "afterEnterState",
  beforeDisconnect: "beforeDisconnect",
  beforeExitState: "beforeExitState",
});

const HOOK_LIST_ORDER = Object.freeze(Object.values(HOOK_LIST));
const HOOK_LIST_KEYS = new Set(Object.values(HOOK_LIST));

function normalizeSemanticKey(rawKey, validKeys, fallback = "") {
  const key = safeString(rawKey || "").trim();
  if (!key) return fallback;
  return validKeys.has(key) ? key : fallback || key;
}

const customProfileListSections = Object.freeze(
  [
    "labelMorePatterns|morePatterns|profile-more-list|",
    "labelErrorPatterns|errorPatterns|profile-error-list|",
    "labelIgnoreErrors|ignoreErrors|profile-ignore-list|",
    "labelPromptPrefix|promptPrefix|profile-prompt-prefix-list|",
    "labelPrompts|prompts|prompts-list|prompts",
    "labelSysPrompts|sysPrompts|sys-prompts-list|sys_prompts",
    "labelInteractions|interactions|interactions-list|interactions",
    "labelTransitions|transitions|transitions-list|transitions",
  ].map((sectionDefinition) => {
    const [title, key, persistenceKey, kind] = sectionDefinition.split("|");
    const listKey = PROFILE_LIST[key];
    return { kind, listKey, persistenceKey, title };
  }),
);

function isHookStateList(listKey, sectionKey = "") {
  return (
    listKey === HOOK_LIST.afterEnterState ||
    listKey === HOOK_LIST.beforeExitState ||
    String(sectionKey || "").includes("-state-")
  );
}

const customProfileHookSections = Object.freeze(
  [
    "after_connect|hookAddAfterConnectAria|afterConnect|after_connect hooks|hooks-after-connect-list",
    "before_disconnect|hookAddBeforeDisconnectAria|beforeDisconnect|before_disconnect hooks|hooks-before-disconnect-list",
    "after_enter_state|hookAddAfterEnterStateAria|afterEnterState|after_enter_state hooks|hooks-after-enter-state-list",
    "before_exit_state|hookAddBeforeExitStateAria|beforeExitState|before_exit_state hooks|hooks-before-exit-state-list",
  ].map((hookSectionDefinition) => {
    const [title, buttonLabel, key, listLabel, sectionKey] =
      hookSectionDefinition.split("|");
    return {
      buttonLabel,
      listKey: HOOK_LIST[key],
      listLabel,
      sectionKey,
      title,
    };
  }),
);

export const customProfileListSectionDisplays = () =>
  customProfileListSections.map((profileListSection) => ({
    ...profileListSection,
    addButtonLabel: tr("addInlineBtn", "Add"),
    kind: profileListSection.kind || "simple",
    titleText: tr(profileListSection.title, profileListSection.title),
  }));

function profilePromptModes() {
  const seen = new Set();
  const modes = getStore(profileListStateFor(PROFILE_LIST.prompts))
    .map((promptRow) => safeString(promptRow.state).trim())
    .filter((mode) => {
      if (!mode || seen.has(mode)) return false;
      seen.add(mode);
      return true;
    });
  return modes.length ? modes : ["Enable"];
}

function hookListModeOptions(rows = []) {
  const usedModes = [];
  (Array.isArray(rows) ? rows : []).forEach((hookRow) => {
    if (hookRow.state) usedModes.push(hookRow.state);
    if (hookRow.command?.mode) usedModes.push(hookRow.command.mode);
    (hookRow.flow?.steps || []).forEach((step) => {
      if (step.mode) usedModes.push(step.mode);
    });
  });
  const merged = [...profilePromptModes(), ...usedModes].filter(Boolean);
  return merged.length ? Array.from(new Set(merged)) : ["Enable"];
}

export const customProfileHookSectionDisplays = (hookRowsByList = {}) =>
  customProfileHookSections.map((hookSection) => {
    const hookRows = hookRowsByList[hookSection.listKey] || [];
    return {
      ...hookSection,
      addButtonAriaLabel: tr(hookSection.buttonLabel, hookSection.buttonLabel),
      addButtonLabel: tr("addInlineBtn", "Add"),
      groupAriaLabel: safeString(hookSection.listLabel),
      hookRows,
      modeOptions: hookListModeOptions(hookRows),
      stateList: isHookStateList(hookSection.listKey, hookSection.sectionKey),
      titleText: safeString(hookSection.title),
    };
  });

export const hookModeOptionsVersion = writable(0);

function updateHookModeOptions() {
  hookModeOptionsVersion.update((version) => version + 1);
}

function normalizeProfileListKey(profileListKey) {
  return normalizeSemanticKey(profileListKey, PROFILE_LIST_KEYS);
}

const profileLists = createKeyedListState(PROFILE_LIST_ORDER, {
  normalizeKey: normalizeProfileListKey,
  onChange: (key) => {
    if (key === PROFILE_LIST.prompts) updateHookModeOptions();
  },
});

const profileListStateFor = profileLists.stateFor;
const setProfileListRows = profileLists.set;
const updateProfileListRows = profileLists.update;
export const profileListRowsState = profileLists.rowsState;

const textValue = (value) => safeString(value ?? "");
const trimmedText = (value) => textValue(value).trim();
const normalizePatterns = (patterns) => {
  const values = Array.isArray(patterns) ? patterns : [];
  return values.length ? values.map(textValue) : [""];
};
const collectPatterns = (patterns) =>
  (Array.isArray(patterns) ? patterns : []).map(trimmedText).filter(Boolean);

const profileListRowDefinitions = Object.freeze({
  interactions: {
    collect: (row) => ({
      input: trimmedText(row.input),
      is_dynamic: !!row.is_dynamic,
      patterns: collectPatterns(row.patterns),
      record_input: !!row.record_input,
      state: trimmedText(row.state),
    }),
    hasValue: (row) => row.state || row.input || row.patterns.length > 0,
    normalize: (row) => ({
      input: textValue(row.input),
      is_dynamic: !!row.is_dynamic,
      patterns: normalizePatterns(row.patterns),
      record_input: row.record_input === undefined ? true : !!row.record_input,
      state: textValue(row.state),
    }),
  },
  prompts: {
    collect: (row) => ({
      patterns: collectPatterns(row.patterns),
      state: trimmedText(row.state),
    }),
    hasValue: (row) => row.state || row.patterns.length > 0,
    normalize: (row) => ({
      patterns: normalizePatterns(row.patterns),
      state: textValue(row.state),
    }),
  },
  sys_prompts: {
    collect: (row) => ({
      pattern: trimmedText(row.pattern),
      state: trimmedText(row.state),
      sys_name_group: trimmedText(row.sys_name_group),
    }),
    hasValue: (row) => row.state || row.sys_name_group || row.pattern,
    normalize: (row) => ({
      pattern: textValue(row.pattern),
      state: textValue(row.state),
      sys_name_group: textValue(row.sys_name_group),
    }),
  },
  transitions: {
    collect: (row) => ({
      command: trimmedText(row.command),
      format_sys: !!row.format_sys,
      from: trimmedText(row.from),
      is_exit: !!row.is_exit,
      to: trimmedText(row.to),
    }),
    hasValue: (row) => row.from || row.command || row.to,
    normalize: (row) => ({
      command: textValue(row.command),
      format_sys: !!row.format_sys,
      from: textValue(row.from),
      is_exit: !!row.is_exit,
      to: textValue(row.to),
    }),
  },
});

function normalizeProfileListRow(kind, profileListRowInput = {}) {
  return profileListRowDefinitions[kind]?.normalize(profileListRowInput) || {};
}

function collectProfileListRows(profileListKey, kind) {
  const definition = profileListRowDefinitions[kind];
  return getStore(profileListStateFor(profileListKey))
    .map(definition.collect)
    .filter(definition.hasValue);
}

function updateListRow(rows, rowIndex, updateRow) {
  return rows.map((row, currentIndex) =>
    currentIndex === rowIndex ? updateRow(row) : row,
  );
}

function updateProfileListRow(profileListKey, rowIndex, updateRow) {
  updateProfileListRows(profileListKey, (rows) =>
    updateListRow(rows, rowIndex, updateRow),
  );
}

export function addProfileListItem(profileListKey, kind, profileListItem = {}) {
  if (kind === "simple") {
    updateProfileListRows(profileListKey, (rows) => [
      ...rows,
      safeString(profileListItem ?? ""),
    ]);
    return;
  }
  updateProfileListRows(profileListKey, (rows) => [
    ...rows,
    normalizeProfileListRow(kind, profileListItem),
  ]);
}

export function setProfileListSimpleValue(
  profileListKey,
  rowIndex,
  simpleValue,
) {
  updateProfileListRow(profileListKey, rowIndex, () => textValue(simpleValue));
}

export function patchProfileListRow(profileListKey, rowIndex, patch) {
  updateProfileListRow(profileListKey, rowIndex, (row) => ({
    ...row,
    ...patch,
  }));
}

function updateProfileListPatterns(profileListKey, rowIndex, updatePatterns) {
  updateProfileListRow(profileListKey, rowIndex, (row) => ({
    ...row,
    patterns: updatePatterns(Array.isArray(row.patterns) ? row.patterns : []),
  }));
}

function setListItem(items, itemIndex, value) {
  return items.map((item, currentIndex) =>
    currentIndex === itemIndex ? value : item,
  );
}

export function removeProfileListRow(profileListKey, rowIndex) {
  updateProfileListRows(profileListKey, (rows) =>
    rows.filter((_, currentIndex) => currentIndex !== rowIndex),
  );
}

export function setProfileListPatternState(
  profileListKey,
  kind,
  rowIndex,
  value,
) {
  patchProfileListRow(profileListKey, rowIndex, {
    state: safeString(value ?? ""),
  });
}

export function setProfileListPattern(
  profileListKey,
  rowIndex,
  patternIndex,
  value,
) {
  updateProfileListPatterns(profileListKey, rowIndex, (patterns) =>
    setListItem(patterns, patternIndex, textValue(value)),
  );
}

export function addProfileListPattern(profileListKey, rowIndex) {
  updateProfileListPatterns(profileListKey, rowIndex, (patterns) => [
    ...patterns,
    "",
  ]);
}

function removeListItem(items, itemIndex) {
  return items.filter((_, currentIndex) => currentIndex !== itemIndex);
}

export function removeProfileListPattern(
  profileListKey,
  rowIndex,
  patternIndex,
) {
  updateProfileListPatterns(profileListKey, rowIndex, (patterns) =>
    removeListItem(patterns, patternIndex),
  );
}

function normalizeHookListKey(hookListKey) {
  return normalizeSemanticKey(hookListKey, HOOK_LIST_KEYS);
}

const hookLists = createKeyedListState(HOOK_LIST_ORDER, {
  normalizeKey: normalizeHookListKey,
});

const hookListStateFor = hookLists.stateFor;
const setHookListRows = hookLists.set;
const updateHookListRows = hookLists.update;
export const hookListRowsState = hookLists.rowsState;

export function addSimpleListRow(profileListKey, listText = "") {
  updateProfileListRows(profileListKey, (rows) => [
    ...rows,
    safeString(listText),
  ]);
}

export function collectSimpleList(profileListKey) {
  return getStore(profileListStateFor(profileListKey))
    .map((simpleValue) => safeString(simpleValue).trim())
    .filter(Boolean);
}

export function clearProfileEditorList(listKey) {
  if (profileLists.has(listKey)) {
    setProfileListRows(listKey, []);
    return;
  }
  if (hookLists.has(listKey)) setHookListRows(listKey, []);
}

export function addInteractionRow(
  interactionRow = {
    state: "",
    input: "",
    is_dynamic: false,
    record_input: true,
    patterns: [],
  },
) {
  addProfileListItem(PROFILE_LIST.interactions, "interactions", interactionRow);
}

export function collectInteractionRows() {
  return collectProfileListRows(PROFILE_LIST.interactions, "interactions");
}

export function addPromptRow(promptRow = { state: "", patterns: [] }) {
  addProfileListItem(PROFILE_LIST.prompts, "prompts", promptRow);
}

export function collectPromptRows() {
  return collectProfileListRows(PROFILE_LIST.prompts, "prompts");
}

export function addSysPromptRow(
  sysPromptRow = { state: "", sys_name_group: "", pattern: "" },
) {
  addProfileListItem(PROFILE_LIST.sysPrompts, "sys_prompts", sysPromptRow);
}

export function collectSysPromptRows() {
  return collectProfileListRows(PROFILE_LIST.sysPrompts, "sys_prompts");
}

export function addTransitionRow(
  transitionRow = {
    from: "",
    command: "",
    to: "",
    is_exit: false,
    format_sys: false,
  },
) {
  addProfileListItem(PROFILE_LIST.transitions, "transitions", transitionRow);
}

export function collectTransitionRows() {
  return collectProfileListRows(PROFILE_LIST.transitions, "transitions");
}

export function normalizeHooks(hooks) {
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
    interaction: normalizeHookInteraction(operation.interaction),
    timeout: operation.timeout == null ? 60 : operation.timeout,
  };
}

function normalizeHookPromptRule(prompt = {}) {
  return {
    patterns: (Array.isArray(prompt?.patterns) ? prompt.patterns : []).map(
      (pattern) => safeString(pattern ?? ""),
    ),
    record_input: !!prompt?.record_input,
    response: safeString(prompt?.response ?? ""),
  };
}

function normalizeHookInteraction(interaction = {}) {
  return {
    prompts: (Array.isArray(interaction?.prompts)
      ? interaction.prompts
      : []
    ).map(normalizeHookPromptRule),
  };
}

function normalizeHookCommandRow(operation = {}) {
  const command = normalizeHookCommand(operation);
  return {
    command: safeString(command.command ?? ""),
    interaction: normalizeHookInteraction(command.interaction),
    mode: safeString(command.mode || "Enable"),
    timeout: command.timeout == null ? "" : safeString(command.timeout),
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

function normalizeHookFlowRow(operation = {}) {
  const flow = normalizeHookFlow(operation);
  return {
    max_steps: flow.max_steps == null ? "" : safeString(flow.max_steps),
    steps: flow.steps.map(normalizeHookCommandRow),
    stop_on_error: !!flow.stop_on_error,
  };
}

function hookOperationKindLabel(operation) {
  if (operation.kind === "flow") return "flow";
  return "command";
}

function normalizeHookListRow(hookRowInput = {}, state = "") {
  const operation = hookRowInput.operation || defaultHookOperation();
  const kind = hookOperationKindLabel(operation);
  return {
    command:
      kind === "command"
        ? normalizeHookCommandRow(operation)
        : normalizeHookCommandRow(defaultHookOperation()),
    failure_policy: safeString(hookRowInput.failure_policy || "best_effort"),
    flow:
      kind === "flow"
        ? normalizeHookFlowRow(operation)
        : normalizeHookFlowRow({
            kind: "flow",
            steps: [defaultHookOperation()],
          }),
    kind,
    name: safeString(hookRowInput.name ?? ""),
    record_output: !!hookRowInput.record_output,
    state: safeString(state ?? ""),
  };
}

function updateHookListRow(hookListKey, rowIndex, updateRow) {
  updateHookListRows(hookListKey, (rows) =>
    updateListRow(rows, rowIndex, updateRow),
  );
}

export function patchHookListRow(hookListKey, rowIndex, patch) {
  updateHookListRow(hookListKey, rowIndex, (row) => ({ ...row, ...patch }));
}

function patchHookListRowField(hookListKey, rowIndex, field, patch) {
  updateHookListRow(hookListKey, rowIndex, (row) => ({
    ...row,
    [field]: { ...row[field], ...patch },
  }));
}

export function patchHookListCommand(hookListKey, rowIndex, patch) {
  patchHookListRowField(hookListKey, rowIndex, "command", patch);
}

export function patchHookListFlow(hookListKey, rowIndex, patch) {
  patchHookListRowField(hookListKey, rowIndex, "flow", patch);
}

function updateHookListFlowSteps(hookListKey, rowIndex, updateSteps) {
  updateHookListRow(hookListKey, rowIndex, (row) => ({
    ...row,
    flow: { ...row.flow, steps: updateSteps(row.flow.steps) },
  }));
}

export function patchHookListFlowStep(hookListKey, rowIndex, stepIndex, patch) {
  updateHookListFlowSteps(hookListKey, rowIndex, (steps) =>
    updateListRow(steps, stepIndex, (step) => ({ ...step, ...patch })),
  );
}

export function addHookListFlowStep(
  hookListKey,
  rowIndex,
  command = defaultHookOperation(),
) {
  updateHookListFlowSteps(hookListKey, rowIndex, (steps) => [
    ...steps,
    normalizeHookCommandRow(command),
  ]);
}

export function removeHookListFlowStep(hookListKey, rowIndex, stepIndex) {
  updateHookListFlowSteps(hookListKey, rowIndex, (steps) =>
    removeListItem(steps, stepIndex),
  );
}

export function removeHookListRow(hookListKey, rowIndex) {
  updateHookListRows(hookListKey, (currentRows) =>
    currentRows.filter((_, currentIndex) => currentIndex !== rowIndex),
  );
}

export function changeHookListKind(hookListKey, rowIndex, kind) {
  updateHookListRow(hookListKey, rowIndex, (row) => {
    const normalizedKind = kind === "flow" ? "flow" : "command";
    const nextRow = { ...row, kind: normalizedKind };
    if (normalizedKind === "flow" && nextRow.flow.steps.length === 0) {
      nextRow.flow = {
        ...nextRow.flow,
        steps: [normalizeHookCommandRow(defaultHookOperation())],
      };
    }
    return nextRow;
  });
}

export function addHookListRow(hookListKey, hookEntry = {}, state = "") {
  updateHookListRows(hookListKey, (currentRows) => [
    ...currentRows,
    normalizeHookListRow(hookEntry, state),
  ]);
}

function collectHookCommand(command, triggerName, hookName) {
  const commandValue = safeString(command.command).trim();
  const mode = safeString(command.mode).trim();
  const timeoutRaw = safeString(command.timeout).trim();
  if (!commandValue) {
    throw new Error(`${t("hookCommandRequired")}: ${triggerName}/${hookName}`);
  }
  const operation = {
    command: commandValue,
    mode: mode || "Enable",
  };
  if (timeoutRaw) {
    const timeout = Number(timeoutRaw);
    if (!Number.isFinite(timeout) || timeout <= 0) {
      throw new Error(`${t("hookTimeoutInvalid")}: ${triggerName}/${hookName}`);
    }
    operation.timeout = timeout;
  }
  const promptRows = Array.isArray(command.interaction?.prompts)
    ? command.interaction.prompts
    : [];
  if (promptRows.length > 0) {
    operation.interaction = {
      prompts: promptRows.map((prompt, promptIndex) => {
        const patterns = (
          Array.isArray(prompt?.patterns) ? prompt.patterns : []
        )
          .map((pattern) => safeString(pattern).trim())
          .filter(Boolean);
        if (patterns.length === 0) {
          throw new Error(
            `${t("hookInteractionPatternRequired")}: ${triggerName}/${hookName}/prompt[${promptIndex + 1}]`,
          );
        }
        return {
          patterns,
          record_input: !!prompt?.record_input,
          response: safeString(prompt?.response ?? ""),
        };
      }),
    };
  }
  return operation;
}

function hasHookOperationInput(hookRow) {
  if (hookRow.kind === "flow") {
    return (hookRow.flow?.steps || []).some((step) =>
      safeString(step.command).trim(),
    );
  }
  return !!safeString(hookRow.command?.command).trim();
}

function collectHookOperation(hookRow, triggerName, hookName) {
  const hookPath = `${triggerName}/${hookName}`;
  if (hookRow.kind === "flow") {
    const steps = (hookRow.flow?.steps || []).map((step, index) =>
      collectHookCommand(step, triggerName, `${hookName}[${index + 1}]`),
    );
    if (steps.length === 0) {
      throw new Error(`${t("hookFlowStepRequired")}: ${hookPath}`);
    }
    const flow = {
      kind: "flow",
      steps,
      stop_on_error: !!hookRow.flow?.stop_on_error,
    };
    const maxStepsRaw = safeString(hookRow.flow?.max_steps).trim();
    if (maxStepsRaw) {
      const maxSteps = Number(maxStepsRaw);
      if (!Number.isFinite(maxSteps) || maxSteps <= 0) {
        throw new Error(`${t("hookMaxStepsInvalid")}: ${hookPath}`);
      }
      flow.max_steps = maxSteps;
    }
    return flow;
  }
  return {
    kind: "command",
    ...collectHookCommand(hookRow.command || {}, triggerName, hookName),
  };
}

function collectHook(hookRow, triggerName) {
  const hookName = safeString(hookRow.name).trim();
  if (!hookName && !hasHookOperationInput(hookRow)) return null;
  if (!hookName) {
    throw new Error(t("hookNameRequired"));
  }
  return {
    failure_policy: hookRow.failure_policy || "best_effort",
    name: hookName,
    operation: collectHookOperation(hookRow, triggerName, hookName),
    record_output: !!hookRow.record_output,
  };
}

function collectHookListRows(rows, triggerName) {
  return (Array.isArray(rows) ? rows : [])
    .map((hookRow) => collectHook(hookRow, triggerName))
    .filter(Boolean);
}

function collectStateHookListRows(rows, triggerName) {
  const grouped = {};
  (Array.isArray(rows) ? rows : []).forEach((hookRow) => {
    const state = safeString(hookRow.state).trim();
    const name = safeString(hookRow.name).trim();
    if (!state && !name && !hasHookOperationInput(hookRow)) return;
    if (!state) {
      throw new Error(t("hookStateRequired"));
    }
    if (!name) {
      throw new Error(t("hookNameRequired"));
    }
    if (!grouped[state]) grouped[state] = [];
    grouped[state].push({
      failure_policy: hookRow.failure_policy || "best_effort",
      name,
      operation: collectHookOperation(hookRow, `${triggerName}/${state}`, name),
      record_output: !!hookRow.record_output,
    });
  });
  return grouped;
}

export function collectHookRows(hookListKey, triggerName) {
  return collectHookListRows(
    getStore(hookListStateFor(hookListKey)),
    triggerName,
  );
}

export function collectStateHookRows(hookListKey, triggerName) {
  return collectStateHookListRows(
    getStore(hookListStateFor(hookListKey)),
    triggerName,
  );
}
