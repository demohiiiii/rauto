import { derived, get, writable } from "svelte/store";
import { currentLanguageState, tr } from "../../../lib/i18n.js";
import { configHistoryApi } from "../infrastructure/configHistoryApi.js";
import {
  configHistoryConnectionTargetStore,
  currentConfigHistoryConnectionTarget,
  downloadConfigHistoryFile,
} from "../infrastructure/configHistoryRuntime.js";
import {
  activeSavedDeviceName,
  clearConfigHistoryState,
  localDateTimeToIso,
  mergeConfigHistoryDevices,
  newConfigHistoryState,
} from "../model/configHistory.js";
import type {
  ConfigHistoryApi,
  ConfigHistoryQueryPatch,
  ConfigHistoryState,
  ConfigHistoryWorkspace,
  ConfigHistoryWorkspaceOptions,
} from "../model/types.js";
import { configHistoryPresentation } from "../presentation/configHistoryPresentation.js";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function createConfigHistoryWorkspace(
  options: ConfigHistoryWorkspaceOptions = {},
): ConfigHistoryWorkspace {
  const api = Object.assign(
    {},
    configHistoryApi,
    options.api,
  ) as ConfigHistoryApi;
  const getActiveConnectionTarget =
    options.getActiveConnectionTarget || currentConfigHistoryConnectionTarget;
  const activeConnectionTargetStore = Object.hasOwn(
    options,
    "activeConnectionTargetStore",
  )
    ? options.activeConnectionTargetStore || null
    : options.getActiveConnectionTarget
      ? null
      : configHistoryConnectionTargetStore;
  const stateStore = writable<ConfigHistoryState>(newConfigHistoryState());
  const displayStateStore = derived(
    [stateStore, currentLanguageState],
    ([$state]) => configHistoryPresentation($state),
  );
  let activated = false;
  let deviceSelectionTouched = false;
  let deviceRequestVersion = 0;
  let listRequestVersion = 0;
  let detailRequestVersion = 0;
  let latestActiveConnectionTarget = getActiveConnectionTarget();

  const unsubscribeActiveConnectionTarget = activeConnectionTargetStore
    ? activeConnectionTargetStore.subscribe((target) => {
        latestActiveConnectionTarget = target;
        if (!activated || deviceSelectionTouched) return;
        const preferredConnectionName = activeSavedDeviceName(target);
        if (!preferredConnectionName) return;
        const current = get(stateStore);
        if (
          current.preferredConnectionName === preferredConnectionName &&
          current.connectionName === preferredConnectionName
        ) {
          return;
        }
        listRequestVersion += 1;
        detailRequestVersion += 1;
        stateStore.update((state) => ({
          ...clearConfigHistoryState(state, preferredConnectionName),
          preferredConnectionName,
        }));
        if (
          get(stateStore).devices.some(
            (device) => device.name === preferredConnectionName,
          )
        ) {
          void refreshHistory();
        }
      })
    : () => {};

  async function loadDetail(id: string): Promise<void> {
    const version = ++detailRequestVersion;
    stateStore.update((state) => ({
      ...state,
      detail: null,
      detailOpen: true,
      detailStatus: {
        message: tr("loading", "Loading..."),
        tone: "info",
      },
      selectedId: id,
    }));
    try {
      const detail = await api.getDeviceConfigSnapshot(id);
      if (version !== detailRequestVersion) return;
      stateStore.update((state) => ({
        ...state,
        detail,
        detailStatus: null,
      }));
    } catch (error) {
      if (version !== detailRequestVersion) return;
      stateStore.update((state) => ({
        ...state,
        detail: null,
        detailStatus: { message: errorMessage(error), tone: "error" },
      }));
    }
  }

  async function refreshDevices(): Promise<void> {
    const version = ++deviceRequestVersion;
    stateStore.update((state) => ({
      ...state,
      deviceStatus: { message: tr("loading", "Loading..."), tone: "info" },
    }));
    try {
      const [connectionsResponse, historyDevicesResponse] = await Promise.all([
        api.listConnections(),
        api.listDeviceConfigHistoryDevices(),
      ]);
      if (version !== deviceRequestVersion) return;
      const devices = mergeConfigHistoryDevices(
        Array.isArray(connectionsResponse) ? connectionsResponse : [],
        Array.isArray(historyDevicesResponse) ? historyDevicesResponse : [],
      );
      const current = get(stateStore);
      const connectionName = devices.some(
        (device) => device.name === current.connectionName,
      )
        ? current.connectionName
        : "";
      if (!connectionName && current.connectionName) {
        listRequestVersion += 1;
        detailRequestVersion += 1;
      }
      stateStore.update((state) => ({
        ...(connectionName
          ? state
          : clearConfigHistoryState(state, connectionName)),
        devices,
        deviceStatus: null,
      }));
    } catch (error) {
      if (version !== deviceRequestVersion) return;
      stateStore.update((state) => ({
        ...state,
        deviceStatus: { message: errorMessage(error), tone: "error" },
      }));
    }
  }

  async function refreshHistory(): Promise<void> {
    const version = ++listRequestVersion;
    const state = get(stateStore);
    if (!state.connectionName) {
      detailRequestVersion += 1;
      stateStore.update((current) => clearConfigHistoryState(current, ""));
      return;
    }
    const fetchedFrom = localDateTimeToIso(state.fetchedFrom);
    const fetchedTo = localDateTimeToIso(state.fetchedTo);
    if (
      fetchedFrom &&
      fetchedTo &&
      new Date(fetchedFrom).getTime() > new Date(fetchedTo).getTime()
    ) {
      stateStore.update((current) => ({
        ...current,
        listStatus: {
          message: tr(
            "configHistoryInvalidTimeRange",
            "Start time must not be later than end time",
          ),
          tone: "error",
        },
      }));
      return;
    }
    stateStore.update((current) => ({
      ...current,
      listStatus: { message: tr("loading", "Loading..."), tone: "info" },
    }));
    try {
      const response = await api.listDeviceConfigHistory({
        connectionName: state.connectionName,
        fetchedFrom,
        fetchedTo,
        kind: state.kind,
        limit: state.limit,
        sortOrder: state.sortOrder,
      });
      if (version !== listRequestVersion) return;
      const snapshots = Array.isArray(response?.snapshots)
        ? response.snapshots
        : [];
      const current = get(stateStore);
      const selectedId = snapshots.some(
        (snapshot) => snapshot.id === current.selectedId,
      )
        ? current.selectedId
        : "";
      if (!selectedId && current.selectedId) detailRequestVersion += 1;
      stateStore.update((current) => ({
        ...current,
        kinds: Array.isArray(response?.kinds) ? response.kinds : [],
        listStatus: null,
        selectedId,
        snapshots,
        ...(selectedId
          ? {}
          : { detail: null, detailOpen: false, detailStatus: null }),
      }));
    } catch (error) {
      if (version !== listRequestVersion) return;
      stateStore.update((current) => ({
        ...current,
        listStatus: { message: errorMessage(error), tone: "error" },
      }));
    }
  }

  async function refresh(): Promise<void> {
    await refreshDevices();
    if (get(stateStore).connectionName) await refreshHistory();
  }

  function selectDevice(connectionName: string): Promise<void> {
    deviceSelectionTouched = true;
    listRequestVersion += 1;
    detailRequestVersion += 1;
    stateStore.update((state) =>
      clearConfigHistoryState(state, String(connectionName || "").trim()),
    );
    return refreshHistory();
  }

  function updateHistoryQuery(patch: ConfigHistoryQueryPatch): Promise<void> {
    detailRequestVersion += 1;
    stateStore.update((state) => ({
      ...state,
      ...patch,
      detail: null,
      detailOpen: false,
      detailStatus: null,
      selectedId: "",
    }));
    return refreshHistory();
  }

  function setKind(kind: string): Promise<void> {
    return updateHistoryQuery({ kind });
  }

  function setFetchedFrom(fetchedFrom: string): Promise<void> {
    return updateHistoryQuery({ fetchedFrom });
  }

  function setFetchedTo(fetchedTo: string): Promise<void> {
    return updateHistoryQuery({ fetchedTo });
  }

  function clearTimeRange(): Promise<void> {
    return updateHistoryQuery({ fetchedFrom: "", fetchedTo: "" });
  }

  function setSortOrder(sortOrder: string): Promise<void> {
    if (sortOrder !== "asc" && sortOrder !== "desc") {
      return Promise.resolve();
    }
    return updateHistoryQuery({ sortOrder });
  }

  function setSearch(search: string): void {
    stateStore.update((state) => ({ ...state, search }));
  }

  function selectSnapshot(id: string): () => Promise<void> {
    return () => loadDetail(id);
  }

  function closeDetail(): void {
    detailRequestVersion += 1;
    stateStore.update((state) => ({
      ...state,
      detail: null,
      detailOpen: false,
      detailStatus: null,
    }));
  }

  function downloadSelected(): void {
    const state = get(stateStore);
    if (!state.detail) return;
    const content = state.detail.content;
    const safeName =
      `${state.detail.connection_name}-${state.detail.kind}-${state.detail.fetched_at}`
        .replace(/[^a-zA-Z0-9._-]+/g, "-")
        .replace(/^-+|-+$/g, "");
    downloadConfigHistoryFile(
      new Blob([content || ""], { type: "text/plain;charset=utf-8" }),
      `${safeName || "device-config"}.txt`,
    );
  }

  async function removeSelected(): Promise<void> {
    const id = get(stateStore).selectedId;
    if (!id) return;
    try {
      await api.deleteDeviceConfigSnapshot(id);
      stateStore.update((state) => ({
        ...state,
        detail: null,
        detailOpen: false,
        selectedId: "",
      }));
      await refreshHistory();
    } catch (error) {
      stateStore.update((state) => ({
        ...state,
        detailStatus: { message: errorMessage(error), tone: "error" },
      }));
    }
  }

  function setPageContext({ active }: { active: boolean }): Promise<void> {
    if (!active || activated) return Promise.resolve();
    activated = true;
    const preferredConnectionName = activeSavedDeviceName(
      latestActiveConnectionTarget,
    );
    stateStore.update((state) => ({
      ...state,
      connectionName: preferredConnectionName,
      preferredConnectionName,
    }));
    return refresh();
  }

  function destroy(): void {
    unsubscribeActiveConnectionTarget();
  }

  return {
    clearTimeRange,
    closeDetail,
    destroy,
    displayStateStore,
    downloadSelected,
    refresh,
    removeSelected,
    selectDevice,
    selectSnapshot,
    setFetchedFrom,
    setFetchedTo,
    setKind,
    setPageContext,
    setSearch,
    setSortOrder,
  };
}
