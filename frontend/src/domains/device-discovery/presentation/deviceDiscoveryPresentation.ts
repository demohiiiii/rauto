import { tr } from "../../../lib/i18n.js";
import {
  discoveryResultCanImport,
  discoveryResultKey,
  discoveryResultStatus,
  discoveryRunIsActive,
  filterDiscoveryResults,
} from "../model/deviceDiscovery.js";
import type {
  DeviceDiscoveryDisplayState,
  DeviceDiscoveryState,
  DiscoveryOption,
} from "../model/types.js";

function statusFilterOptions(): DiscoveryOption[] {
  return [
    { value: "all", label: tr("deviceDiscoveryStatusAll") },
    {
      value: "identified",
      label: tr("deviceDiscoveryStatus_identified"),
    },
    { value: "existing", label: tr("deviceDiscoveryStatus_existing") },
    { value: "imported", label: tr("deviceDiscoveryStatus_imported") },
    { value: "reachable", label: tr("deviceDiscoveryStatus_reachable") },
    {
      value: "probe_failed",
      label: tr("deviceDiscoveryStatus_probe_failed"),
    },
    { value: "not_ssh", label: tr("deviceDiscoveryStatus_not_ssh") },
    {
      value: "unreachable",
      label: tr("deviceDiscoveryStatus_unreachable"),
    },
    { value: "cancelled", label: tr("deviceDiscoveryStatus_cancelled") },
  ];
}

export function deviceDiscoveryPresentation(
  state: DeviceDiscoveryState,
): DeviceDiscoveryDisplayState {
  const currentRun = state.currentDetail?.run || null;
  const results = state.currentDetail?.results || [];
  const importableResults = results.filter(discoveryResultCanImport);
  const selectedImportableResults = importableResults.filter((result) =>
    state.selectedResultKeys.includes(discoveryResultKey(result)),
  );
  const options = statusFilterOptions();
  const progressPercent =
    currentRun?.status === "completed"
      ? 100
      : currentRun?.phase === "ssh_probe" && currentRun.reachable_count
        ? Math.min(
            100,
            Math.round(
              (Number(currentRun.probed_targets || 0) /
                Number(currentRun.reachable_count)) *
                100,
            ),
          )
        : currentRun?.total_targets
          ? Math.min(
              100,
              Math.round(
                (Number(currentRun.scanned_targets || 0) /
                  Number(currentRun.total_targets)) *
                  100,
              ),
            )
          : 0;
  return {
    ...state,
    activeStatusFilterLabel:
      options.find((option) => option.value === state.statusFilter)?.label ||
      tr("deviceDiscoveryStatusAll"),
    credentialOptions: state.credentials.map((credential) => ({
      label: `${credential.name} · ${credential.username}`,
      value: credential.id,
    })),
    currentRun,
    filteredResults: filterDiscoveryResults(
      results,
      state.resultFilter,
      state.resultSearch,
      state.statusFilter,
    ),
    groupOptions: state.groups.map((group) => ({
      label: group.name,
      value: group.name,
    })),
    identifiedResultCount: results.filter(
      (result) => discoveryResultStatus(result) === "identified",
    ).length,
    importableResults,
    labelOptions: state.labels.map((label) => ({
      label: label.name,
      value: label.name,
    })),
    progressPercent,
    results,
    runActive: discoveryRunIsActive(currentRun || {}),
    selectedImportableResults,
    statusFilterOptions: options,
  };
}
