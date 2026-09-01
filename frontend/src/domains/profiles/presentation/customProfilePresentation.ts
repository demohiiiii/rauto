import { t, tr } from "../../../lib/i18n.js";
import { safeString } from "../../../lib/ui.js";
import {
  normalizeCommandExecutionConfig,
  recordValue,
} from "../model/customProfileForm.js";

const COMMAND_EXECUTION_MODE_OPTIONS = Object.freeze([
  ["prompt_driven", "commandExecutionModePromptDriven"],
  ["shell_exit_status", "commandExecutionModeShellExitStatus"],
]);

function commandExecutionModeOptionRows() {
  return COMMAND_EXECUTION_MODE_OPTIONS.map(([valueText, labelKey]) => ({
    labelText: tr(labelKey),
    valueText,
  }));
}

export function customProfileSettingsDisplay(
  baseState: unknown = {},
  optionsState: unknown = {},
) {
  const base = recordValue(baseState);
  const options = recordValue(optionsState);
  const commandExecution = normalizeCommandExecutionConfig(
    base.commandExecution,
  );
  return {
    commandExecutionMarker: safeString(commandExecution.marker || ""),
    commandExecutionMarkerPlaceholder: tr("commandExecutionMarkerPlaceholder"),
    commandExecutionMode: safeString(commandExecution.mode || "prompt_driven"),
    commandExecutionModeOptionRows: commandExecutionModeOptionRows(),
    commandExecutionTitle: tr("commandExecutionTitle"),
    deleteButtonLabel: tr("profileDeleteBtn"),
    newButtonLabel: tr("newBtn"),
    profileNames: Array.isArray(options.names) ? options.names : [],
    saveButtonLabel: tr("profileSaveBtn"),
    selectPlaceholder: tr("customProfileSelectPlaceholder"),
    selectedProfileName: safeString(base.name || ""),
    showShellExitMarker: commandExecution.showShellExitMarker,
  };
}

export function customProfileNameRequiredError(): string {
  return t("profileNameRequired");
}

export function customProfileRunningText(): string {
  return t("running");
}
