import {
  createSchedule,
  deleteSchedule,
  listConfigCommands,
  listConnections,
  listInventoryGroups,
  listInventoryLabels,
  listScheduleRuns,
  listSchedules,
  listTemplateResource,
  previewSchedule,
  runScheduleNow,
  setScheduleEnabled,
  updateSchedule,
} from "../../api/client.js";
import { currentLanguageState, tr } from "../../lib/i18n.js";
import { derived, get, writable } from "svelte/store";

const defaultApi = {
  createSchedule,
  deleteSchedule,
  listConfigCommands,
  listConnections,
  listInventoryGroups,
  listInventoryLabels,
  listScheduleRuns,
  listSchedules,
  listTemplateResource,
  previewSchedule,
  runScheduleNow,
  setScheduleEnabled,
  updateSchedule,
};

const DEFAULT_FORM = Object.freeze({
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

function defaultForm() {
  return {
    ...DEFAULT_FORM,
    configGroups: [],
    configLabels: [],
    configTargets: [],
  };
}

function newState() {
  return {
    busyAction: "",
    configCommands: [],
    configKinds: [],
    connections: [],
    cronPreview: [],
    cronPreviewStatus: null,
    dialogOpen: false,
    editingId: "",
    form: defaultForm(),
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

function formatTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export function configTargetsFromAction(action = {}) {
  const targets = Array.isArray(action.targets) ? action.targets : [];
  return [
    ...new Set(
      [...targets, action.connection_name]
        .map((value) => String(value || "").trim())
        .filter(Boolean),
    ),
  ];
}

function scheduleToForm(schedule) {
  const action = schedule.action || {};
  return {
    actionType: action.type || "orchestrate",
    configGroups: Array.isArray(action.groups) ? action.groups : [],
    configKind: action.kind || "running",
    configLabels: Array.isArray(action.labels) ? action.labels : [],
    configTargets: configTargetsFromAction(action),
    connectionName: action.connection_name || "",
    cronExpression: schedule.cron_expression || DEFAULT_FORM.cronExpression,
    enabled: schedule.enabled !== false,
    maxRuntimeSeconds: String(
      schedule.max_runtime_seconds || DEFAULT_FORM.maxRuntimeSeconds,
    ),
    misfirePolicy: schedule.misfire_policy || "fire_once",
    name: schedule.name || "",
    overlapPolicy: schedule.overlap_policy || "skip",
    orchestrationTemplateName:
      action.type === "orchestrate" ? action.template_name || "" : "",
    timezone: schedule.timezone || DEFAULT_FORM.timezone,
    txWorkflowTemplateName:
      action.type === "tx_workflow" ? action.template_name || "" : "",
    varsJson: JSON.stringify(action.vars || {}, null, 2),
  };
}

function definitionFromForm(form) {
  let vars;
  try {
    vars = JSON.parse(form.varsJson || "{}");
  } catch (_) {
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
  if (form.actionType === "config_fetch") {
    return {
      ...common,
      action: {
        type: "config_fetch",
        targets: form.configTargets,
        groups: form.configGroups,
        labels: form.configLabels,
        kind: form.configKind,
      },
    };
  }
  if (form.actionType === "tx_workflow") {
    return {
      ...common,
      action: {
        type: "tx_workflow",
        connection_name: form.connectionName,
        template_name: form.txWorkflowTemplateName,
        vars,
      },
    };
  }
  return {
    ...common,
    action: {
      type: "orchestrate",
      template_name: form.orchestrationTemplateName,
      vars,
    },
  };
}

function selectionSet(values) {
  return new Set(
    (Array.isArray(values) ? values : [])
      .map((value) => String(value || "").trim())
      .filter(Boolean),
  );
}

function selectedConfigConnections(state) {
  const targets = selectionSet(state.form.configTargets);
  const groups = selectionSet(state.form.configGroups);
  const labels = selectionSet(state.form.configLabels);
  const groupTargets = new Set(
    state.inventoryGroups
      .filter((group) => groups.has(group.name))
      .flatMap((group) => (Array.isArray(group.hosts) ? group.hosts : [])),
  );
  const labelTargets = new Set(
    state.inventoryLabels
      .filter((label) => labels.has(label.name))
      .flatMap((label) => (Array.isArray(label.hosts) ? label.hosts : [])),
  );
  return state.connections.filter((connection) => {
    return (
      targets.has(connection.name) ||
      groupTargets.has(connection.name) ||
      labelTargets.has(connection.name)
    );
  });
}

function availableConfigKinds(state) {
  const profiles = [
    ...new Set(
      selectedConfigConnections(state)
        .map((connection) => connection.device_profile)
        .filter((profile) => profile && profile !== "autodetect"),
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
  return [...kindSets[0]].filter((kind) =>
    kindSets.slice(1).every((kinds) => kinds.has(kind)),
  );
}

function multiSelectOptions(values) {
  return values.map((value) => ({ label: value, value }));
}

function presentation(state) {
  const configKinds = availableConfigKinds(state).sort();
  return {
    ...state,
    scheduleRows: state.schedules.map((schedule) => ({
      ...schedule,
      active: schedule.id === state.selectedId,
      lastRunText: formatTime(schedule.last_run_at),
      nextRunText: formatTime(schedule.next_run_at),
    })),
    runRows: state.runs.map((run) => ({
      ...run,
      completedText: formatTime(run.completed_at),
      scheduledForText: formatTime(run.scheduled_for),
    })),
    connectionOptions: [
      {
        optionLabel: tr("scheduleConnectionPlaceholder", "Select a connection"),
        optionValue: "",
      },
      ...state.connections.map((connection) => ({
        optionLabel: connection.name,
        optionValue: connection.name,
      })),
    ],
    configTargetOptions: multiSelectOptions(
      state.connections.map((connection) => connection.name),
    ),
    configGroupOptions: multiSelectOptions(
      state.inventoryGroups.map((group) => group.name),
    ),
    configLabelOptions: multiSelectOptions(
      state.inventoryLabels.map((label) => label.name),
    ),
    configKindOptions: (configKinds.length
      ? configKinds
      : state.configKinds
    ).map((kind) => ({
      optionLabel: kind,
      optionValue: kind,
    })),
    orchestrationTemplateOptions: [
      {
        optionLabel: tr("scheduleTemplatePlaceholder", "Select a template"),
        optionValue: "",
      },
      ...state.orchestrationTemplates.map((template) => ({
        optionLabel: template.name,
        optionValue: template.name,
      })),
    ],
    txWorkflowTemplateOptions: [
      {
        optionLabel: tr(
          "scheduleTxTemplatePlaceholder",
          "Select a workflow template",
        ),
        optionValue: "",
      },
      ...state.txWorkflowTemplates.map((template) => ({
        optionLabel: template.name,
        optionValue: template.name,
      })),
    ],
  };
}

export function createSchedulesPageWorkspace(options = {}) {
  const api = { ...defaultApi, ...(options.api || {}) };
  const stateStore = writable(newState());
  const displayStateStore = derived(
    [stateStore, currentLanguageState],
    ([$state]) => presentation($state),
  );
  let loaded = false;
  let previewRequestVersion = 0;
  let previewTimer = null;
  let runsRequestVersion = 0;

  async function refreshCronPreview() {
    const state = get(stateStore);
    if (!state.dialogOpen) return;
    const version = ++previewRequestVersion;
    const cronExpression = state.form.cronExpression;
    const timezone = state.form.timezone;
    stateStore.update((current) => ({
      ...current,
      cronPreview: [],
      cronPreviewStatus: {
        message: tr("loading", "Loading..."),
        tone: "info",
      },
    }));
    try {
      const response = await api.previewSchedule({
        cron_expression: cronExpression,
        timezone,
      });
      if (version !== previewRequestVersion) return;
      stateStore.update((current) => ({
        ...current,
        cronPreview: Array.isArray(response?.next_runs)
          ? response.next_runs
          : [],
        cronPreviewStatus: null,
      }));
    } catch (error) {
      if (version !== previewRequestVersion) return;
      stateStore.update((current) => ({
        ...current,
        cronPreview: [],
        cronPreviewStatus: { message: error.message, tone: "error" },
      }));
    }
  }

  function queueCronPreview(delay = 250) {
    if (previewTimer) clearTimeout(previewTimer);
    previewTimer = setTimeout(() => {
      previewTimer = null;
      void refreshCronPreview();
    }, delay);
  }

  async function mutate(action, mutation) {
    const state = get(stateStore);
    state.busyAction = action;
    state.listStatus = null;
    stateStore.set(state);
    try {
      await mutation(state);
    } catch (error) {
      state.listStatus = { message: error.message, tone: "error" };
    } finally {
      state.busyAction = "";
      stateStore.set(state);
    }
  }

  async function refresh(selectedId = get(stateStore).selectedId) {
    const runsVersion = ++runsRequestVersion;
    await mutate("refresh", async (state) => {
      const [
        schedules,
        orchestrationTemplates,
        txWorkflowTemplates,
        connections,
        inventoryGroups,
        inventoryLabels,
        configCommands,
      ] = await Promise.all([
        api.listSchedules(),
        api.listTemplateResource("/api/orchestration-templates"),
        api.listTemplateResource("/api/tx-workflow-templates"),
        api.listConnections(),
        api.listInventoryGroups(),
        api.listInventoryLabels(),
        api.listConfigCommands(),
      ]);
      state.schedules = Array.isArray(schedules) ? schedules : [];
      state.orchestrationTemplates = Array.isArray(orchestrationTemplates)
        ? orchestrationTemplates
        : [];
      state.txWorkflowTemplates = Array.isArray(txWorkflowTemplates)
        ? txWorkflowTemplates
        : [];
      state.connections = Array.isArray(connections) ? connections : [];
      state.inventoryGroups = Array.isArray(inventoryGroups)
        ? inventoryGroups
        : [];
      state.inventoryLabels = Array.isArray(inventoryLabels)
        ? inventoryLabels
        : [];
      state.configCommands = Array.isArray(configCommands)
        ? configCommands
        : [];
      state.configKinds = [
        ...new Set(
          [
            "running",
            ...(Array.isArray(configCommands) ? configCommands : []).map(
              (command) => command.kind,
            ),
          ].filter(Boolean),
        ),
      ].sort();
      if (runsVersion !== runsRequestVersion) return;
      const selected = state.schedules.find((item) => item.id === selectedId);
      if (selected) {
        state.selectedId = selected.id;
        state.form = scheduleToForm(selected);
        const runs = await api.listScheduleRuns(selected.id);
        if (runsVersion !== runsRequestVersion) return;
        state.runs = runs;
        state.runsStatus = null;
      } else {
        state.selectedId = "";
        state.runs = [];
        state.runsStatus = null;
      }
    });
  }

  function patchForm(patch) {
    const state = get(stateStore);
    state.form = { ...state.form, ...patch };
    if (
      ["configTargets", "configGroups", "configLabels"].some((field) =>
        Object.hasOwn(patch, field),
      )
    ) {
      const kinds = availableConfigKinds(state).sort();
      if (kinds.length && !kinds.includes(state.form.configKind)) {
        state.form.configKind = kinds.includes("running")
          ? "running"
          : kinds[0];
      }
    }
    stateStore.set(state);
    if (
      Object.hasOwn(patch, "cronExpression") ||
      Object.hasOwn(patch, "timezone")
    ) {
      queueCronPreview();
    }
  }

  function startCreate() {
    const state = get(stateStore);
    state.editingId = "";
    state.form = defaultForm();
    state.dialogOpen = true;
    state.listStatus = null;
    stateStore.set(state);
    queueCronPreview(0);
  }

  function closeEditor() {
    previewRequestVersion += 1;
    if (previewTimer) clearTimeout(previewTimer);
    previewTimer = null;
    const state = get(stateStore);
    state.dialogOpen = false;
    state.cronPreview = [];
    state.cronPreviewStatus = null;
    stateStore.set(state);
  }

  function editSchedule(id) {
    return () => {
      const state = get(stateStore);
      const schedule = state.schedules.find((item) => item.id === id);
      if (!schedule) return;
      state.editingId = id;
      state.form = scheduleToForm(schedule);
      state.dialogOpen = true;
      stateStore.set(state);
      queueCronPreview(0);
    };
  }

  function selectSchedule(id) {
    return async () => {
      const version = ++runsRequestVersion;
      const state = get(stateStore);
      const schedule = state.schedules.find((item) => item.id === id);
      if (!schedule) return;
      state.selectedId = id;
      state.form = scheduleToForm(schedule);
      state.runsStatus = { message: tr("loading", "Loading..."), tone: "info" };
      stateStore.set(state);
      try {
        const runs = await api.listScheduleRuns(id);
        if (
          version !== runsRequestVersion ||
          get(stateStore).selectedId !== id
        ) {
          return;
        }
        stateStore.update((current) => ({
          ...current,
          runs,
          runsStatus: null,
        }));
      } catch (error) {
        if (
          version !== runsRequestVersion ||
          get(stateStore).selectedId !== id
        ) {
          return;
        }
        stateStore.update((current) => ({
          ...current,
          runs: [],
          runsStatus: { message: error.message, tone: "error" },
        }));
      }
    };
  }

  async function save() {
    await mutate("save", async (state) => {
      const definition = definitionFromForm(state.form);
      const saved = state.editingId
        ? await api.updateSchedule(state.editingId, definition)
        : await api.createSchedule(definition);
      state.selectedId = saved.id;
      state.editingId = saved.id;
      await refresh(saved.id);
      state.dialogOpen = false;
      state.listStatus = {
        message: tr("scheduleSaved", "Schedule saved"),
        tone: "success",
      };
    });
  }

  async function remove(id) {
    id = String(id || "").trim();
    if (!id) return;
    await mutate(`delete:${id}`, async (state) => {
      await api.deleteSchedule(id);
      const selectedId = state.selectedId === id ? "" : state.selectedId;
      if (state.editingId === id) {
        state.editingId = "";
        state.form = defaultForm();
        state.dialogOpen = false;
      }
      await refresh(selectedId);
    });
  }

  function toggleEnabled(schedule) {
    return async () => {
      await mutate(`toggle:${schedule.id}`, async () => {
        await api.setScheduleEnabled(schedule.id, !schedule.enabled);
        await refresh(schedule.id);
      });
    };
  }

  function runNow(schedule) {
    return async () => {
      await mutate(`run:${schedule.id}`, async (state) => {
        await api.runScheduleNow(schedule.id);
        await refresh(schedule.id);
        state.listStatus = {
          message: tr("scheduleRunQueued", "Schedule run queued"),
          tone: "success",
        };
      });
    };
  }

  async function setPageContext({ active }) {
    if (!active || loaded) return;
    loaded = true;
    await refresh();
  }

  return {
    displayStateStore,
    closeEditor,
    editSchedule,
    patchForm,
    refresh,
    remove,
    runNow,
    save,
    selectSchedule,
    setPageContext,
    startCreate,
    toggleEnabled,
  };
}
