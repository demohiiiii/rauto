import { normalizeTemplatePageSection } from "../config/dashboardModes.js";
import { tr } from "../lib/i18n.js";
import { safeString, statusPresentation } from "../lib/ui.js";
import {
  textfsmMappingFormDisplay as textfsmMappingFormDisplayImpl,
  textfsmMappingsPanelDisplay as textfsmMappingsPanelDisplayImpl,
  textfsmTemplateEditorPanelDisplay as textfsmTemplateEditorPanelDisplayImpl,
} from "./templatesTextfsm.js";

function templatePageSectionPresentation(sectionKey) {
  const currentSection = normalizeTemplatePageSection(sectionKey);
  return {
    showFlowTemplates: currentSection === "flows",
    showJsonTemplates: currentSection === "templates",
    showShowObjects: currentSection === "show-objects",
    showTextfsm: currentSection === "textfsm",
  };
}

const templatePagePresentation = () => ({
  sectionAriaLabel: tr("templatesTitle"),
});

export function templatePageDisplay(sectionKey) {
  return {
    ...templatePagePresentation(),
    ...templatePageSectionPresentation(sectionKey),
  };
}

function formSelectedValue(form = {}, key = "") {
  return safeString(form?.[key] || "");
}

function optionRowsFromValues(optionVals = [], placeholder = "") {
  const optionRows = (Array.isArray(optionVals) ? optionVals : []).map(
    (optionValue) => ({
      optionLabel: safeString(optionValue),
      optionValue: safeString(optionValue),
    }),
  );
  return placeholder
    ? [{ optionLabel: placeholder, optionValue: "" }, ...optionRows]
    : optionRows;
}

export function textfsmMappingFormDisplay({
  form = {},
  profileState = {},
  templateState = {},
} = {}) {
  return textfsmMappingFormDisplayImpl({
    form,
    profileState,
    templateState,
  });
}

export function customShowObjectFormPresentation({
  form = {},
  modeState = {},
  profileState = {},
} = {}) {
  const profilePlaceholder = tr(
    "inventoryProfileSelectPlaceholder",
    "Select a device profile",
  );
  return {
    deleteButtonLabel: tr("showObjectCustomDeleteBtn"),
    enabledLabel: tr("showObjectCustomEnabledLabel"),
    modePlaceholder: tr("showObjectCustomModePlaceholder"),
    objectPlaceholder: tr("showObjectCustomNamePlaceholder"),
    profilePlaceholder,
    saveButtonLabel: tr("showObjectCustomSaveBtn"),
    fields: {
      enabled: !!form?.enabled,
      mode: {
        currentValue: formSelectedValue(form, "mode"),
        options: optionRowsFromValues(modeState.modes),
        placeholder: tr("showObjectCustomModePlaceholder"),
      },
      object: {
        currentValue: formSelectedValue(form, "object"),
        placeholder: tr("showObjectCustomNamePlaceholder"),
      },
      profile: {
        currentValue: formSelectedValue(form, "deviceProfile"),
        options: optionRowsFromValues(
          profileState.profiles,
          profilePlaceholder,
        ),
        placeholder: profilePlaceholder,
      },
    },
  };
}

function customShowObjectsPanelPresentation() {
  return {
    hintText: tr("showObjectCustomHint"),
    refreshButtonLabel: tr("historyDrawerRefresh"),
    title: tr("customShowObjectsTitle"),
  };
}

function customShowObjectCommandPresentation() {
  const mappingPlaceholder = tr(
    "showObjectMappingSelectPlaceholder",
    "Select profile command mapping",
  );
  const templatePlaceholder = tr(
    "textfsmTemplateSelectPlaceholder",
    "Select TextFSM template",
  );
  return {
    commandPlaceholder: tr("showObjectCustomCommandPlaceholder"),
    mappingPlaceholder,
    templatePlaceholder,
    useMappingLabel: tr("showObjectUseMappingLabel"),
  };
}

