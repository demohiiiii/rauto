import { derived, get, writable } from "svelte/store";
import { currentLanguageState, tr } from "../../../lib/i18n.js";
import { deviceDiscoveryApi } from "../infrastructure/deviceDiscoveryApi.js";
import { deviceDiscoveryRuntime } from "../infrastructure/deviceDiscoveryRuntime.js";
import {
  createDiscoveryRunPayload,
  defaultDiscoveryConnectionName,
  discoveryResultCanImport,
  discoveryResultKey,
  discoveryRunIsActive,
  newDeviceDiscoveryState,
  retainImportableDiscoveryResultKeys,
} from "../model/deviceDiscovery.js";
import type {
  DeviceDiscoveryApi,
  DeviceDiscoveryRuntime,
  DeviceDiscoveryState,
  DeviceDiscoveryWorkspace,
  DeviceDiscoveryWorkspaceOptions,
  DiscoveryFormState,
  DiscoveryResult,
  DiscoveryResultFilter,
  DiscoveryRunDetail,
} from "../model/types.js";
import { deviceDiscoveryPresentation } from "../presentation/deviceDiscoveryPresentation.js";

function errorMessage(error: unknown, fallbackKey: string): string {
  return error instanceof Error && error.message
    ? error.message
    : tr(fallbackKey);
}

