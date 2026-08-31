import { tr } from "../../../lib/i18n.js";
import type {
  ConfigFetchScheduleAction,
  JsonValue,
  ScheduleAction,
  ScheduleDefinition,
  ScheduleForm,
  ScheduleConnection,
  SchedulesState,
  StoredSchedule,
} from "./types.js";

const DEFAULT_FORM: Readonly<ScheduleForm> = Object.freeze({
  actionType: "orchestrate",
  configGroups: [],
  configKind: "running",
  configLabels: [],
  configTargets: [],
  connectionName: "",
  cronExpression: "0 2 * * *",
  enabled: true,
  maxRuntimeSeconds: "3600",
  misfirePolicy: "fire_once",
  name: "",
  overlapPolicy: "skip",
  orchestrationTemplateName: "",
  timezone: "Asia/Shanghai",
  txWorkflowTemplateName: "",
  varsJson: "{}",
});

export function defaultScheduleForm(): ScheduleForm {
  return {
    ...DEFAULT_FORM,
    configGroups: [],
    configLabels: [],
    configTargets: [],
  };
}

export function newSchedulesState(): SchedulesState {
  return {
    busyAction: "",
    configCommands: [],
    configKinds: [],
    connections: [],
    cronPreview: [],
    cronPreviewStatus: null,
    dialogOpen: false,
    editingId: "",
    form: defaultScheduleForm(),
    inventoryGroups: [],
    inventoryLabels: [],
    listStatus: null,
    runs: [],
    runsStatus: null,
    schedules: [],
    selectedId: "",
    orchestrationTemplates: [],
    txWorkflowTemplates: [],
  };
}

export function configTargetsFromAction(
  action: Partial<ConfigFetchScheduleAction> = {},
): string[] {
  const targets = Array.isArray(action.targets) ? action.targets : [];
  return [
    ...new Set(
      [...targets, action.connection_name]
        .map((value) => String(value || "").trim())
        .filter(Boolean),
    ),
  ];
}

export function scheduleToForm(schedule: StoredSchedule): ScheduleForm {
  const action = schedule.action;
  return {
    actionType: action.type,
    configGroups: action.type === "config_fetch" ? action.groups : [],
    configKind: action.type === "config_fetch" ? action.kind : "running",
    configLabels: action.type === "config_fetch" ? action.labels : [],
    configTargets:
      action.type === "config_fetch" ? configTargetsFromAction(action) : [],
    connectionName: action.type === "tx_workflow" ? action.connection_name : "",
    cronExpression: schedule.cron_expression || DEFAULT_FORM.cronExpression,
    enabled: schedule.enabled !== false,
    maxRuntimeSeconds: String(
      schedule.max_runtime_seconds || DEFAULT_FORM.maxRuntimeSeconds,
    ),
    misfirePolicy: schedule.misfire_policy || "fire_once",
    name: schedule.name || "",
    overlapPolicy: schedule.overlap_policy || "skip",
    orchestrationTemplateName:
      action.type === "orchestrate" ? action.template_name : "",
    timezone: schedule.timezone || DEFAULT_FORM.timezone,
    txWorkflowTemplateName:
      action.type === "tx_workflow" ? action.template_name : "",
    varsJson:
      action.type === "config_fetch"
        ? "{}"
        : JSON.stringify(action.vars || {}, null, 2),
  };
}

function parseJsonValue(source: string): JsonValue {
  return JSON.parse(source) as JsonValue;
}

export function definitionFromForm(form: ScheduleForm): ScheduleDefinition {
  let vars: JsonValue;
  try {
    vars = parseJsonValue(form.varsJson || "{}");
  } catch {
    throw new Error(tr("scheduleVarsInvalid", "Variables must be valid JSON"));
  }
  const maxRuntimeSeconds = Number(form.maxRuntimeSeconds);
  if (!Number.isInteger(maxRuntimeSeconds) || maxRuntimeSeconds < 1) {
    throw new Error(
      tr(
        "scheduleRuntimeInvalid",
        "Maximum runtime must be a positive integer",
      ),
    );
  }
  const common = {
    name: form.name.trim(),
    cron_expression: form.cronExpression.trim(),
    timezone: form.timezone.trim(),
    enabled: form.enabled,
    overlap_policy: form.overlapPolicy,
    misfire_policy: form.misfirePolicy,
    max_runtime_seconds: maxRuntimeSeconds,
  };
  let action: ScheduleAction;
  if (form.actionType === "config_fetch") {
    action = {
      type: "config_fetch",
      targets: form.configTargets,
      groups: form.configGroups,
      labels: form.configLabels,
      kind: form.configKind,
    };
  } else if (form.actionType === "tx_workflow") {
    action = {
      type: "tx_workflow",
      connection_name: form.connectionName,
      template_name: form.txWorkflowTemplateName,
      vars,
    };
  } else {
    action = {
      type: "orchestrate",
      template_name: form.orchestrationTemplateName,
      vars,
    };
  }
  return { ...common, action };
}

function selectionSet(values: string[]): Set<string> {
  return new Set(values.map((value) => value.trim()).filter(Boolean));
}

function selectedConfigConnections(
  state: SchedulesState,
): ScheduleConnection[] {
  const targets = selectionSet(state.form.configTargets);
  const groups = selectionSet(state.form.configGroups);
  const labels = selectionSet(state.form.configLabels);
  const groupTargets = new Set(
    state.inventoryGroups
      .filter((group) => groups.has(group.name))
      .flatMap((group) => group.hosts || []),
  );
  const labelTargets = new Set(
    state.inventoryLabels
      .filter((label) => labels.has(label.name))
      .flatMap((label) => label.hosts || []),
  );
  return state.connections.filter(
    (connection) =>
      targets.has(connection.name) ||
      groupTargets.has(connection.name) ||
      labelTargets.has(connection.name),
  );
}

export function availableConfigKinds(state: SchedulesState): string[] {
  const profiles = [
    ...new Set(
      selectedConfigConnections(state)
        .map((connection) => connection.device_profile)
        .filter(
          (profile): profile is string =>
            Boolean(profile) && profile !== "autodetect",
        ),
    ),
  ];
  if (!profiles.length) return [...state.configKinds];
  const kindSets = profiles.map(
    (profile) =>
      new Set(
        state.configCommands
          .filter((command) => command.device_profile === profile)
          .map((command) => command.kind)
          .filter(Boolean),
      ),
  );
  const [firstKinds, ...remainingKinds] = kindSets;
  return firstKinds
    ? [...firstKinds].filter((kind) =>
        remainingKinds.every((kinds) => kinds.has(kind)),
      )
    : [];
}
