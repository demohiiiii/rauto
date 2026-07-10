import { t, tr } from "../lib/i18n.js";
import { safeString } from "../lib/ui.js";
import { derived, get as getStore, writable } from "svelte/store";

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

const profileListStates = new Map();
const hookListStates = new Map();

export const hookModeOptionsVersion = writable(0);

function updateHookModeOptions() {
  hookModeOptionsVersion.update((version) => version + 1);
}

function normalizeProfileListKey(profileListKey) {
  return normalizeSemanticKey(profileListKey, PROFILE_LIST_KEYS);
}

function profileListStateFor(profileListKey) {
  const key = normalizeProfileListKey(profileListKey);
  if (!profileListStates.has(key)) {
    profileListStates.set(key, writable([]));
  }
  return profileListStates.get(key);
}

export const profileListRowsState = derived(
  PROFILE_LIST_ORDER.map(profileListStateFor),
  (rowsByList) =>
    Object.fromEntries(
      PROFILE_LIST_ORDER.map((listKey, index) => [listKey, rowsByList[index]]),
    ),
);

function setProfileListRows(profileListKey, rows = []) {
  const key = normalizeProfileListKey(profileListKey);
  profileListStateFor(key).set(Array.isArray(rows) ? rows : []);
  if (key === PROFILE_LIST.prompts) {
    updateHookModeOptions();
  }
}

function updateProfileListRows(profileListKey, updater) {
  const key = normalizeProfileListKey(profileListKey);
  profileListStateFor(key).update((rows) => {
    const next = updater(Array.isArray(rows) ? rows : []);
    return Array.isArray(next) ? next : [];
  });
  if (key === PROFILE_LIST.prompts) {
    updateHookModeOptions();
  }
}

function normalizeProfileListRow(kind, profileListRowInput = {}) {
  if (kind === "prompts") {
    const patterns = Array.isArray(profileListRowInput.patterns)
      ? profileListRowInput.patterns
      : [];
    return {
      patterns: patterns.length
        ? patterns.map((patternValue) => safeString(patternValue ?? ""))
        : [""],
      state: safeString(profileListRowInput.state ?? ""),
    };
  }
  if (kind === "sys_prompts") {
    return {
      pattern: safeString(profileListRowInput.pattern ?? ""),
      state: safeString(profileListRowInput.state ?? ""),
      sys_name_group: safeString(profileListRowInput.sys_name_group ?? ""),
    };
  }
  if (kind === "interactions") {
    const patterns = Array.isArray(profileListRowInput.patterns)
      ? profileListRowInput.patterns
      : [];
    return {
      input: safeString(profileListRowInput.input ?? ""),
      is_dynamic: !!profileListRowInput.is_dynamic,
      patterns: patterns.length
        ? patterns.map((patternValue) => safeString(patternValue ?? ""))
        : [""],
      record_input:
        profileListRowInput.record_input === undefined
          ? true
          : !!profileListRowInput.record_input,
      state: safeString(profileListRowInput.state ?? ""),
    };
  }
  if (kind === "transitions") {
    return {
      command: safeString(profileListRowInput.command ?? ""),
      format_sys: !!profileListRowInput.format_sys,
      from: safeString(profileListRowInput.from ?? ""),
      is_exit: !!profileListRowInput.is_exit,
      to: safeString(profileListRowInput.to ?? ""),
    };
  }
  return {};
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
  updateProfileListRows(profileListKey, (rows) =>
    rows.map((existingSimpleValue, currentIndex) =>
      currentIndex === rowIndex
        ? safeString(simpleValue ?? "")
        : existingSimpleValue,
    ),
  );
}

