import { t, tr } from "../../../lib/i18n.js";
import { createKeyedListState } from "../../../lib/svelte.js";
import { safeString } from "../../../lib/ui.js";
import { get as getStore, writable } from "svelte/store";
import type {
  ProfileCommandInteraction,
  ProfileCommandConfig,
  ProfileHookAction,
  ProfileHookCommand,
  ProfileHookCommandDraft,
  ProfileHookCommandPatch,
  ProfileHookFlow,
  ProfileHookFlowDraft,
  ProfileHookFlowPatch,
  ProfileHookKind,
  ProfileHookRowDraft,
  ProfileHookRowPatch,
  ProfileInteractionConfig,
  ProfileListKind,
  ProfileListRowPatch,
  ProfilePromptConfig,
  ProfilePromptResponseRule,
  ProfileSysPromptConfig,
  ProfileTransitionConfig,
} from "../model/types.js";

type DynamicRow = Record<string, unknown>;
interface ProfileEditorRow {
  command?: string;
  format_sys?: boolean;
  from?: string;
  input?: string;
  is_dynamic?: boolean;
  is_exit?: boolean;
  pattern?: string;
  patterns?: string[];
  record_input?: boolean;
  state?: string;
  sys_name_group?: string;
  to?: string;
}

type ProfileListRow = string | ProfileEditorRow;

interface ProfileListRowDefinition {
  collect(row: ProfileEditorRow): ProfileEditorRow;
  hasValue(row: ProfileEditorRow): boolean;
  normalize(row: ProfileEditorRow): ProfileEditorRow;
}

function profileEditorRow(value: unknown): ProfileEditorRow {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as ProfileEditorRow)
    : {};
}

function dynamicRow(value: unknown): DynamicRow {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as DynamicRow)
    : {};
}

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

function normalizeSemanticKey(
  rawKey: unknown,
  validKeys: ReadonlySet<string>,
  fallback = "",
): string {
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
    const listKey = (PROFILE_LIST as Record<string, string>)[key];
    return { kind, listKey, persistenceKey, title };
  }),
);

function profileListKind(kind: string): ProfileListKind {
  if (
    kind === "interactions" ||
    kind === "prompts" ||
    kind === "sys_prompts" ||
    kind === "transitions"
  ) {
    return kind;
  }
  return "simple";
}

function isHookStateList(listKey: string, sectionKey = ""): boolean {
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
      listKey: (HOOK_LIST as Record<string, string>)[key],
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
    kind: profileListKind(profileListSection.kind),
    titleText: tr(profileListSection.title, profileListSection.title),
  }));

function profilePromptModes(): string[] {
  const seen = new Set<string>();
  const modes = getStore(profileListStateFor(PROFILE_LIST.prompts))
    .map((promptRow) => safeString(profileEditorRow(promptRow).state).trim())
    .filter((mode) => {
      if (!mode || seen.has(mode)) return false;
      seen.add(mode);
      return true;
    });
  return modes.length ? modes : ["Enable"];
}

function hookListModeOptions(rows: ProfileHookRowDraft[] = []): string[] {
  const usedModes: string[] = [];
  rows.forEach((hookRow) => {
    const state = safeString(hookRow.state).trim();
    const commandMode = hookRow.command.mode.trim();
    if (state) usedModes.push(state);
    if (commandMode) usedModes.push(commandMode);
    hookRow.flow.steps.forEach((step) => {
      const mode = step.mode.trim();
      if (mode) usedModes.push(mode);
    });
  });
  const merged = [...profilePromptModes(), ...usedModes].filter(Boolean);
  return merged.length ? Array.from(new Set(merged)) : ["Enable"];
}

export const customProfileHookSectionDisplays = (
  hookRowsByList: Record<string, ProfileHookRowDraft[]> = {},
) =>
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

function updateHookModeOptions(): void {
  hookModeOptionsVersion.update((version) => version + 1);
}

function normalizeProfileListKey(profileListKey: unknown): string {
  return normalizeSemanticKey(profileListKey, PROFILE_LIST_KEYS);
}

const profileLists = createKeyedListState<ProfileListRow>(PROFILE_LIST_ORDER, {
  normalizeKey: normalizeProfileListKey,
  onChange: (key: string) => {
    if (key === PROFILE_LIST.prompts) updateHookModeOptions();
  },
});

const profileListStateFor = profileLists.stateFor;
const setProfileListRows = profileLists.set;
const updateProfileListRows = profileLists.update;
export const profileListRowsState = profileLists.rowsState;

