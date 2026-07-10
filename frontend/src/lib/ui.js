import { t, tr } from "./i18n.js";
import {
  browserConfirm,
  browserPrompt,
  downloadBrowserBlob,
  storageGet,
  storageSet,
  supportsNativeDialogElement,
} from "./browser.js";

function stringifyValue(value, fallback = "") {
  if (value == null) {
    return fallback;
  }
  if (typeof value === "string") {
    return value;
  }
  try {
    return JSON.stringify(value) ?? String(value);
  } catch (_) {
    return String(value);
  }
}

export function safeString(value) {
  return stringifyValue(value, "-");
}

export function emptyString(value) {
  return stringifyValue(value, "");
}

export function displayText(value) {
  return emptyString(value);
}

export function displayString(value, fallback = "") {
  return stringifyValue(value, fallback);
}

export function selectOptionsWithCurrent(optionValues = [], currentValue = "") {
  const rows = Array.isArray(optionValues) ? optionValues : [];
  const current = String(currentValue || "").trim();
  return current && !rows.includes(current) ? [current, ...rows] : rows;
}

export function valueTextOptionRows(optionRows = []) {
  const rows = Array.isArray(optionRows) ? optionRows : [];
  return rows.map((optionRow) => ({
    optionLabel: displayString(optionRow.labelText),
    optionValue: displayString(optionRow.valueText),
  }));
}

export function typeValueOptionRows(optionRows = [], placeholderText = "") {
  const rows = Array.isArray(optionRows) ? optionRows : [];
  const placeholderRows = placeholderText
    ? [{ optionLabel: displayString(placeholderText), optionValue: "" }]
    : [];
  return [
    ...placeholderRows,
    ...rows.map((optionRow) => ({
      optionLabel: displayString(optionRow.labelText),
      optionValue: displayString(optionRow.typeValue),
    })),
  ];
}

export function valueLabelOptionRows(optionRows = []) {
  const rows = Array.isArray(optionRows) ? optionRows : [];
  return rows.map((optionRow) => ({
    optionLabel: displayString(optionRow.label),
    optionValue: displayString(optionRow.value),
  }));
}

export function stringSelectOptionRows(
  optionValues = [],
  { includeEmptyOption = false, placeholderText = "" } = {},
) {
  const values = Array.isArray(optionValues) ? optionValues : [];
  const leadingRows =
    placeholderText || includeEmptyOption
      ? [{ optionLabel: displayString(placeholderText), optionValue: "" }]
      : [];
  return [
    ...leadingRows,
    ...values.map((optionValue) => ({
      optionLabel: displayString(optionValue),
      optionValue: displayString(optionValue),
    })),
  ];
}

export function classNames(...values) {
  return values.flat().filter(Boolean).join(" ");
}

export function borderedPillClass(...toneClasses) {
  return classNames(
    "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold",
    toneClasses,
  );
}

export function pillClass(...toneClasses) {
  return classNames(
    "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold",
    toneClasses,
  );
}

export function workflowChipClass(...toneClasses) {
  return classNames(
    "inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground",
    toneClasses,
  );
}

export function booleanPillPresentation(value) {
  if (value === true) {
    return {
      pillClassName: pillClass("bg-emerald-100 text-emerald-700"),
      text: "true",
    };
  }
  if (value === false) {
    return {
      pillClassName: pillClass("bg-rose-100 text-rose-700"),
      text: "false",
    };
  }
  return { pillClassName: "text-slate-500", text: "-" };
}