export function patchProfileListRow(profileListKey, rowIndex, patch) {
  updateProfileListRows(profileListKey, (rows) =>
    rows.map((profileListRow, currentIndex) =>
      currentIndex === rowIndex
        ? { ...profileListRow, ...patch }
        : profileListRow,
    ),
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
  updateProfileListRows(profileListKey, (rows) =>
    rows.map((profileListRow, currentIndex) => {
      if (currentIndex !== rowIndex) return profileListRow;
      const patterns = Array.isArray(profileListRow.patterns)
        ? profileListRow.patterns
        : [];
      return {
        ...profileListRow,
        patterns: patterns.map((pattern, currentPatternIndex) =>
          currentPatternIndex === patternIndex
            ? safeString(value ?? "")
            : pattern,
        ),
      };
    }),
  );
}

export function addProfileListPattern(profileListKey, rowIndex) {
  updateProfileListRows(profileListKey, (rows) =>
    rows.map((profileListRow, currentIndex) => {
      if (currentIndex !== rowIndex) return profileListRow;
      const patterns = Array.isArray(profileListRow.patterns)
        ? profileListRow.patterns
        : [];
      return { ...profileListRow, patterns: [...patterns, ""] };
    }),
  );
}

export function removeProfileListPattern(
  profileListKey,
  rowIndex,
  patternIndex,
) {
  updateProfileListRows(profileListKey, (rows) =>
    rows.map((profileListRow, currentIndex) => {
      if (currentIndex !== rowIndex) return profileListRow;
      const patterns = Array.isArray(profileListRow.patterns)
        ? profileListRow.patterns
        : [];
      return {
        ...profileListRow,
        patterns: patterns.filter(
          (_, currentPatternIndex) => currentPatternIndex !== patternIndex,
        ),
      };
    }),
  );
}

function normalizeHookListKey(hookListKey) {
  return normalizeSemanticKey(hookListKey, HOOK_LIST_KEYS);
}

function hookListStateFor(hookListKey) {
  const key = normalizeHookListKey(hookListKey);
  if (!hookListStates.has(key)) {
    hookListStates.set(key, writable([]));
  }
  return hookListStates.get(key);
}

export const hookListRowsState = derived(
  HOOK_LIST_ORDER.map(hookListStateFor),
  (hookRowsByList) =>
    Object.fromEntries(
      HOOK_LIST_ORDER.map((listKey, index) => [listKey, hookRowsByList[index]]),
    ),
);

function setHookListRows(hookListKey, rows = []) {
  hookListStateFor(hookListKey).set(Array.isArray(rows) ? rows : []);
}

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
  const profileKey = normalizeProfileListKey(listKey);
  if (profileListStates.has(profileKey)) {
    setProfileListRows(profileKey, []);
    return;
  }
  const hookKey = normalizeHookListKey(listKey);
  if (hookListStates.has(hookKey)) {
    setHookListRows(hookKey, []);
  }
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
  updateProfileListRows(PROFILE_LIST.interactions, (rows) => [
    ...rows,
    normalizeProfileListRow("interactions", interactionRow),
  ]);
}

export function collectInteractionRows() {
  return getStore(profileListStateFor(PROFILE_LIST.interactions))
    .map((interactionRow) => ({
      input: safeString(interactionRow.input).trim(),
      is_dynamic: !!interactionRow.is_dynamic,
      patterns: (interactionRow.patterns || [])
        .map((patternValue) => safeString(patternValue).trim())
        .filter(Boolean),
      record_input: !!interactionRow.record_input,
      state: safeString(interactionRow.state).trim(),
    }))
    .filter(
      (interactionRow) =>
        interactionRow.state ||
        interactionRow.input ||
        interactionRow.patterns.length > 0,
    );
}

export function addPromptRow(promptRow = { state: "", patterns: [] }) {
  updateProfileListRows(PROFILE_LIST.prompts, (rows) => [
    ...rows,
    normalizeProfileListRow("prompts", promptRow),
  ]);
}

export function collectPromptRows() {
  return getStore(profileListStateFor(PROFILE_LIST.prompts))
    .map((promptRow) => ({
      patterns: (promptRow.patterns || [])
        .map((patternValue) => safeString(patternValue).trim())
        .filter(Boolean),
      state: safeString(promptRow.state).trim(),
    }))
    .filter((promptRow) => promptRow.state || promptRow.patterns.length > 0);
}

export function addSysPromptRow(
  sysPromptRow = { state: "", sys_name_group: "", pattern: "" },
) {
  updateProfileListRows(PROFILE_LIST.sysPrompts, (rows) => [
    ...rows,
    normalizeProfileListRow("sys_prompts", sysPromptRow),
  ]);
}

export function collectSysPromptRows() {
  return getStore(profileListStateFor(PROFILE_LIST.sysPrompts))
    .map((sysPromptRow) => ({
      pattern: safeString(sysPromptRow.pattern).trim(),
      state: safeString(sysPromptRow.state).trim(),
      sys_name_group: safeString(sysPromptRow.sys_name_group).trim(),
    }))
    .filter(
      (sysPromptRow) =>
        sysPromptRow.state ||
        sysPromptRow.sys_name_group ||
        sysPromptRow.pattern,
    );
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
  updateProfileListRows(PROFILE_LIST.transitions, (rows) => [
    ...rows,
    normalizeProfileListRow("transitions", transitionRow),
  ]);
}