const textValue = (value: unknown): string => safeString(value ?? "");
const trimmedText = (value: unknown): string => textValue(value).trim();
const normalizePatterns = (patterns: unknown): string[] => {
  const values = Array.isArray(patterns) ? patterns : [];
  return values.length ? values.map(textValue) : [""];
};
const collectPatterns = (patterns: unknown): string[] =>
  (Array.isArray(patterns) ? patterns : []).map(trimmedText).filter(Boolean);

const profileListRowDefinitions: Readonly<
  Record<string, ProfileListRowDefinition>
> = Object.freeze({
  interactions: {
    collect: (row) => ({
      input: trimmedText(row.input),
      is_dynamic: !!row.is_dynamic,
      patterns: collectPatterns(row.patterns),
      record_input: !!row.record_input,
      state: trimmedText(row.state),
    }),
    hasValue: (row) =>
      Boolean(row.state || row.input || collectPatterns(row.patterns).length),
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
    hasValue: (row) =>
      Boolean(row.state || collectPatterns(row.patterns).length),
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
    hasValue: (row) => Boolean(row.state || row.sys_name_group || row.pattern),
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
    hasValue: (row) => Boolean(row.from || row.command || row.to),
    normalize: (row) => ({
      command: textValue(row.command),
      format_sys: !!row.format_sys,
      from: textValue(row.from),
      is_exit: !!row.is_exit,
      to: textValue(row.to),
    }),
  },
});

function normalizeProfileListRow(
  kind: ProfileListKind,
  profileListRowInput: ProfileListRow | ProfileListRowPatch = {},
): ProfileEditorRow {
  return (
    profileListRowDefinitions[safeString(kind)]?.normalize(
      profileEditorRow(profileListRowInput),
    ) || {}
  );
}

function collectProfileListRows(
  profileListKey: string,
  kind: string,
): ProfileEditorRow[] {
  const definition = profileListRowDefinitions[kind];
  return getStore(profileListStateFor(profileListKey))
    .map((row) => definition.collect(profileEditorRow(row)))
    .filter(definition.hasValue);
}

function updateListRow<T>(
  rows: T[],
  rowIndex: number,
  updateRow: (row: T) => T,
): T[] {
  return rows.map((row, currentIndex) =>
    currentIndex === rowIndex ? updateRow(row) : row,
  );
}

function updateProfileListRow(
  profileListKey: string,
  rowIndex: number,
  updateRow: (row: ProfileEditorRow) => ProfileEditorRow,
): void {
  updateProfileListRows(profileListKey, (rows) =>
    updateListRow(rows, rowIndex, (row) => updateRow(profileEditorRow(row))),
  );
}

export function addProfileListItem(
  profileListKey: string,
  kind: ProfileListKind,
  profileListItem: ProfileListRow | ProfileListRowPatch = "",
): void {
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
  profileListKey: string,
  rowIndex: number,
  simpleValue: string,
): void {
  updateProfileListRows(profileListKey, (rows) =>
    updateListRow(rows, rowIndex, () => textValue(simpleValue)),
  );
}

export function patchProfileListRow(
  profileListKey: string,
  rowIndex: number,
  patch: ProfileListRowPatch,
): void {
  updateProfileListRow(profileListKey, rowIndex, (row) => ({
    ...row,
    ...patch,
  }));
}

function updateProfileListPatterns(
  profileListKey: string,
  rowIndex: number,
  updatePatterns: (patterns: string[]) => string[],
): void {
  updateProfileListRow(profileListKey, rowIndex, (row) => ({
    ...row,
    patterns: updatePatterns(Array.isArray(row.patterns) ? row.patterns : []),
  }));
}

function setListItem<T>(items: T[], itemIndex: number, value: T): T[] {
  return items.map((item, currentIndex) =>
    currentIndex === itemIndex ? value : item,
  );
}

export function removeProfileListRow(
  profileListKey: string,
  rowIndex: number,
): void {
  updateProfileListRows(profileListKey, (rows) =>
    rows.filter((_, currentIndex) => currentIndex !== rowIndex),
  );
}

export function setProfileListPatternState(
  profileListKey: string,
  _kind: ProfileListKind,
  rowIndex: number,
  value: string,
): void {
  patchProfileListRow(profileListKey, rowIndex, {
    state: safeString(value ?? ""),
  });
}

export function setProfileListPattern(
  profileListKey: string,
  rowIndex: number,
  patternIndex: number,
  value: string,
): void {
  updateProfileListPatterns(profileListKey, rowIndex, (patterns) =>
    setListItem(patterns, patternIndex, textValue(value)),
  );
}

