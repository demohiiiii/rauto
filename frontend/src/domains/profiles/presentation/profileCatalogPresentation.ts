import { tr } from "../../../lib/i18n.js";
import { safeString, statusPresentation } from "../../../lib/ui.js";
import {
  normalizePromptMode,
  PROMPT_MODE,
} from "../../../config/dashboardModes.js";
import { profileValues } from "../model/profileEditor.js";
import { recordValue } from "../model/customProfileForm.js";

export const promptModePresentation = (mode = "") => ({
  builtinActive: normalizePromptMode(mode) === PROMPT_MODE.builtin,
  diagnoseActive: normalizePromptMode(mode) === PROMPT_MODE.diagnose,
  editActive: false,
  profilesActive: normalizePromptMode(mode) === PROMPT_MODE.builtin,
});

function profileStatusDisplay(statusValue: unknown = {}) {
  const statusState = recordValue(statusValue);
  const status = statusPresentation(
    safeString(statusState.message || ""),
    safeString(statusState.tone || "info"),
    { suppressPassiveLoaded: false },
  );
  return {
    message: status.text,
    show: !!status.text && status.text !== "-",
    tone: status.tone,
  };
}

export function promptProfilesPagePresentation(statusState: unknown = {}) {
  return {
    customTitle: tr("customTitle"),
    customStatus: profileStatusDisplay(statusState),
    hooksHint: tr("profileHooksHint"),
    hooksTitle: tr("labelHooks"),
    tabAriaLabel: tr("promptProfilesTitle"),
  };
}

export function promptProfilesPageDisplay(
  mode = "",
  statusState: unknown = {},
) {
  return {
    ...promptModePresentation(mode),
    ...promptProfilesPagePresentation(statusState),
  };
}

const COMMAND_EXECUTION_MODE_OPTIONS = Object.freeze([
  ["prompt_driven", "commandExecutionModePromptDriven"],
  ["shell_exit_status", "commandExecutionModeShellExitStatus"],
]);

function builtinProfileDetailsPresentation(simpleSectionsValue: unknown) {
  return {
    commandExecutionMarkerPlaceholder: tr("commandExecutionMarkerPlaceholder"),
    commandExecutionModeOptionRows: COMMAND_EXECUTION_MODE_OPTIONS.map(
      ([valueText, labelKey]) => ({ labelText: tr(labelKey), valueText }),
    ),
    commandExecutionTitle: tr("commandExecutionTitle"),
    configurationDescription: tr("profileConfigurationDescription"),
    configurationTitle: tr("profileConfigurationTitle"),
    detectDescription: tr("profileBuiltinDetectDescription"),
    fieldPlaceholders: {
      aliases: tr("builtinFieldAliases"),
      name: tr("builtinFieldName"),
      source: tr("builtinFieldSource"),
      summary: tr("builtinFieldSummary"),
    },
    hooksDescription: tr("profileHooksDescription"),
    notesPlaceholder: tr("builtinFieldNotes"),
    overviewDescription: tr("profileOverviewDescription"),
    overviewTitle: tr("profileOverviewTitle"),
    readonlyHint: tr("profileReadonlyHint"),
    rulesEmpty: tr("profileRulesEmpty"),
    simpleSections: profileValues(simpleSectionsValue).map((sectionValue) => {
      const section = recordValue(sectionValue);
      return {
        ...section,
        titleText: tr(safeString(section.i18nKey), safeString(section.title)),
      };
    }),
  };
}

export function builtinProfilesPanelDisplay({
  detailState = {},
  overviewState = {},
  readonlyDisplay = {},
  statusState = {},
}: {
  detailState?: unknown;
  overviewState?: unknown;
  readonlyDisplay?: unknown;
  statusState?: unknown;
} = {}) {
  const detail = recordValue(detailState);
  const overview = recordValue(overviewState);
  const readonly = recordValue(readonlyDisplay);
  const simpleSections = profileValues(readonly.simpleSections);
  return {
    copyButtonLabel: tr("builtinCopyBtn"),
    selectPlaceholder: tr("builtinProfileSelectPlaceholder"),
    title: tr("builtinTitle"),
    detail: {
      aliases: safeString(detail.aliases || ""),
      commandExecution: readonly.commandExecution,
      detectProfile: readonly.detectProfile,
      detailDisplay: builtinProfileDetailsPresentation(simpleSections),
      hasHookRows: !!readonly.hasHookRows,
      hookRows: profileValues(readonly.hookRows),
      interactionRows: profileValues(readonly.interactionRows),
      name: safeString(detail.name || ""),
      notes: safeString(detail.notes || ""),
      promptRows: profileValues(readonly.promptRows),
      simpleSections,
      source: safeString(detail.source || ""),
      summary: safeString(detail.summary || ""),
      sysPromptRows: profileValues(readonly.sysPromptRows),
      transitionRows: profileValues(readonly.transitionRows),
    },
    overview: {
      overviewText: safeString(overview.overviewText || "-"),
      profileRows: profileValues(overview.builtins).map((profileValue) => {
        const profile = recordValue(profileValue);
        return {
          aliases: profileValues(profile.aliases)
            .map(safeString)
            .filter(Boolean),
          name: safeString(profile.name || ""),
          summary: safeString(profile.summary || ""),
        };
      }),
      profileNames: profileValues(overview.options).map(safeString),
      selectedName: safeString(overview.selected || ""),
    },
    status: profileStatusDisplay(statusState),
  };
}
