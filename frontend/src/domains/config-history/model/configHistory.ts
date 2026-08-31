import type {
  ConfigHistoryDevice,
  ConfigHistoryDeviceInput,
  ConfigHistoryState,
  ConnectionTarget,
} from "./types.js";

export function newConfigHistoryState(
  preferredConnectionName = "",
): ConfigHistoryState {
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

export function clearConfigHistoryState(
  state: ConfigHistoryState,
  connectionName = state.connectionName,
): ConfigHistoryState {
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

export function localDateTimeToIso(value: unknown): string {
  const input = String(value || "").trim();
  if (!input) return "";
  const date = new Date(input);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

export function activeSavedDeviceName(
  target: ConnectionTarget | null | undefined = {},
): string {
  if (target?.kind !== "saved") return "";
  return String(target.details?.name || "").trim();
}

function normalizedDevice(
  device: ConfigHistoryDeviceInput | null | undefined,
): ConfigHistoryDevice | null {
  const name = String(device?.name || "").trim();
  if (!device || !name) return null;
  return { ...device, name } as ConfigHistoryDevice;
}

export function prioritizeConfigHistoryDevices(
  devices: readonly (ConfigHistoryDeviceInput | null | undefined)[] | null = [],
  preferredConnectionName = "",
): ConfigHistoryDevice[] {
  const preferred = String(preferredConnectionName || "").trim();
  return (Array.isArray(devices) ? devices : [])
    .map(normalizedDevice)
    .filter((device): device is ConfigHistoryDevice => Boolean(device))
    .sort((left, right) => {
      const leftPreferred = left.name === preferred;
      const rightPreferred = right.name === preferred;
      if (leftPreferred !== rightPreferred) return leftPreferred ? -1 : 1;
      return left.name.localeCompare(right.name);
    });
}

export function mergeConfigHistoryDevices(
  connections:
    | readonly (ConfigHistoryDeviceInput | null | undefined)[]
    | null = [],
  historyDevices:
    | readonly (ConfigHistoryDeviceInput | null | undefined)[]
    | null = [],
): ConfigHistoryDevice[] {
  const devicesByName = new Map<string, ConfigHistoryDevice>();
  const candidates = [
    ...(Array.isArray(historyDevices) ? historyDevices : []),
    ...(Array.isArray(connections) ? connections : []),
  ];
  for (const candidate of candidates) {
    const device = normalizedDevice(candidate);
    if (!device) continue;
    devicesByName.set(device.name, {
      ...devicesByName.get(device.name),
      ...device,
    });
  }
  return [...devicesByName.values()];
}
