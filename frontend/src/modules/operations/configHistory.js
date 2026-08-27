import {
  deleteDeviceConfigSnapshot,
  getDeviceConfigSnapshot,
  listConnections,
  listDeviceConfigHistory,
  listDeviceConfigHistoryDevices,
} from "../../api/client.js";
import { currentLanguageState, tr } from "../../lib/i18n.js";
import { downloadBlob } from "../../lib/ui.js";
import {
  activeConnectionTarget,
  connectionTargetState,
} from "../connections/connectionTargetStoreState.js";
import { derived, get, writable } from "svelte/store";

const defaultApi = {
  deleteDeviceConfigSnapshot,
  getDeviceConfigSnapshot,
  listConnections,
  listDeviceConfigHistory,
  listDeviceConfigHistoryDevices,
};

function initialState(preferredConnectionName = "") {
  return {
    connectionName: preferredConnectionName,
    detail: null,
    detailOpen: false,
    detailStatus: null,
    devices: [],
    deviceStatus: null,
    fetchedFrom: "",
    fetchedTo: "",
    kind: "",
    kinds: [],
    limit: 100,
    listStatus: null,
    preferredConnectionName,
    search: "",
    selectedId: "",
    snapshots: [],
    sortOrder: "desc",
  };
}

function formatTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function formatBytes(value) {
  const bytes = Number(value) || 0;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function localDateTimeToIso(value) {
  const input = String(value || "").trim();
  if (!input) return "";
  const date = new Date(input);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function changePresentation(snapshot) {
  if (snapshot.changed_from_previous === true) {
    return {
      label: tr("configHistoryChanged", "Changed"),
      variant: "destructive",
    };
  }
  if (snapshot.changed_from_previous === false) {
    return {
      label: tr("configHistoryUnchanged", "Unchanged"),
      variant: "secondary",
    };
  }
  return {
    label: tr("configHistoryBaseline", "Baseline"),
    variant: "outline",
  };
}

function sourceLabel(source) {
  if (source === "cron") return tr("configHistorySourceCron", "Scheduled");
  if (source === "agent_task") {
    return tr("configHistorySourceAgent", "Agent task");
  }
  return tr("configHistorySourceManual", "Manual");
}

function optionRows(values, placeholder) {
  return [
    { optionLabel: placeholder, optionValue: "" },
    ...values.map((value) => ({ optionLabel: value, optionValue: value })),
  ];
}

export function activeSavedDeviceName(target = {}) {
  if (target.kind !== "saved") return "";
  return String(target.details?.name || "").trim();
}

export function prioritizeConfigHistoryDevices(
  devices = [],
  preferredConnectionName = "",
) {
  const preferred = String(preferredConnectionName || "").trim();
  return (Array.isArray(devices) ? devices : [])
    .filter((device) => String(device?.name || "").trim())
    .map((device) => ({ ...device, name: String(device.name).trim() }))
    .sort((left, right) => {
      const leftPreferred = left.name === preferred;
      const rightPreferred = right.name === preferred;
      if (leftPreferred !== rightPreferred) return leftPreferred ? -1 : 1;
      return left.name.localeCompare(right.name);
    });
}

export function mergeConfigHistoryDevices(
  connections = [],
  historyDevices = [],
) {
  const devicesByName = new Map();
  for (const device of [historyDevices, connections].flat()) {
    const name = String(device?.name || "").trim();
    if (!name) continue;
    devicesByName.set(name, { ...devicesByName.get(name), ...device, name });
  }
  return [...devicesByName.values()];
}

function presentation(state) {
  const query = state.search.trim().toLocaleLowerCase();
  const snapshots = query
    ? state.snapshots.filter((snapshot) =>
        [
          snapshot.connection_name,
          snapshot.host,
          snapshot.profile,
          snapshot.kind,
          snapshot.sha256,
        ].some((value) =>
          String(value || "")
            .toLocaleLowerCase()
            .includes(query),
        ),
      )
    : state.snapshots;
  const detail = state.detail;
  const devices = prioritizeConfigHistoryDevices(
    state.devices,
    state.preferredConnectionName,
  );
  return {
    ...state,
    deviceRows: devices.map((device) => ({
      ...device,
      active: device.name === state.connectionName,
      preferred: device.name === state.preferredConnectionName,
    })),
    hasSelectedDevice: Boolean(state.connectionName),
    kindOptions: optionRows(
      state.kinds,
      tr("configHistoryAllKinds", "All configuration types"),
    ),
    selectedDevice:
      devices.find((device) => device.name === state.connectionName) || null,
    snapshotRows: snapshots.map((snapshot) => ({
      ...snapshot,
      active: snapshot.id === state.selectedId,
      change: changePresentation(snapshot),
      fetchedAtText: formatTime(snapshot.fetched_at),
      sizeText: formatBytes(snapshot.content_size_bytes),
    })),
    detailDisplay: detail
      ? {
          ...detail,
          change: changePresentation(detail),
          fetchedAtText: formatTime(detail.fetched_at),
          hasDetail: true,
          sizeText: formatBytes(detail.content_size_bytes),
          sourceText: sourceLabel(detail.source),
        }
      : { content: "", hasDetail: false },
  };
}

export function createConfigHistoryWorkspace(options = {}) {
  const api = { ...defaultApi, ...(options.api || {}) };
  const getActiveConnectionTarget =
    options.getActiveConnectionTarget || activeConnectionTarget;
  const activeConnectionTargetStore = Object.hasOwn(
    options,
    "activeConnectionTargetStore",
  )
    ? options.activeConnectionTargetStore
    : options.getActiveConnectionTarget
      ? null
      : connectionTargetState;
  const stateStore = writable(initialState());
  const displayStateStore = derived(
    [stateStore, currentLanguageState],
    ([$state]) => presentation($state),
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
          ...clearHistoryState(state, preferredConnectionName),
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

  async function loadDetail(id) {
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
        detailStatus: { message: error.message, tone: "error" },
      }));
    }
  }

  function clearHistoryState(state, connectionName = state.connectionName) {
    return {
      ...state,
      connectionName,
      detail: null,
      detailOpen: false,
      detailStatus: null,
      fetchedFrom: "",
      fetchedTo: "",
      kind: "",
      kinds: [],
      listStatus: null,
      search: "",
      selectedId: "",
      snapshots: [],
      sortOrder: "desc",
    };
  }

  async function refreshDevices() {
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
        ...(connectionName ? state : clearHistoryState(state, connectionName)),
        devices,
        deviceStatus: null,
      }));
    } catch (error) {
      if (version !== deviceRequestVersion) return;
      stateStore.update((state) => ({
        ...state,
        deviceStatus: { message: error.message, tone: "error" },
      }));
    }
  }

  async function refreshHistory() {
    const version = ++listRequestVersion;
    const state = get(stateStore);
    if (!state.connectionName) {
      detailRequestVersion += 1;
      stateStore.update((current) => clearHistoryState(current, ""));
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
        listStatus: { message: error.message, tone: "error" },
      }));
    }
  }

  async function refresh() {
    await refreshDevices();
    if (get(stateStore).connectionName) await refreshHistory();
  }

  function selectDevice(connectionName) {
    deviceSelectionTouched = true;
    listRequestVersion += 1;
    detailRequestVersion += 1;
    stateStore.update((state) =>
      clearHistoryState(state, String(connectionName || "").trim()),
    );
    return refreshHistory();
  }

  function setKind(kind) {
    return updateHistoryQuery({ kind });
  }

  function updateHistoryQuery(patch) {
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

  function setFetchedFrom(fetchedFrom) {
    return updateHistoryQuery({ fetchedFrom });
  }

  function setFetchedTo(fetchedTo) {
    return updateHistoryQuery({ fetchedTo });
  }

  function clearTimeRange() {
    return updateHistoryQuery({ fetchedFrom: "", fetchedTo: "" });
  }

  function setSortOrder(sortOrder) {
    if (sortOrder !== "asc" && sortOrder !== "desc") return Promise.resolve();
    return updateHistoryQuery({ sortOrder });
  }

  function setSearch(search) {
    stateStore.update((state) => ({ ...state, search }));
  }

  function selectSnapshot(id) {
    return () => loadDetail(id);
  }

  function closeDetail() {
    detailRequestVersion += 1;
    stateStore.update((state) => ({
      ...state,
      detail: null,
      detailOpen: false,
      detailStatus: null,
    }));
  }

  function downloadSelected() {
    const state = get(stateStore);
    if (!state.detail) return;
    const content = state.detail.content;
    const safeName =
      `${state.detail.connection_name}-${state.detail.kind}-${state.detail.fetched_at}`
        .replace(/[^a-zA-Z0-9._-]+/g, "-")
        .replace(/^-+|-+$/g, "");
    downloadBlob(
      new Blob([content || ""], { type: "text/plain;charset=utf-8" }),
      `${safeName || "device-config"}.txt`,
    );
  }

  async function removeSelected() {
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
        detailStatus: { message: error.message, tone: "error" },
      }));
    }
  }

  function setPageContext({ active }) {
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

  function destroy() {
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
