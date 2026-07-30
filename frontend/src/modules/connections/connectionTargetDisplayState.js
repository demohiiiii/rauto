import { tr } from "../../lib/i18n.js";
import {
  displayString,
  safeString,
  selectOptionsWithCurrent,
  statusPresentation,
} from "../../lib/ui.js";
import { CONNECTION_PICKER } from "./connectionFieldStoreState.js";

function connectionStatusPresentation(status = null) {
  return statusPresentation(status?.message || "", status?.tone || "info", {
    suppressPassiveLoaded: false,
  });
}

function firstValue(values = []) {
  if (!Array.isArray(values)) return "";
  return displayString(values.find(Boolean) || "").trim();
}

function savedConnectionRowPresentation(connection = {}) {
  const name = safeString(connection.name || "").trim();
  const host = safeString(connection.host || "-").trim() || "-";
  const port = Number(connection.port || 22) || 22;
  const credentialRequired = connection.credential_required === true;
  const credentialName = credentialRequired
    ? tr("connCredentialNone", "未选择凭证")
    : safeString(connection.credential_name || "").trim() ||
      tr("connCredentialNone", "未选择凭证");
  const profile =
    safeString(connection.device_profile || "autodetect").trim() ||
    "autodetect";
  const deviceModel = safeString(connection.device_model || "").trim();
  const softwareVersion = safeString(connection.software_version || "").trim();
  const tag =
    firstValue(connection.labels) ||
    firstValue(connection.groups) ||
    safeString(connection.group || connection.label || "").trim();
  const enabled = connection.enabled !== false;
  const statusLabel = enabled
    ? tr("connStatusEnabled", "在线")
    : tr("connStatusDisabled", "停用");
  return {
    enabled,
    deviceModel,
    host,
    name,
    port,
    profile,
    searchText: [
      name,
      credentialName,
      host,
      String(port),
      profile,
      deviceModel,
      softwareVersion,
      tag,
      statusLabel,
    ]
      .join(" ")
      .toLowerCase(),
    statusLabel,
    statusTone: enabled ? "primary" : "muted",
    softwareVersion,
    summary: `${credentialName} · ${host}:${port}`,
    tag: tag || tr("connUngrouped", "未分组"),
    credentialName,
    credentialRequired,
  };
}

function normalizeConnectionModalDisplayMode(mode = "") {
  return mode === "temporary" ? "temporary" : "saved";
}

function connectionModalPresentation(mode = "") {
  const normalizedMode = normalizeConnectionModalDisplayMode(mode);
  const title = tr("connectionTitle");
  return {
    activeMode: normalizedMode,
    closeText: tr("close"),
    showSaved: normalizedMode === "saved",
    showTemporary: normalizedMode === "temporary",
    subtitle: tr(
      normalizedMode === "temporary"
        ? "connectionWorkspaceSubtitleTemporary"
        : "connectionWorkspaceSubtitleManage",
    ),
    testButtonLabel: tr("connectionTestBtn"),
    title,
  };
}

export function connectionModalDisplay(overlayState = {}) {
  return {
    ...connectionModalPresentation(overlayState.modalMode),
    open: !!overlayState.modalOpen,
  };
}

export function savedConnectionEditModalDisplay(overlayState = {}) {
  const title = tr("savedConnEditTitle");
  return {
    ariaLabelText: title,
    closeText: tr("close"),
    open: !!overlayState.savedEditorOpen,
    subtitle: tr("savedConnEditHint"),
    title,
  };
}