export function addProfileListPattern(
  profileListKey: string,
  rowIndex: number,
): void {
  updateProfileListPatterns(profileListKey, rowIndex, (patterns) => [
    ...patterns,
    "",
  ]);
}

function removeListItem<T>(items: T[], itemIndex: number): T[] {
  return items.filter((_, currentIndex) => currentIndex !== itemIndex);
}

export function removeProfileListPattern(
  profileListKey: string,
  rowIndex: number,
  patternIndex: number,
): void {
  updateProfileListPatterns(profileListKey, rowIndex, (patterns) =>
    removeListItem(patterns, patternIndex),
  );
}

function normalizeHookListKey(hookListKey: unknown): string {
  return normalizeSemanticKey(hookListKey, HOOK_LIST_KEYS);
}

const hookLists = createKeyedListState<ProfileHookRowDraft>(HOOK_LIST_ORDER, {
  normalizeKey: normalizeHookListKey,
});

const hookListStateFor = hookLists.stateFor;
const setHookListRows = hookLists.set;
const updateHookListRows = hookLists.update;
export const hookListRowsState = hookLists.rowsState;

export function addSimpleListRow(profileListKey: string, listText = ""): void {
  updateProfileListRows(profileListKey, (rows) => [
    ...rows,
    safeString(listText),
  ]);
}

export function collectSimpleList(profileListKey: string): string[] {
  return getStore(profileListStateFor(profileListKey))
    .map((simpleValue) => safeString(simpleValue).trim())
    .filter(Boolean);
}

export function clearProfileEditorList(listKey: string): void {
  if (profileLists.has(listKey)) {
    setProfileListRows(listKey, []);
    return;
  }
  if (hookLists.has(listKey)) setHookListRows(listKey, []);
}

export function addInteractionRow(
  interactionRow: Partial<ProfileInteractionConfig> = {
    state: "",
    input: "",
    is_dynamic: false,
    record_input: true,
    patterns: [],
  },
): void {
  addProfileListItem(PROFILE_LIST.interactions, "interactions", interactionRow);
}

export function collectInteractionRows(): ProfileInteractionConfig[] {
  return collectProfileListRows(PROFILE_LIST.interactions, "interactions").map(
    (row) => ({
      input: row.input || "",
      is_dynamic: row.is_dynamic || false,
      patterns: row.patterns || [],
      record_input: row.record_input ?? true,
      state: row.state || "",
    }),
  );
}

export function addPromptRow(
  promptRow: Partial<ProfilePromptConfig> = { state: "", patterns: [] },
): void {
  addProfileListItem(PROFILE_LIST.prompts, "prompts", promptRow);
}

export function collectPromptRows(): ProfilePromptConfig[] {
  return collectProfileListRows(PROFILE_LIST.prompts, "prompts").map((row) => ({
    patterns: row.patterns || [],
    state: row.state || "",
  }));
}

export function addSysPromptRow(
  sysPromptRow: Partial<ProfileSysPromptConfig> = {
    state: "",
    sys_name_group: "",
    pattern: "",
  },
): void {
  addProfileListItem(PROFILE_LIST.sysPrompts, "sys_prompts", sysPromptRow);
}

export function collectSysPromptRows(): ProfileSysPromptConfig[] {
  return collectProfileListRows(PROFILE_LIST.sysPrompts, "sys_prompts").map(
    (row) => ({
      pattern: row.pattern || "",
      state: row.state || "",
      sys_name_group: row.sys_name_group || "",
    }),
  );
}

export function addTransitionRow(
  transitionRow: Partial<ProfileTransitionConfig> = {
    from: "",
    command: "",
    to: "",
    is_exit: false,
    format_sys: false,
  },
): void {
  addProfileListItem(PROFILE_LIST.transitions, "transitions", transitionRow);
}

export function collectTransitionRows(): ProfileTransitionConfig[] {
  return collectProfileListRows(PROFILE_LIST.transitions, "transitions").map(
    (row) => ({
      command: row.command || "",
      format_sys: row.format_sys || false,
      from: row.from || "",
      is_exit: row.is_exit || false,
      to: row.to || "",
    }),
  );
}

function defaultHookOperation(): ProfileHookCommand {
  return {
    kind: "command",
    mode: "Enable",
    command: "terminal length 0",
    timeout: 60,
  };
}

function normalizeHookPromptRule(
  prompt: unknown = {},
): ProfilePromptResponseRule {
  const promptRecord = dynamicRow(prompt);
  return {
    patterns: (Array.isArray(promptRecord.patterns)
      ? promptRecord.patterns
      : []
    ).map((pattern) => safeString(pattern ?? "")),
    record_input: !!promptRecord.record_input,
    response: safeString(promptRecord.response ?? ""),
  };
}

