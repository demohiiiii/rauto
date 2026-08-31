import { tr } from "../../../lib/i18n.js";
import { prioritizeConfigHistoryDevices } from "../model/configHistory.js";
import type {
  ChangePresentation,
  ConfigHistoryDisplayState,
  ConfigHistoryState,
  DeviceConfigSnapshotSummary,
  SelectOption,
} from "../model/types.js";

function formatTime(value?: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function formatBytes(value?: number | null): string {
  const bytes = Number(value) || 0;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function changePresentation(
  snapshot: DeviceConfigSnapshotSummary,
): ChangePresentation {
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

function sourceLabel(source?: string | null): string {
  if (source === "cron") return tr("configHistorySourceCron", "Scheduled");
  if (source === "agent_task") {
    return tr("configHistorySourceAgent", "Agent task");
  }
  return tr("configHistorySourceManual", "Manual");
}

function optionRows(values: string[], placeholder: string): SelectOption[] {
  return [
    { optionLabel: placeholder, optionValue: "" },
    ...values.map((value) => ({ optionLabel: value, optionValue: value })),
  ];
}

export function configHistoryPresentation(
  state: ConfigHistoryState,
): ConfigHistoryDisplayState {
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