function statusCardToneClass(tone = "info") {
  if (tone === "error") return "border-rose-200 bg-rose-50 text-rose-700";
  if (tone === "success") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (tone === "warning") return "border-amber-200 bg-amber-50 text-amber-700";
  if (tone === "running") return "border-sky-200 bg-sky-50 text-sky-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

export function statusCardDisplay({
  extraClass = "",
  message = "",
  tone = "info",
  variant = "card",
} = {}) {
  const showAlert = variant === "alert";
  const alertClass = classNames(
    "flex items-start gap-2 rounded-lg border px-4 py-3 text-left text-sm",
    statusCardToneClass(tone),
  );
  return {
    cardClass: classNames(
      "rounded-xl border px-3 py-2 text-sm",
      statusCardToneClass(tone),
      extraClass,
    ),
    rootClass: showAlert ? classNames(alertClass, extraClass) : "",
    alertMessageText: displayString(message, "-"),
    messageText: displayText(message),
    showAlert,
    showLoadingSpinner: showAlert && tone === "running",
  };
}

export function detailFieldCardDisplay({
  badgeClass = "",
  extraClass = "",
  fallback = "-",
  labelClass = "",
  mono = false,
  value = "",
  valueClass = "",
  variant = "card",
} = {}) {
  if (variant === "inline") {
    return {
      cardClass: classNames("text-xs text-slate-600", extraClass),
      labelClass: "font-semibold",
      showInline: true,
      valueClass: classNames("break-all", mono ? "font-mono" : ""),
      valueText: displayString(value, fallback),
    };
  }

  const isMuted = variant === "muted";
  return {
    badgeClass: displayText(badgeClass),
    cardClass: classNames(
      isMuted
        ? "rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
        : "rounded-lg border border-slate-200 bg-white px-3 py-2",
      extraClass,
    ),
    labelClass:
      displayText(labelClass) || "text-[11px] font-semibold text-slate-500",
    showBadge: Boolean(badgeClass),
    showInline: false,
    valueClass: classNames(
      displayText(valueClass) ||
        (isMuted
          ? "mt-1 break-all text-xs text-slate-900"
          : classNames(
              "mt-1 break-all text-slate-800",
              mono ? "font-mono text-xs" : "text-sm",
            )),
    ),
    valueText: displayString(value, fallback),
  };
}

export function parsedOutputBlockFragmentDisplay(parsedOutputBlock = null) {
  const blockDisplay =
    parsedOutputBlock && typeof parsedOutputBlock === "object"
      ? parsedOutputBlock
      : {};
  const emptyStatusDisplay = {
    statusClass: "py-2 text-xs",
    variant: "alert",
  };
  return {
    canExport: Boolean(blockDisplay.canExport),
    emptyColumnsStatus: {
      ...emptyStatusDisplay,
      message: tr("textfsmNoParsedColumns"),
    },
    emptyRowsStatus: {
      ...emptyStatusDisplay,
      message: tr("textfsmNoParsedRows"),
    },
    exportExcelText: tr("textfsmExportExcel"),
    exportItem: blockDisplay.exportItem || null,
    hasParseError: Boolean(blockDisplay.hasParseError),
    hasParsedOutput: Boolean(blockDisplay.hasParsedOutput),
    jsonOutput: displayText(blockDisplay.jsonOutput),
    parseErrorStatus: {
      statusClass: "mt-3 items-start py-2 text-xs",
      tone: "warning",
      variant: "alert",
    },
    parseErrorTitle: tr("textfsmParseErrorTitle", "Parse Error"),
    parseErrorText: displayText(blockDisplay.parseErrorText),
    parseErrorTextClass:
      "mt-2 max-h-96 overflow-auto whitespace-pre-wrap break-all rounded-xl bg-amber-50/70 p-3 font-mono text-[11px] text-amber-900",
    parsedOutputTitle: tr("textfsmParsedOutputTitle", "Parsed Output"),
    showEmptyColumns: Boolean(blockDisplay.showEmptyColumns),
    showEmptyRows: Boolean(blockDisplay.showEmptyRows),
    showJson: Boolean(blockDisplay.showJson),
    showTable: Boolean(blockDisplay.showTable),
    tableColumns: Array.isArray(blockDisplay.tableColumns)
      ? blockDisplay.tableColumns
      : [],
    tableRows: Array.isArray(blockDisplay.tableRows)
      ? blockDisplay.tableRows
      : [],
  };
}

export function dashboardDrawerShellDisplay({
  ariaLabel = "",
  title = "",
} = {}) {
  return {
    ariaLabelText: displayString(ariaLabel, title),
  };
}

export function collapsibleGroupDisplay({
  bodyClass = "grid gap-3",
  collapsed = false,
  headerClass = "flex flex-wrap items-center justify-between gap-3",
  mounted = false,
  rootClass = "",
} = {}) {
  const bodyHidden = Boolean(mounted && collapsed);
  return {
    bodyClass,
    bodyHidden,
    buttonAriaExpandedText: collapsed ? "false" : "true",
    buttonLabelText: t(collapsed ? "expand" : "collapse"),
    headerClass,
    rootClass,
  };
}

export function presenceFieldControlDisplay({ controlClass = "" } = {}) {
  return {
    inputClassText: classNames(controlClass),
    selectClassText: classNames(controlClass),
  };
}

export function summaryMetricValueClass({ mono = false, size = "sm" } = {}) {
  return classNames(
    "mt-1 break-all font-semibold text-slate-900",
    mono ? "font-mono" : "",
    size === "lg" ? "text-lg" : "text-sm",
  );
}

export function summaryMetricCardDisplay({
  extraClass = "",
  labelClass = "",
  metricValueClass = "",
  mono = false,
  size = "sm",
} = {}) {
  return {
    cardClass:
      extraClass || "rounded-xl border border-slate-200 bg-slate-50 px-3 py-2",
    labelClassText: labelClass || "text-xs text-slate-500",
    valueClassText: metricValueClass || summaryMetricValueClass({ mono, size }),
  };
}

export function modalDialogDisplay(node) {
  return { useNativeDialog: supportsNativeDialogElement(node) };
}

export function tabListPresentation({
  activeValue = "",
  ariaLabel = "tabsAria",
  tabItems = [],
} = {}) {
  const activeText = displayText(activeValue);
  const tabRows = (Array.isArray(tabItems) ? tabItems : []).map((tabItem) => {
    const tabValue = tabItem && "value" in tabItem ? tabItem.value : "";
    const tabLabelKey =
      tabItem && "labelKey" in tabItem ? tabItem.labelKey : "";
    const tabLabel = tabItem && "label" in tabItem ? tabItem.label : "";
    const valueText = displayText(tabValue);
    const labelKey = displayString(tabLabelKey, valueText);
    return {
      active: activeText === valueText,
      ariaSelectedText: String(activeText === valueText),
      labelText: tr(labelKey, displayString(tabLabel, labelKey)),
      valueText,
    };
  });
  return {
    ariaLabelText: tr(ariaLabel, ariaLabel),
    tabRows,
  };
}

export function textfsmControlsDisplay({
  excelNamePlaceholderKey = "batchShowExcelNamePlaceholder",
  hintKey = "textfsmParseHint",
  platform = "",
  platformOptions = [],
} = {}) {
  const excelNamePlaceholder = tr(excelNamePlaceholderKey);
  const templatePlaceholder = tr("textfsmTemplatePlaceholder");
  return {
    excelNameField: {
      ariaLabelText: excelNamePlaceholder,
      placeholder: excelNamePlaceholder,
    },
    hintText: tr(hintKey),
    parseToggleLabel: tr("textfsmParseToggle"),
    platformOptionRows: selectOptionsWithCurrent(platformOptions, platform),
    platformSelectRows: stringSelectOptionRows(
      selectOptionsWithCurrent(platformOptions, platform),
      {
        includeEmptyOption: true,
        placeholderText: tr("textfsmPlatformPlaceholder"),
      },
    ),
    platformPlaceholder: tr("textfsmPlatformPlaceholder"),
    platformTitle: tr("textfsmPlatformOverride"),
    strictErrorsLabel: tr("textfsmStrictErrorsToggle"),
    templateField: {
      ariaLabelText: templatePlaceholder,
      placeholder: templatePlaceholder,
    },
  };
}

export function formatTimestamp(value) {
  const timestamp = Number(value);
  if (!Number.isFinite(timestamp) || timestamp <= 0) return "-";
  return new Date(timestamp).toLocaleString();
}

export function promptForResourceName(message, initialValue = "") {
  const result = browserPrompt(message, initialValue);
  if (result == null) return null;
  const normalized = result.trim();
  return normalized || null;
}

export function confirmUserChoice(message) {
  return browserConfirm(message);
}

export function splitCsvValues(rawValue) {
  return String(rawValue ?? "")
    .split(/[,\n]/)
    .map((csvValue) => csvValue.trim())
    .filter(Boolean);
}

export function displayMode(mode) {
  return String(mode || "").trim();
}

export function displayModePresentation(mode = "") {
  const normalized = mode === "raw" ? "raw" : "list";
  return {
    mode: normalized,
    showList: normalized === "list",
    showRaw: normalized === "raw",
  };
}

function collapsePreferenceStorageKey(persistenceKey = "") {
  const key = String(persistenceKey || "").trim();
  return key ? `rauto_collapse_${key}` : "";
}

export function readCollapsedPreference(persistenceKey = "") {
  const key = collapsePreferenceStorageKey(persistenceKey);
  return key ? storageGet(key) === "1" : false;
}

export function writeCollapsedPreference(persistenceKey = "", collapsed) {
  const key = collapsePreferenceStorageKey(persistenceKey);
  if (key) {
    storageSet(key, collapsed ? "1" : "0");
  }
}

export function isPassiveLoadedStatus(message, tone) {
  if (tone !== "info" && tone !== "success") return false;
  const text = safeString(message || "").trim();
  const loadedPrefix = safeString(tr("loaded", "loaded")).trim();
  if (!text || !loadedPrefix) return false;
  return text === loadedPrefix || text.startsWith(`${loadedPrefix}:`);
}

export function statusPresentation(message = "-", tone = "info", rules = {}) {
  const normalizedTone = tone || "info";
  const text = safeString(message || "").trim();
  const {
    inlineTone = "running",
    suppressPassiveLoaded = true,
    toastTones = ["success", "error", "warning"],
  } = rules;
  const passive =
    suppressPassiveLoaded && isPassiveLoadedStatus(text, normalizedTone);
  const meaningful = !!text && text !== "-";
  return {
    inlineMessage:
      meaningful && normalizedTone === inlineTone && !passive ? text : "",
    shouldToast: meaningful && !passive && toastTones.includes(normalizedTone),
    text,
    tone: normalizedTone,
  };
}

export function downloadBlob(blob, filename) {
  downloadBrowserBlob(blob, filename);
}