function normalizeHookInteraction(
  interaction: unknown = {},
): ProfileCommandInteraction {
  const interactionRecord = dynamicRow(interaction);
  return {
    prompts: (Array.isArray(interactionRecord.prompts)
      ? interactionRecord.prompts
      : []
    ).map(normalizeHookPromptRule),
  };
}

function normalizeHookCommandRow(
  operation: unknown = {},
): ProfileHookCommandDraft {
  const command = dynamicRow(operation);
  return {
    command: safeString(command.command ?? ""),
    interaction: normalizeHookInteraction(command.interaction),
    mode: safeString(command.mode || "Enable"),
    timeout: command.timeout == null ? "60" : safeString(command.timeout),
  };
}

function normalizeHookFlowRow(operation: unknown = {}): ProfileHookFlowDraft {
  const operationRecord = dynamicRow(operation);
  const flow = operationRecord.kind === "flow" ? operationRecord : {};
  const steps = Array.isArray(flow.steps) ? flow.steps : [];
  return {
    max_steps: flow.max_steps == null ? "" : safeString(flow.max_steps),
    steps:
      steps.length > 0
        ? steps.map(normalizeHookCommandRow)
        : [normalizeHookCommandRow(defaultHookOperation())],
    stop_on_error: !!(flow.stop_on_error ?? true),
  };
}

function hookOperationKindLabel(operation: unknown): "command" | "flow" {
  if (dynamicRow(operation).kind === "flow") return "flow";
  return "command";
}

function normalizeHookListRow(
  hookRowInput: unknown = {},
  state = "",
): ProfileHookRowDraft {
  const hookRowRecord = dynamicRow(hookRowInput);
  const operation = hookRowRecord.operation || defaultHookOperation();
  const kind = hookOperationKindLabel(operation);
  return {
    command:
      kind === "command"
        ? normalizeHookCommandRow(operation)
        : normalizeHookCommandRow(defaultHookOperation()),
    failure_policy:
      hookRowRecord.failure_policy === "required" ? "required" : "best_effort",
    flow:
      kind === "flow"
        ? normalizeHookFlowRow(operation)
        : normalizeHookFlowRow({
            kind: "flow",
            steps: [defaultHookOperation()],
          }),
    kind,
    name: safeString(hookRowRecord.name ?? ""),
    record_output: !!hookRowRecord.record_output,
    state: safeString(state ?? ""),
  };
}

function updateHookListRow(
  hookListKey: string,
  rowIndex: number,
  updateRow: (row: ProfileHookRowDraft) => ProfileHookRowDraft,
): void {
  updateHookListRows(hookListKey, (rows) =>
    updateListRow(rows, rowIndex, updateRow),
  );
}

export function patchHookListRow(
  hookListKey: string,
  rowIndex: number,
  patch: ProfileHookRowPatch,
): void {
  updateHookListRow(hookListKey, rowIndex, (row) => ({ ...row, ...patch }));
}

function patchHookListCommandField(
  hookListKey: string,
  rowIndex: number,
  patch: ProfileHookCommandPatch,
): void {
  updateHookListRow(hookListKey, rowIndex, (row) => ({
    ...row,
    command: { ...row.command, ...patch },
  }));
}

export function patchHookListCommand(
  hookListKey: string,
  rowIndex: number,
  patch: ProfileHookCommandPatch,
): void {
  patchHookListCommandField(hookListKey, rowIndex, patch);
}

export function patchHookListFlow(
  hookListKey: string,
  rowIndex: number,
  patch: ProfileHookFlowPatch,
): void {
  updateHookListRow(hookListKey, rowIndex, (row) => ({
    ...row,
    flow: { ...row.flow, ...patch },
  }));
}

function updateHookListFlowSteps(
  hookListKey: string,
  rowIndex: number,
  updateSteps: (steps: ProfileHookCommandDraft[]) => ProfileHookCommandDraft[],
): void {
  updateHookListRow(hookListKey, rowIndex, (row) => ({
    ...row,
    flow: {
      ...row.flow,
      steps: updateSteps(row.flow.steps),
    },
  }));
}

export function patchHookListFlowStep(
  hookListKey: string,
  rowIndex: number,
  stepIndex: number,
  patch: ProfileHookCommandPatch,
): void {
  updateHookListFlowSteps(hookListKey, rowIndex, (steps) =>
    updateListRow(steps, stepIndex, (step) => ({ ...step, ...patch })),
  );
}