function customShowObjectMappingOptionRows(mappings = [], placeholder = "") {
  const optionRows = (Array.isArray(mappings) ? mappings : []).map(
    (mappingOption) => {
      const command = safeString(mappingOption?.command || "");
      const templateName = safeString(mappingOption?.template_name || "-");
      return {
        optionLabel: `${command || "-"} -> ${templateName || "-"}`,
        optionValue: command,
      };
    },
  );
  return placeholder
    ? [{ optionLabel: placeholder, optionValue: "" }, ...optionRows]
    : optionRows;
}

export function customShowObjectCommandDisplay({
  form = {},
  mappingState = {},
  templateState = {},
} = {}) {
  const presentation = customShowObjectCommandPresentation();
  return {
    ...presentation,
    fields: {
      manualCommand: {
        currentValue: formSelectedValue(form, "manualCommand"),
        placeholder: presentation.commandPlaceholder,
      },
      mapping: {
        currentValue: formSelectedValue(form, "textfsmMappingCommand"),
        options: customShowObjectMappingOptionRows(
          mappingState.mappings,
          presentation.mappingPlaceholder,
        ),
        placeholder: presentation.mappingPlaceholder,
      },
      template: {
        currentValue: formSelectedValue(form, "textfsmTemplateName"),
        options: optionRowsFromValues(
          templateState.names,
          presentation.templatePlaceholder,
        ),
        placeholder: presentation.templatePlaceholder,
      },
      useMapping: !!form?.useMapping,
    },
  };
}

function templateEditorContent(contentText = "") {
  return safeString(contentText || "");
}

function templatePanelStatusDisplay(statusState = {}) {
  return statusPresentation(
    statusState.message || "",
    statusState.tone || "info",
    {
      suppressPassiveLoaded: false,
    },
  );
}

function templateEditorPanelDisplay({
  contentText = "",
  names = [],
  selectedName = "",
  statusState = {},
  titleKey = "",
  titleFallback = "",
} = {}) {
  const status = templatePanelStatusDisplay(statusState);
  return {
    contentText: templateEditorContent(contentText),
    names: Array.isArray(names) ? names : [],
    selectedName: safeString(selectedName || ""),
    showStatus: !!status.text,
    status,
    title: tr(titleKey, titleFallback),
  };
}

export function templateLibraryPanelDisplay({
  contentText = "",
  listState = {},
  names = [],
  selectedName = "",
  statusState = {},
} = {}) {
  const display = templateEditorPanelDisplay({
    contentText,
    names,
    selectedName,
    statusState,
    titleKey: "templatesTitle",
    titleFallback: "Templates",
  });
  return {
    ...display,
    errorMessage: safeString(listState.errorMessage || ""),
  };
}

export function textfsmTemplateEditorPanelDisplay({
  contentText = "",
  listState = {},
  names = [],
  selectedName = "",
  statusState = {},
} = {}) {
  return textfsmTemplateEditorPanelDisplayImpl({
    contentText,
    listState,
    names,
    selectedName,
    statusState,
  });
}

function customShowObjectListPresentation() {
  return {
    emptyMessage: tr("customShowObjectsEmpty"),
    listTitle: tr("customShowObjectsTitle"),
  };
}

export function customShowObjectsPanelDisplay({
  listState = {},
  statusState = {},
} = {}) {
  const listPresentation = customShowObjectListPresentation();
  const status = templatePanelStatusDisplay(statusState);
  return {
    emptyMessage: listPresentation.emptyMessage,
    errorMessage: safeString(listState.errorMessage || ""),
    listTitle: listPresentation.listTitle,
    selectedObject: safeString(listState.selectedObject || ""),
    selectedProfile: safeString(listState.selectedProfile || ""),
    showStatus: !!status.text,
    status,
  };
}

export function textfsmMappingsPanelDisplay({
  listState = {},
  statusState = {},
} = {}) {
  return textfsmMappingsPanelDisplayImpl({
    listState,
    statusState,
  });
}