export function savedConnectionLibraryPresentation(
  selectState = {},
  statusState = null,
) {
  const placeholder = tr("savedConnSelectPlaceholder");
  const status = connectionStatusPresentation(statusState);
  const selected = selectState.selected || "";
  const connectionRows = Array.isArray(selectState.connections)
    ? selectState.connections.map(savedConnectionRowPresentation)
    : [];
  const selectedConnectionRow =
    connectionRows.find((connectionRow) => connectionRow.name === selected) ||
    connectionRows[0] ||
    null;
  return {
    buttons: {
      delete: { label: tr("savedConnDeleteBtn"), loadingKey: "delete" },
      edit: { label: tr("savedConnEditBtn"), loadingKey: "edit" },
      template: { label: tr("savedConnTemplateBtn"), loadingKey: "template" },
      use: { label: tr("savedConnUseBtn"), loadingKey: "use" },
    },
    importAccept:
      ".csv,.xlsx,.xls,.xlsm,.xlsb,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    importLabel: tr("savedConnImportBtn"),
    connectionRows,
    select: {
      optionRows: [
        { optionLabel: placeholder, optionValue: "" },
        ...selectOptionsWithCurrent(selectState.options, selected).map(
          (connectionName) => ({
            optionLabel: connectionName,
            optionValue: connectionName,
          }),
        ),
      ],
      placeholder,
      selected,
    },
    selectedConnectionRow,
    status,
    showStatus: !!status.text,
    subtitle: tr("savedConnSubtitle"),
    title: tr("savedConnTitle"),
  };
}

export function savedConnectionEditorPresentation(
  statusState = null,
  autodetectState = {},
) {
  const status = connectionStatusPresentation(statusState);
  const autodetect = connectionAutodetectPresentation(autodetectState);
  return {
    ...autodetect,
    buttons: {
      cancel: { label: tr("cancel") },
      ...autodetect.buttons,
      save: { label: tr("savedConnSaveBtn"), loadingKey: "save" },
    },
    description: tr("savedConnEditHint"),
    fields: {
      ...autodetect.fields,
      enabled: tr("inventoryFieldEnabled"),
      name: tr("inventoryFieldName"),
    },
    showStatus: !!status.text,
    status,
  };
}

function connectionAutodetectPresentation(autodetectState = {}) {
  const detectedProfile = safeString(
    autodetectState?.detectedProfile || "",
  ).trim();
  const detectedModel = safeString(autodetectState?.detectedModel || "").trim();
  const detectedVersion = safeString(
    autodetectState?.detectedVersion || "",
  ).trim();
  const warning = safeString(autodetectState?.warning || "").trim();
  return {
    buttons: {
      detectProfile: {
        label: tr("savedConnAutodetectFactsBtn"),
        loadingKey: "detect-profile",
      },
    },
    detectedModel,
    detectedProfile,
    detectedVersion,
    detectedProfileLabel: tr("savedConnAutodetectDetected"),
    detectedModelLabel: tr("savedConnAutodetectModel"),
    detectedVersionLabel: tr("savedConnAutodetectVersion"),
    fields: {
      deviceInfo: tr("savedConnDeviceInfoTitle"),
      deviceInfoHint: tr("savedConnDeviceInfoHint"),
      deviceModel: tr("deviceModelLabel"),
      softwareVersion: tr("softwareVersionLabel"),
    },
    warning,
  };
}

export function temporaryConnectionPanelPresentation(
  statusState = null,
  autodetectState = {},
) {
  const status = connectionStatusPresentation(statusState);
  const autodetect = connectionAutodetectPresentation(autodetectState);
  return {
    ...autodetect,
    buttons: {
      apply: { label: tr("connectionTempApplyBtn") },
      createDraft: { label: tr("newBtn") },
      ...autodetect.buttons,
    },
    enabledLabel: tr("inventoryFieldEnabled"),
    help: tr("connectionHelp"),
    hint: tr("connectionTempHint"),
    showStatus: !!status.text,
    status,
    title: tr("connectionQuickTitle"),
  };
}

export function temporaryConnectionFocusDisplay({
  active = false,
  focusRequest = {},
  target = "",
} = {}) {
  return {
    hostFocusRequestVersion:
      active && focusRequest.target === target ? focusRequest.version || 0 : 0,
  };
}

function sidebarConnectionSummary(card = null) {
  if (!card) return "";
  if (card.credentialName) {
    return `${card.credentialName} · ${card.host}:${card.port}`;
  }
  return `${card.host}:${card.port}`;
}