export function collectTransitionRows() {
  return getStore(profileListStateFor(PROFILE_LIST.transitions))
    .map((transitionRow) => ({
      command: safeString(transitionRow.command).trim(),
      format_sys: !!transitionRow.format_sys,
      from: safeString(transitionRow.from).trim(),
      is_exit: !!transitionRow.is_exit,
      to: safeString(transitionRow.to).trim(),
    }))
    .filter(
      (transitionRow) =>
        transitionRow.from || transitionRow.command || transitionRow.to,
    );
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
  if (operation.kind === "template") {
    const templateName = safeString(operation.template?.name).trim();
    const defaultMode = safeString(operation.runtime?.default_mode).trim();
    if (templateName && defaultMode) return `${templateName} (${defaultMode})`;
    return templateName || "template";
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
    unsupportedLabel:
      kind === "unsupported" ? hookOperationLabel(operation) : "",
    unsupportedOperation:
      kind === "unsupported" ? JSON.stringify(operation, null, 2) : "",
  };
}

function updateHookListRows(hookListKey, updater) {
  hookListStateFor(hookListKey).update((currentRows) => {
    const nextRows = updater(Array.isArray(currentRows) ? currentRows : []);
    return Array.isArray(nextRows) ? nextRows : [];
  });
}

export function patchHookListRow(hookListKey, rowIndex, patch) {
  updateHookListRows(hookListKey, (currentRows) =>
    currentRows.map((hookRow, currentIndex) =>
      currentIndex === rowIndex ? { ...hookRow, ...patch } : hookRow,
    ),
  );
}

export function patchHookListCommand(hookListKey, rowIndex, patch) {
  updateHookListRows(hookListKey, (currentRows) =>
    currentRows.map((hookRow, currentIndex) =>
      currentIndex === rowIndex
        ? { ...hookRow, command: { ...hookRow.command, ...patch } }
        : hookRow,
    ),
  );
}

export function patchHookListFlow(hookListKey, rowIndex, patch) {
  updateHookListRows(hookListKey, (currentRows) =>
    currentRows.map((hookRow, currentIndex) =>
      currentIndex === rowIndex
        ? { ...hookRow, flow: { ...hookRow.flow, ...patch } }
        : hookRow,
    ),
  );
}

export function patchHookListFlowStep(hookListKey, rowIndex, stepIndex, patch) {
  updateHookListRows(hookListKey, (currentRows) =>
    currentRows.map((hookRow, currentIndex) => {
      if (currentIndex !== rowIndex) return hookRow;
      return {
        ...hookRow,
        flow: {
          ...hookRow.flow,
          steps: hookRow.flow.steps.map((step, currentStepIndex) =>
            currentStepIndex === stepIndex ? { ...step, ...patch } : step,
          ),
        },
      };
    }),
  );
}

export function addHookListFlowStep(
  hookListKey,
  rowIndex,
  command = defaultHookOperation(),
) {
  updateHookListRows(hookListKey, (currentRows) =>
    currentRows.map((hookRow, currentIndex) =>
      currentIndex === rowIndex
        ? {
            ...hookRow,
            flow: {
              ...hookRow.flow,
              steps: [...hookRow.flow.steps, normalizeHookCommandRow(command)],
            },
          }
        : hookRow,
    ),
  );
}

export function removeHookListFlowStep(hookListKey, rowIndex, stepIndex) {
  updateHookListRows(hookListKey, (currentRows) =>
    currentRows.map((hookRow, currentIndex) => {
      if (currentIndex !== rowIndex) return hookRow;
      return {
        ...hookRow,
        flow: {
          ...hookRow.flow,
          steps: hookRow.flow.steps.filter(
            (_, currentStepIndex) => currentStepIndex !== stepIndex,
          ),
        },
      };
    }),
  );
}

export function removeHookListRow(hookListKey, rowIndex) {
  updateHookListRows(hookListKey, (currentRows) =>
    currentRows.filter((_, currentIndex) => currentIndex !== rowIndex),
  );
}

export function changeHookListKind(hookListKey, rowIndex, kind) {
  updateHookListRows(hookListKey, (currentRows) =>
    currentRows.map((hookRow, currentIndex) => {
      if (currentIndex !== rowIndex) return hookRow;
      const nextRow = { ...hookRow, kind };
      if (kind === "flow" && nextRow.flow.steps.length === 0) {
        nextRow.flow = {
          ...nextRow.flow,
          steps: [normalizeHookCommandRow(defaultHookOperation())],
        };
      }
      return nextRow;
    }),
  );
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
  return operation;
}

function hasHookOperationInput(hookRow) {
  if (hookRow.kind === "unsupported") {
    return !!safeString(hookRow.unsupportedOperation).trim();
  }
  if (hookRow.kind === "flow") {
    return (hookRow.flow?.steps || []).some((step) =>
      safeString(step.command).trim(),
    );
  }
  return !!safeString(hookRow.command?.command).trim();
}

function collectHookOperation(hookRow, triggerName, hookName) {
  const hookPath = `${triggerName}/${hookName}`;
  if (
    hookRow.kind === "unsupported" &&
    safeString(hookRow.unsupportedOperation).trim()
  ) {
    return JSON.parse(hookRow.unsupportedOperation);
  }
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