export function createDeviceDiscoveryWorkspace(
  options: DeviceDiscoveryWorkspaceOptions = {},
): DeviceDiscoveryWorkspace {
  const api = Object.assign(
    {},
    deviceDiscoveryApi,
    options.api,
  ) as DeviceDiscoveryApi;
  const runtime = Object.assign(
    {},
    deviceDiscoveryRuntime,
    options.runtime,
  ) as DeviceDiscoveryRuntime;
  const pollIntervalMs = options.pollIntervalMs ?? 1000;
  const stateStore = writable<DeviceDiscoveryState>(newDeviceDiscoveryState());
  const displayStateStore = derived(
    [stateStore, currentLanguageState],
    ([$state]) => deviceDiscoveryPresentation($state),
  );
  let active = false;
  let initialized = false;
  let initializedResultKeys = new Set<string>();
  let pollTimer: ReturnType<typeof setTimeout> | null = null;

  function mutate(mutation: (state: DeviceDiscoveryState) => void): void {
    stateStore.update((state) => {
      mutation(state);
      return state;
    });
  }

  function stopPolling(): void {
    if (pollTimer) clearTimeout(pollTimer);
    pollTimer = null;
  }

  function initializeResultDrafts(detail: DiscoveryRunDetail): void {
    mutate((state) => {
      const nextNames = { ...state.connectionNames };
      const nextSelected = new Set(state.selectedResultKeys);
      for (const result of detail.results || []) {
        const key = discoveryResultKey(result);
        if (!nextNames[key]) {
          nextNames[key] = defaultDiscoveryConnectionName(result);
        }
        if (!initializedResultKeys.has(key)) {
          initializedResultKeys.add(key);
          if (
            discoveryResultCanImport(result) &&
            !result.existing_connection_name
          ) {
            nextSelected.add(key);
          }
        }
      }
      state.connectionNames = nextNames;
      state.selectedResultKeys = Array.from(nextSelected);
    });
  }

  function schedulePoll(): void {
    stopPolling();
    pollTimer = setTimeout(async () => {
      const runId = get(stateStore).currentDetail?.run.id;
      if (!active || !runId) return;
      try {
        await loadRun(runId);
      } catch (error) {
        mutate((state) => {
          state.errorMessage = errorMessage(error, "deviceDiscoveryLoadFailed");
        });
      }
    }, pollIntervalMs);
  }

  async function loadRun(runId: string): Promise<void> {
    if (!runId) return;
    const detail = await api.getRun(runId);
    mutate((state) => {
      state.currentDetail = detail;
    });
    initializeResultDrafts(detail);
    if (discoveryRunIsActive(detail.run)) schedulePoll();
  }

  async function initialize(): Promise<void> {
    mutate((state) => {
      state.loading = true;
      state.errorMessage = "";
    });
    try {
      const [credentials, groups, labels, runs] = await Promise.all([
        api.listCredentials(),
        api.listGroups(),
        api.listLabels(),
        api.listRuns(),
      ]);
      mutate((state) => {
        state.credentials = Array.isArray(credentials) ? credentials : [];
        state.groups = Array.isArray(groups) ? groups : [];
        state.labels = Array.isArray(labels) ? labels : [];
        if (!state.selectedCredentialIds.length && state.credentials[0]?.id) {
          state.selectedCredentialIds = [state.credentials[0].id];
        }
      });
      const latestRun = Array.isArray(runs) ? runs[0] : null;
      if (latestRun?.id) await loadRun(latestRun.id);
    } catch (error) {
      mutate((state) => {
        state.errorMessage = errorMessage(error, "deviceDiscoveryLoadFailed");
      });
    } finally {
      mutate((state) => {
        state.loading = false;
      });
    }
  }

  async function loadLatestRun(): Promise<void> {
    const runs = await api.listRuns();
    const latestRun = Array.isArray(runs) ? runs[0] : null;
    const currentRunId = get(stateStore).currentDetail?.run.id;
    if (!latestRun?.id) {
      mutate((state) => {
        state.currentDetail = null;
      });
      return;
    }
    if (latestRun.id !== currentRunId) {
      initializedResultKeys = new Set();
      mutate((state) => {
        state.selectedResultKeys = [];
        state.connectionNames = {};
      });
    }
    await loadRun(latestRun.id);
  }

  async function startDiscovery(): Promise<void> {
    mutate((state) => {
      state.errorMessage = "";
      state.statusMessage = "";
    });
    const state = get(stateStore);
    let payload;
    try {
      payload = createDiscoveryRunPayload(state);
    } catch {
      mutate((current) => {
        current.errorMessage = tr("deviceDiscoveryPortsInvalid");
      });
      return;
    }
    if (!state.targetsText.trim()) {
      mutate((current) => {
        current.errorMessage = tr("deviceDiscoveryTargetsRequired");
      });
      return;
    }
    if (!state.selectedCredentialIds.length) {
      mutate((current) => {
        current.errorMessage = tr("deviceDiscoveryCredentialRequired");
      });
      return;
    }
    initializedResultKeys = new Set();
    mutate((current) => {
      current.loading = true;
      current.selectedResultKeys = [];
      current.connectionNames = {};
    });
    try {
      const detail = await api.createRun(payload);
      mutate((current) => {
        current.currentDetail = detail;
        current.statusMessage = tr("deviceDiscoveryStarted");
      });
      schedulePoll();
    } catch (error) {
      mutate((current) => {
        current.errorMessage = errorMessage(
          error,
          "deviceDiscoveryStartFailed",
        );
      });
    } finally {
      mutate((current) => {
        current.loading = false;
      });
    }
  }

  async function cancelDiscovery(): Promise<void> {
    const runId = get(stateStore).currentDetail?.run.id;
    if (!runId) return;
    mutate((state) => {
      state.loading = true;
      state.errorMessage = "";
    });
    try {
      const detail = await api.cancelRun(runId);
      mutate((state) => {
        state.currentDetail = detail;
        state.statusMessage = tr("deviceDiscoveryCancelling");
      });
      schedulePoll();
    } catch (error) {
      mutate((state) => {
        state.errorMessage = errorMessage(error, "deviceDiscoveryCancelFailed");
      });
    } finally {
      mutate((state) => {
        state.loading = false;
      });
    }
  }

  async function importSelected(): Promise<void> {
    const display = deviceDiscoveryPresentation(get(stateStore));
    const runId = display.currentRun?.id;
    if (!runId || !display.selectedImportableResults.length) return;
    mutate((state) => {
      state.importing = true;
      state.errorMessage = "";
    });
    try {
      const summary = await api.importResults(
        runId,
        display.selectedImportableResults.map((result) => {
          const key = discoveryResultKey(result);
          return {
            host: result.host,
            port: result.port,
            connection_name: display.connectionNames[key] || "",
            credential_id: result.credential_id,
            overwrite: false,
          };
        }),
      );
      mutate((state) => {
        state.statusMessage = tr("deviceDiscoveryImportSummary")
          .replace("{created}", String(summary.created))
          .replace("{updated}", String(summary.updated))
          .replace("{failed}", String(summary.failed));
      });
      runtime.notifyConnectionsRefreshed();
      await loadRun(runId);
      mutate((state) => {
        state.selectedResultKeys = retainImportableDiscoveryResultKeys(
          state.selectedResultKeys,
          state.currentDetail?.results || [],
        );
      });
    } catch (error) {
      mutate((state) => {
        state.errorMessage = errorMessage(error, "deviceDiscoveryImportFailed");
      });
    } finally {
      mutate((state) => {
        state.importing = false;
      });
    }
  }

  function setFormField<K extends keyof DiscoveryFormState>(
    field: K,
    value: DiscoveryFormState[K],
  ): void {
    mutate((state) => {
      (state as DiscoveryFormState)[field] = value;
    });
  }

  function toggleResult(result: DiscoveryResult, checked: boolean): void {
    mutate((state) => {
      const key = discoveryResultKey(result);
      const next = new Set(state.selectedResultKeys);
      if (checked) next.add(key);
      else next.delete(key);
      state.selectedResultKeys = Array.from(next);
    });
  }

  function toggleAllImportable(checked: boolean): void {
    mutate((state) => {
      state.selectedResultKeys = checked
        ? (state.currentDetail?.results || [])
            .filter(discoveryResultCanImport)
            .map(discoveryResultKey)
        : [];
    });
  }

  async function setPageContext(context: { active: boolean }): Promise<void> {
    active = context.active;
    if (!active) {
      stopPolling();
      return;
    }
    if (!initialized) {
      initialized = true;
      await initialize();
    } else if (discoveryRunIsActive(get(stateStore).currentDetail?.run || {})) {
      schedulePoll();
    }
  }

  function destroy(): void {
    active = false;
    initialized = false;
    initializedResultKeys = new Set();
    stopPolling();
    stateStore.set(newDeviceDiscoveryState());
  }

  return {
    cancelDiscovery,
    destroy,
    displayStateStore,
    importSelected,
    loadLatestRun,
    selectResultFilter: (filter: DiscoveryResultFilter) => {
      mutate((state) => {
        state.resultFilter = filter;
        state.statusFilter = "all";
      });
    },
    selectStatusFilter: (filter: string) => {
      mutate((state) => {
        state.statusFilter = filter;
        state.resultFilter = "all";
      });
    },
    setFormField,
    setPageContext,
    setResultSearch: (value: string) => {
      mutate((state) => {
        state.resultSearch = value;
      });
    },
    startDiscovery,
    stateStore,
    toggleAllImportable,
    toggleResult,
    updateConnectionName: (result: DiscoveryResult, value: string) => {
      mutate((state) => {
        state.connectionNames = {
          ...state.connectionNames,
          [discoveryResultKey(result)]: value,
        };
      });
    },
  };
}
