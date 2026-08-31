import { derived, get, writable } from "svelte/store";
import { currentLanguageState, tr } from "../../../lib/i18n.js";
import { scheduleApi } from "../infrastructure/scheduleApi.js";
import {
  availableConfigKinds,
  defaultScheduleForm,
  definitionFromForm,
  newSchedulesState,
  scheduleToForm,
} from "../model/scheduleForm.js";
import type {
  ScheduleApi,
  ScheduleForm,
  ScheduleFormPatch,
  SchedulesState,
  SchedulesWorkspace,
  SchedulesWorkspaceOptions,
  StoredSchedule,
} from "../model/types.js";
import { schedulePresentation } from "../presentation/schedulePresentation.js";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function hasFormField(
  patch: ScheduleFormPatch,
  field: keyof ScheduleForm,
): boolean {
  return Object.hasOwn(patch, field);
}

export function createSchedulesPageWorkspace(
  options: SchedulesWorkspaceOptions = {},
): SchedulesWorkspace {
  const api = Object.assign({}, scheduleApi, options.api) as ScheduleApi;
  const stateStore = writable<SchedulesState>(newSchedulesState());
  const displayStateStore = derived(
    [stateStore, currentLanguageState],
    ([$state]) => schedulePresentation($state),
  );
  let loaded = false;
  let previewRequestVersion = 0;
  let previewTimer: ReturnType<typeof setTimeout> | null = null;
  let runsRequestVersion = 0;

  async function refreshCronPreview(): Promise<void> {
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
        cronPreviewStatus: { message: errorMessage(error), tone: "error" },
      }));
    }
  }

  function queueCronPreview(delay = 250): void {
    if (previewTimer) clearTimeout(previewTimer);
    previewTimer = setTimeout(() => {
      previewTimer = null;
      void refreshCronPreview();
    }, delay);
  }

  async function mutate(
    action: string,
    mutation: (state: SchedulesState) => Promise<void>,
  ): Promise<void> {
    const state = get(stateStore);
    state.busyAction = action;
    state.listStatus = null;
    stateStore.set(state);
    try {
      await mutation(state);
    } catch (error) {
      state.listStatus = { message: errorMessage(error), tone: "error" };
    } finally {
      state.busyAction = "";
      stateStore.set(state);
    }
  }

  async function refresh(
    selectedId = get(stateStore).selectedId,
  ): Promise<void> {
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
            ...state.configCommands.map((command) => command.kind),
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
        state.runs = Array.isArray(runs) ? runs : [];
        state.runsStatus = null;
      } else {
        state.selectedId = "";
        state.runs = [];
        state.runsStatus = null;
      }
    });
  }

  function patchForm(patch: ScheduleFormPatch): void {
    const state = get(stateStore);
    state.form = { ...state.form, ...patch };
    if (
      (["configTargets", "configGroups", "configLabels"] as const).some(
        (field) => hasFormField(patch, field),
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
      hasFormField(patch, "cronExpression") ||
      hasFormField(patch, "timezone")
    ) {
      queueCronPreview();
    }
  }

  function startCreate(): void {
    const state = get(stateStore);
    state.editingId = "";
    state.form = defaultScheduleForm();
    state.dialogOpen = true;
    state.listStatus = null;
    stateStore.set(state);
    queueCronPreview(0);
  }

  function closeEditor(): void {
    previewRequestVersion += 1;
    if (previewTimer) clearTimeout(previewTimer);
    previewTimer = null;
    const state = get(stateStore);
    state.dialogOpen = false;
    state.cronPreview = [];
    state.cronPreviewStatus = null;
    stateStore.set(state);
  }

  function editSchedule(id: string): () => void {
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

  function selectSchedule(id: string): () => Promise<void> {
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
          runs: Array.isArray(runs) ? runs : [],
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
          runsStatus: { message: errorMessage(error), tone: "error" },
        }));
      }
    };
  }

  async function save(): Promise<void> {
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

  async function remove(id: string): Promise<void> {
    const scheduleId = id.trim();
    if (!scheduleId) return;
    await mutate(`delete:${scheduleId}`, async (state) => {
      await api.deleteSchedule(scheduleId);
      const selectedId =
        state.selectedId === scheduleId ? "" : state.selectedId;
      if (state.editingId === scheduleId) {
        state.editingId = "";
        state.form = defaultScheduleForm();
        state.dialogOpen = false;
      }
      await refresh(selectedId);
    });
  }

  function toggleEnabled(schedule: StoredSchedule): () => Promise<void> {
    return async () => {
      await mutate(`toggle:${schedule.id}`, async () => {
        await api.setScheduleEnabled(schedule.id, !schedule.enabled);
        await refresh(schedule.id);
      });
    };
  }

  function runNow(schedule: StoredSchedule): () => Promise<void> {
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

  async function setPageContext({
    active,
  }: {
    active: boolean;
  }): Promise<void> {
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