export function addHookListFlowStep(
  hookListKey: string,
  rowIndex: number,
  command: unknown = defaultHookOperation(),
): void {
  updateHookListFlowSteps(hookListKey, rowIndex, (steps) => [
    ...steps,
    normalizeHookCommandRow(command),
  ]);
}

export function removeHookListFlowStep(
  hookListKey: string,
  rowIndex: number,
  stepIndex: number,
): void {
  updateHookListFlowSteps(hookListKey, rowIndex, (steps) =>
    removeListItem(steps, stepIndex),
  );
}

export function removeHookListRow(hookListKey: string, rowIndex: number): void {
  updateHookListRows(hookListKey, (currentRows) =>
    currentRows.filter((_, currentIndex) => currentIndex !== rowIndex),
  );
}

export function changeHookListKind(
  hookListKey: string,
  rowIndex: number,
  kind: ProfileHookKind,
): void {
  updateHookListRow(hookListKey, rowIndex, (row) => {
    const normalizedKind = kind === "flow" ? "flow" : "command";
    const nextRow: ProfileHookRowDraft = { ...row, kind: normalizedKind };
    if (normalizedKind === "flow" && nextRow.flow.steps.length === 0) {
      nextRow.flow = {
        ...nextRow.flow,
        steps: [normalizeHookCommandRow(defaultHookOperation())],
      };
    }
    return nextRow;
  });
}

export function addHookListRow(
  hookListKey: string,
  hookEntry: unknown = {},
  state = "",
): void {
  updateHookListRows(hookListKey, (currentRows) => [
    ...currentRows,
    normalizeHookListRow(hookEntry, state),
  ]);
}

function collectHookCommand(
  command: ProfileHookCommandDraft,
  triggerName: string,
  hookName: string,
): ProfileCommandConfig {
  const commandValue = safeString(command.command).trim();
  const mode = safeString(command.mode).trim();
  const timeoutRaw = safeString(command.timeout).trim();
  if (!commandValue) {
    throw new Error(`${t("hookCommandRequired")}: ${triggerName}/${hookName}`);
  }
  const operation: ProfileCommandConfig = {
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
  const promptRows = command.interaction.prompts;
  if (promptRows.length > 0) {
    operation.interaction = {
      prompts: promptRows.map((prompt, promptIndex) => {
        const patterns = prompt.patterns
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

function hasHookOperationInput(hookRow: ProfileHookRowDraft): boolean {
  if (hookRow.kind === "flow") {
    return hookRow.flow.steps.some((step) => safeString(step.command).trim());
  }
  return !!safeString(hookRow.command.command).trim();
}

function collectHookOperation(
  hookRow: ProfileHookRowDraft,
  triggerName: string,
  hookName: string,
): ProfileHookCommand | ProfileHookFlow {
  const hookPath = `${triggerName}/${hookName}`;
  if (hookRow.kind === "flow") {
    const steps = hookRow.flow.steps.map((step, index) =>
      collectHookCommand(step, triggerName, `${hookName}[${index + 1}]`),
    );
    if (steps.length === 0) {
      throw new Error(`${t("hookFlowStepRequired")}: ${hookPath}`);
    }
    const flow: ProfileHookFlow = {
      kind: "flow",
      steps,
      stop_on_error: hookRow.flow.stop_on_error,
    };
    const maxStepsRaw = hookRow.flow.max_steps.trim();
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
    ...collectHookCommand(hookRow.command, triggerName, hookName),
  };
}

function collectHook(
  hookRow: ProfileHookRowDraft,
  triggerName: string,
): ProfileHookAction | null {
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

function collectHookListRows(
  rows: ProfileHookRowDraft[],
  triggerName: string,
): ProfileHookAction[] {
  return rows
    .map((hookRow) => collectHook(hookRow, triggerName))
    .filter((hook): hook is ProfileHookAction => hook !== null);
}

function collectStateHookListRows(
  rows: ProfileHookRowDraft[],
  triggerName: string,
): Record<string, ProfileHookAction[]> {
  const grouped: Record<string, ProfileHookAction[]> = {};
  rows.forEach((hookRow) => {
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

export function collectHookRows(
  hookListKey: string,
  triggerName: string,
): ProfileHookAction[] {
  return collectHookListRows(
    getStore(hookListStateFor(hookListKey)),
    triggerName,
  );
}

export function collectStateHookRows(
  hookListKey: string,
  triggerName: string,
): Record<string, ProfileHookAction[]> {
  return collectStateHookListRows(
    getStore(hookListStateFor(hookListKey)),
    triggerName,
  );
}