export function sidebarConnectionPresentation(sidebar = {}) {
  const card = sidebar.card || null;
  const errorMessage = sidebar.errorMessage || "";
  const isTemporary = card?.kind === "temporary";
  const hasCard = Boolean(card);
  return {
    badgeLabel: isTemporary
      ? tr("sidebarConnectionTemporaryBadge")
      : tr("sidebarConnectionSavedBadge"),
    contextLabel: isTemporary
      ? tr("sidebarConnectionTemporaryLabel")
      : card?.name || "",
    emptyContextText: tr("sidebarConnectionOptionNone"),
    emptyNameText: tr("sidebarConnectionNoneHint"),
    errorMessage,
    hasCard,
    helpLabel: tr("sidebarConnectionHint"),
    openButtonLabel: tr("sidebarConnectionOpenBtn"),
    profile: card?.profile || "",
    showError: Boolean(errorMessage),
    showSavedIcon: !isTemporary,
    showTemporaryIcon: isTemporary,
    statusLabel: tr("sidebarConnectionConnectedBadge"),
    summary: sidebarConnectionSummary(card),
    title: tr("sidebarConnectionTitle"),
  };
}

export const batchShowTargetPickerFields = Object.freeze([
  {
    key: "targets",
    keyName: CONNECTION_PICKER.batchShowTargets,
    labelKey: "batchShowTargetsLabel",
    placeholderKey: "batchShowTargetsPlaceholder",
  },
  {
    key: "groups",
    keyName: CONNECTION_PICKER.batchShowGroups,
    labelKey: "batchShowGroupsLabel",
    placeholderKey: "batchShowGroupsPlaceholder",
  },
  {
    key: "labels",
    keyName: CONNECTION_PICKER.batchShowLabels,
    labelKey: "batchShowLabelsLabel",
    placeholderKey: "batchShowLabelsPlaceholder",
  },
]);

export const batchExecTargetPickerFields = Object.freeze([
  {
    key: "targets",
    keyName: CONNECTION_PICKER.batchExecTargets,
    labelKey: "batchShowTargetsLabel",
    placeholderKey: "batchShowTargetsPlaceholder",
  },
  {
    key: "groups",
    keyName: CONNECTION_PICKER.batchExecGroups,
    labelKey: "batchShowGroupsLabel",
    placeholderKey: "batchShowGroupsPlaceholder",
  },
  {
    key: "labels",
    keyName: CONNECTION_PICKER.batchExecLabels,
    labelKey: "batchShowLabelsLabel",
    placeholderKey: "batchShowLabelsPlaceholder",
  },
]);

export const batchFlowTargetPickerFields = Object.freeze([
  {
    key: "targets",
    keyName: CONNECTION_PICKER.batchFlowTargets,
    labelKey: "batchShowTargetsLabel",
    placeholderKey: "batchShowTargetsPlaceholder",
  },
  {
    key: "groups",
    keyName: CONNECTION_PICKER.batchFlowGroups,
    labelKey: "batchShowGroupsLabel",
    placeholderKey: "batchShowGroupsPlaceholder",
  },
  {
    key: "labels",
    keyName: CONNECTION_PICKER.batchFlowLabels,
    labelKey: "batchShowLabelsLabel",
    placeholderKey: "batchShowLabelsPlaceholder",
  },
]);

export const configFetchTargetPickerFields = Object.freeze([
  {
    key: "targets",
    keyName: CONNECTION_PICKER.configFetchTargets,
    labelKey: "batchShowTargetsLabel",
    placeholderKey: "batchShowTargetsPlaceholder",
  },
  {
    key: "groups",
    keyName: CONNECTION_PICKER.configFetchGroups,
    labelKey: "batchShowGroupsLabel",
    placeholderKey: "batchShowGroupsPlaceholder",
  },
  {
    key: "labels",
    keyName: CONNECTION_PICKER.configFetchLabels,
    labelKey: "batchShowLabelsLabel",
    placeholderKey: "batchShowLabelsPlaceholder",
  },
]);

export const CONNECTION_MODAL_FOCUS_TARGET = Object.freeze({
  savedConnectionSelect: "savedConnectionSelect",
  temporaryHostInput: "temporaryHostInput",
});
