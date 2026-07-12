import { tr } from "../lib/i18n.js";
import {
  displayString,
  safeString,
  selectOptionsWithCurrent,
  statusPresentation,
} from "../lib/ui.js";
import { CONNECTION_PICKER } from "./connectionFields.js";

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
  const username = safeString(connection.username || "-").trim() || "-";
  const profile =
    safeString(connection.device_profile || "autodetect").trim() ||
    "autodetect";
  const tag =
    firstValue(connection.labels) ||
    firstValue(connection.groups) ||
    safeString(connection.group || connection.label || "").trim();
  const enabled = connection.enabled !== false;
  const statusLabel = enabled ? "在线" : "停用";
  return {
    enabled,
    host,
    name,
    port,
    profile,
    searchText: [name, username, host, String(port), profile, tag, statusLabel]
      .join(" ")
      .toLowerCase(),
    statusLabel,
    statusTone: enabled ? "primary" : "muted",
    summary: `${username}@${host}:${port}`,
    tag: tag || "未分组",
    username,
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
  const canApplyDetectedProfile = !!autodetectState?.canApply;
  const detectedProfile = safeString(
    autodetectState?.detectedProfile || "",
  ).trim();
  return {
    buttons: {
      applyDetectedProfile: {
        label: tr("savedConnAutodetectReplaceBtn"),
        loadingKey: "apply-detected-profile",
      },
      cancel: { label: tr("cancel") },
      detectProfile: {
        label: tr("savedConnAutodetectBtn"),
        loadingKey: "detect-profile",
      },
      save: { label: tr("savedConnSaveBtn"), loadingKey: "save" },
    },
    canApplyDetectedProfile,
    detectedProfile,
    detectedProfileLabel: tr("savedConnAutodetectDetected"),
    fields: {
      enabled: tr("inventoryFieldEnabled"),
      name: tr("inventoryFieldName"),
    },
    showStatus: !!status.text,
    status,
  };
}

export function temporaryConnectionPanelPresentation(statusState = null) {
  const status = connectionStatusPresentation(statusState);
  return {
    buttons: {
      apply: { label: tr("connectionTempApplyBtn") },
      createDraft: { label: tr("newBtn") },
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
  if (card.username && card.username !== "-") {
    return `${card.username}@${card.host}:${card.port}`;
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

export const CONNECTION_MODAL_FOCUS_TARGET = Object.freeze({
  savedConnectionSelect: "savedConnectionSelect",
  temporaryHostInput: "temporaryHostInput",
});
