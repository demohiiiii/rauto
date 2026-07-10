import { get as getStore, writable } from "svelte/store";
import {
  createTextfsmTemplate,
  deleteTextfsmMapping as deleteTextfsmMappingRequest,
  deleteTextfsmTemplate as deleteTextfsmTemplateRequest,
  getTextfsmTemplate,
  listTextfsmMappings,
  listTextfsmTemplates,
  saveTextfsmMapping as saveTextfsmMappingRequest,
  updateTextfsmTemplate,
} from "../api/client.js";
import { tr } from "../lib/i18n.js";
import {
  promptForResourceName,
  safeString,
  statusPresentation,
} from "../lib/ui.js";
import { showToast } from "./overlays.js";
import {
  getCachedDeviceProfiles,
  readCustomShowObjectForm,
  setCustomShowObjectTemplateState,
} from "./templatesShowObjects.js";

const callHook = (hooks, hookName, ...args) =>
  typeof hooks[hookName] === "function" ? hooks[hookName](...args) : undefined;

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

function textfsmMappingFormPresentation() {
  const profilePlaceholder = tr(
    "inventoryProfileSelectPlaceholder",
    "Select a device profile",
  );
  const templatePlaceholder = tr(
    "textfsmTemplateSelectPlaceholder",
    "Select TextFSM template",
  );
  return {
    commandPlaceholder: tr("textfsmMappingCommandPlaceholder"),
    deleteButtonLabel: tr("savedConnDeleteBtn"),
    hintText: tr("textfsmMappingHint"),
    profilePlaceholder,
    saveButtonLabel: tr("savedConnSaveBtn"),
    templatePlaceholder,
  };
}

export function textfsmMappingFormDisplay({
  form = {},
  profileState = {},
  templateState = {},
} = {}) {
  const presentation = textfsmMappingFormPresentation();
  return {
    ...presentation,
    fields: {
      command: {
        currentValue: formSelectedValue(form, "command"),
        placeholder: presentation.commandPlaceholder,
      },
      profile: {
        currentValue: formSelectedValue(form, "deviceProfile"),
        options: optionRowsFromValues(
          profileState.profiles,
          presentation.profilePlaceholder,
        ),
        placeholder: presentation.profilePlaceholder,
      },
      template: {
        currentValue: formSelectedValue(form, "templateName"),
        options: optionRowsFromValues(
          templateState.names,
          presentation.templatePlaceholder,
        ),
        placeholder: presentation.templatePlaceholder,
      },
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

export function textfsmTemplateEditorPanelDisplay({
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
    titleKey: "textfsmTemplatesTitle",
    titleFallback: "TextFSM Templates",
  });
  return {
    ...display,
    errorMessage: safeString(listState.errorMessage || ""),
  };
}

function textfsmMappingListPresentation() {
  return {
    emptyMessage: tr("textfsmMappingsEmpty"),
    title: tr("textfsmMappingsTitle"),
  };
}

export function textfsmMappingsPanelDisplay({
  listState = {},
  statusState = {},
} = {}) {
  const listPresentation = textfsmMappingListPresentation();
  const status = templatePanelStatusDisplay(statusState);
  return {
    emptyMessage: listPresentation.emptyMessage,
    errorMessage: safeString(listState.errorMessage || ""),
    showStatus: !!status.text,
    status,
    title: listPresentation.title,
  };
}

export const textfsmTemplateContentText = writable("");
export const textfsmMappingStatusState = writable({
  message: "",
  tone: "info",
});
export const textfsmMappingForm = writable({
  command: "",
  deviceProfile: "",
  templateName: "",
});
export const textfsmMappingListState = writable({
  errorMessage: "",
  selectedCommand: "",
  selectedProfile: "",
  textfsmMappings: [],
});
export const textfsmMappingProfileState = writable({
  profiles: [],
  selected: "",
});
export const textfsmMappingTemplateState = writable({
  names: [],
  selected: "",
});
export const textfsmTemplateListState = writable({
  errorMessage: "",
  selectedName: "",
  textfsmTemplateMetas: [],
});
export const textfsmTemplateNames = writable([]);
export const textfsmTemplateSelectedName = writable("");
export const textfsmTemplateStatusState = writable({
  message: "",
  tone: "info",
});

const STATUS = Object.freeze({
  textfsmMapping: "textfsmMapping",
  textfsmTemplate: "textfsmTemplate",
});

const templateStatusStates = new Map([
  [STATUS.textfsmMapping, textfsmMappingStatusState],
  [STATUS.textfsmTemplate, textfsmTemplateStatusState],
]);

function setStatus(target, message, tone = "info") {
  const presentation = statusPresentation(message, tone);
  templateStatusStates.get(target)?.set({
    message: presentation.inlineMessage,
    tone: presentation.tone,
  });
  if (presentation.shouldToast) {
    showToast(presentation.text, presentation.tone);
  }
}

function setNamedStatus(target, key, fallback, name, tone = "success") {
  setStatus(target, `${tr(key, fallback)}: ${name}`, tone);
}

function setRunningStatus(target) {
  setStatus(target, tr("running", "running"), "running");
}

function setErrorStatus(target, error) {
  setStatus(target, error?.message || String(error || ""), "error");
}

function selectedFromOptions(optionValues, selected) {
  const picked = safeString(selected || "");
  return !picked || optionValues.includes(picked) ? picked : "";
}

const arrayInput = (candidate) => (Array.isArray(candidate) ? candidate : []);

const selectedFromInput = (options, stateInput = {}) =>
  selectedFromOptions(options, safeString(stateInput?.selected || ""));

function setTextfsmMappingProfileState(stateInput = {}) {
  const profiles = arrayInput(stateInput?.profiles);
  const validSelected = selectedFromInput(profiles, stateInput);
  textfsmMappingProfileState.set({
    profiles,
    selected: validSelected,
  });
  updateTextfsmMappingFormValue({ deviceProfile: validSelected });
}

function setTextfsmMappingTemplateState(stateInput = {}) {
  const names = arrayInput(stateInput?.names);
  const validSelected = selectedFromInput(names, stateInput);
  textfsmMappingTemplateState.set({
    names,
    selected: validSelected,
  });
  updateTextfsmMappingFormValue({ templateName: validSelected });
}

function setTextfsmMappingListState(listInput = {}) {
  textfsmMappingListState.set({
    errorMessage: safeString(listInput?.errorMessage || ""),
    selectedCommand: safeString(listInput?.selectedCommand || ""),
    selectedProfile: safeString(listInput?.selectedProfile || ""),
    textfsmMappings: arrayInput(listInput?.textfsmMappings),
  });
}

function normalizeTextfsmMappingForm(form = {}) {
  return {
    command: safeString(form.command || "").trim(),
    deviceProfile: safeString(
      form.deviceProfile || form.device_profile || form.profile || "",
    ).trim(),
    templateName: safeString(
      form.templateName || form.template_name || form.template || "",
    ).trim(),
  };
}

function readTextfsmMappingForm() {
  const normalized = normalizeTextfsmMappingForm(getStore(textfsmMappingForm));
  textfsmMappingForm.set(normalized);
  return normalized;
}

function updateTextfsmMappingFormValue(patch = {}) {
  textfsmMappingForm.set(
    normalizeTextfsmMappingForm({ ...readTextfsmMappingForm(), ...patch }),
  );
}

export const textfsmMappingFormFieldUpdaters = {
  command: (command) => updateTextfsmMappingFormValue({ command }),
  profile: (deviceProfile) => updateTextfsmMappingFormValue({ deviceProfile }),
  template: (templateName) => updateTextfsmMappingFormValue({ templateName }),
};

export function setTextfsmMappingCommand(command = "") {
  textfsmMappingFormFieldUpdaters.command(command);
}

export function setTextfsmMappingProfile(deviceProfile = "") {
  textfsmMappingFormFieldUpdaters.profile(deviceProfile);
}

export function setTextfsmMappingTemplateName(templateName = "") {
  textfsmMappingFormFieldUpdaters.template(templateName);
}

function setTextfsmTemplatePickerState(pickerState) {
  const names = Array.isArray(pickerState?.names) ? pickerState.names : [];
  const selected = safeString(pickerState?.selected || "");
  textfsmTemplateNames.set(names);
  textfsmTemplateSelectedName.set(selectedFromOptions(names, selected));
}

function setTextfsmTemplateSelected(templateName = "") {
  textfsmTemplateSelectedName.set(safeString(templateName || ""));
}

export function setTextfsmTemplatePickerValue(templateName = "") {
  setTextfsmTemplateSelected(templateName);
}

function getTextfsmTemplateSelected() {
  return safeString(getStore(textfsmTemplateSelectedName));
}

function setTextfsmTemplateListState(listStateInput = {}) {
  textfsmTemplateListState.set({
    errorMessage: safeString(listStateInput?.errorMessage || ""),
    selectedName: safeString(listStateInput?.selectedName || ""),
    textfsmTemplateMetas: Array.isArray(listStateInput?.textfsmTemplateMetas)
      ? listStateInput.textfsmTemplateMetas
      : [],
  });
}

function getTextfsmTemplateContentValue() {
  return safeString(getStore(textfsmTemplateContentText));
}

function setTextfsmTemplateContentValue(templateContent = "") {
  textfsmTemplateContentText.set(safeString(templateContent));
}

export function setTextfsmTemplateContent(templateContent = "") {
  setTextfsmTemplateContentValue(templateContent);
}

function createTextfsmMappingState() {
  let cachedTextfsmMappings = [];

  return {
    getMappings() {
      return cachedTextfsmMappings;
    },
    setMappings(mappings) {
      cachedTextfsmMappings = Array.isArray(mappings) ? mappings : [];
    },
  };
}

function textfsmMappingProfiles({ hooks = {} }) {
  const profiles =
    typeof hooks.getDeviceProfiles === "function"
      ? hooks.getDeviceProfiles()
      : getCachedDeviceProfiles();
  return profiles.filter((name) => name && name !== "autodetect");
}

function updateTextfsmMappingProfileOptions({ hooks }) {
  const profiles = textfsmMappingProfiles({ hooks });
  const selected = readTextfsmMappingForm().deviceProfile;
  setTextfsmMappingProfileState({
    profiles,
    selected,
  });
}

function updateTextfsmMappingListState({
  errorMessage = "",
  mappingWorkspace,
}) {
  const mappings = mappingWorkspace.getMappings();
  const form = readTextfsmMappingForm();
  setTextfsmMappingListState({
    errorMessage,
    selectedCommand: form.command,
    selectedProfile: form.deviceProfile,
    textfsmMappings: mappings,
  });
}

async function loadTextfsmMappingsForProfile(
  mappingWorkspace,
  profileOverride = "",
) {
  const profile = safeString(
    profileOverride || readTextfsmMappingForm().deviceProfile || "",
  ).trim();
  try {
    const textfsmMappingsPayload = await listTextfsmMappings(profile);
    mappingWorkspace.setMappings(textfsmMappingsPayload);
    updateTextfsmMappingListState({ mappingWorkspace });
  } catch (error) {
    mappingWorkspace.setMappings([]);
    updateTextfsmMappingListState({
      errorMessage: error.message,
      mappingWorkspace,
    });
  }
}

async function saveCurrentTextfsmMapping(mappingWorkspace, hooks = {}) {
  const { command, deviceProfile, templateName } = readTextfsmMappingForm();
  if (!deviceProfile || !command || !templateName) {
    setStatus(
      STATUS.textfsmMapping,
      tr(
        "textfsmMappingRequired",
        "profile, command, and template are required",
      ),
      "error",
    );
    return;
  }
  setRunningStatus(STATUS.textfsmMapping);
  try {
    const savedMappingPayload = await saveTextfsmMappingRequest({
      device_profile: deviceProfile,
      command,
      template_name: templateName,
    });
    await loadTextfsmMappingsForProfile(mappingWorkspace, deviceProfile);
    await callHook(hooks, "onMappingsChanged", deviceProfile);
    updateTextfsmMappingFormValue({
      command: savedMappingPayload.command || command,
      deviceProfile: savedMappingPayload.device_profile || deviceProfile,
      templateName: savedMappingPayload.template_name || templateName,
    });
    updateTextfsmMappingListState({ mappingWorkspace });
    setStatus(
      STATUS.textfsmMapping,
      `${tr("saved", "Saved")}: ${savedMappingPayload.device_profile} / ${savedMappingPayload.command}`,
      "success",
    );
  } catch (error) {
    setErrorStatus(STATUS.textfsmMapping, error);
  }
}

async function deleteCurrentTextfsmMapping(mappingWorkspace, hooks = {}) {
  const { command, deviceProfile } = readTextfsmMappingForm();
  if (!deviceProfile || !command) {
    setStatus(
      STATUS.textfsmMapping,
      tr("textfsmMappingDeleteRequired", "profile and command are required"),
      "error",
    );
    return;
  }
  setRunningStatus(STATUS.textfsmMapping);
  try {
    await deleteTextfsmMappingRequest({
      device_profile: deviceProfile,
      command,
    });
    updateTextfsmMappingFormValue({ command: "" });
    await loadTextfsmMappingsForProfile(mappingWorkspace, deviceProfile);
    await callHook(hooks, "onMappingsChanged", deviceProfile);
    setStatus(
      STATUS.textfsmMapping,
      `${tr("deleted", "Deleted")}: ${deviceProfile} / ${command}`,
      "success",
    );
  } catch (error) {
    setErrorStatus(STATUS.textfsmMapping, error);
  }
}

function selectTextfsmMappingRow(mappingWorkspace, mapping) {
  if (!mapping) return;
  updateTextfsmMappingFormValue({
    command: mapping.command || "",
    deviceProfile: mapping.device_profile || "",
    templateName: mapping.template_name || "",
  });
  updateTextfsmMappingListState({ mappingWorkspace });
}

function updateTextfsmTemplateOptions({ names, selectedName }) {
  const selected =
    selectedName !== undefined ? selectedName : getTextfsmTemplateSelected();
  setTextfsmTemplatePickerState({
    names,
    selected,
  });
  const mappingSelected = readTextfsmMappingForm().templateName;
  setTextfsmMappingTemplateState({
    names,
    selected: mappingSelected,
  });
  const showObjectSelected = readCustomShowObjectForm().textfsmTemplateName;
  setCustomShowObjectTemplateState({
    names,
    selected: showObjectSelected,
  });
}

function createTextfsmTemplateState({ hooks = {} }) {
  let cachedTextfsmTemplateMetas = [];
  let cachedTextfsmTemplateNames = [];

  function templateExists(name) {
    return cachedTextfsmTemplateNames.includes(name);
  }

  function updateOptions(selectedName) {
    updateTextfsmTemplateOptions({
      names: cachedTextfsmTemplateNames,
      selectedName,
    });
  }

  function refreshListState(errorMessage = "") {
    setTextfsmTemplateListState({
      errorMessage,
      selectedName: getTextfsmTemplateSelected().trim(),
      textfsmTemplateMetas: cachedTextfsmTemplateMetas,
    });
  }

  async function loadTemplates() {
    try {
      const textfsmTemplatesPayload = await listTextfsmTemplates();
      cachedTextfsmTemplateMetas = Array.isArray(textfsmTemplatesPayload)
        ? textfsmTemplatesPayload
        : [];
      cachedTextfsmTemplateNames = cachedTextfsmTemplateMetas
        .map((textfsmTemplateMeta) => textfsmTemplateMeta.name)
        .filter(Boolean);
      updateOptions();
      refreshListState();
      callHook(hooks, "onTemplateNamesChange", cachedTextfsmTemplateNames);
    } catch (error) {
      cachedTextfsmTemplateMetas = [];
      cachedTextfsmTemplateNames = [];
      updateOptions();
      refreshListState(error.message);
      callHook(hooks, "onTemplateNamesChange", []);
    }
  }

  async function loadTemplateDetail(nameOverride = "") {
    const name = safeString(
      nameOverride || getTextfsmTemplateSelected(),
    ).trim();
    if (!name) {
      setStatus(
        STATUS.textfsmTemplate,
        tr("textfsmTemplateNameRequired", "TextFSM template name is required"),
        "error",
      );
      return null;
    }
    setRunningStatus(STATUS.textfsmTemplate);
    try {
      const textfsmTemplatePayload = await getTextfsmTemplate(name);
      setTextfsmTemplateSelected(textfsmTemplatePayload.name || name);
      setTextfsmTemplateContentValue(textfsmTemplatePayload.content || "");
      refreshListState();
      setNamedStatus(
        STATUS.textfsmTemplate,
        "loaded",
        "Loaded",
        textfsmTemplatePayload.name || name,
      );
      return textfsmTemplatePayload;
    } catch (error) {
      setErrorStatus(STATUS.textfsmTemplate, error);
      return null;
    }
  }

  function clearCurrentTemplateContent() {
    setTextfsmTemplateContentValue("");
  }

  return {
    clearCurrentTemplateContent,
    loadTemplateDetail,
    loadTemplates,
    refreshListState,
    updateOptions,
    setSelectedName(name = "") {
      setTextfsmTemplateSelected(name);
    },
    templateExists,
  };
}

async function createTextfsmTemplateDraft(templateWorkspace) {
  const name = promptForResourceName(
    tr("textfsmTemplateNewPrompt", "New TextFSM template name"),
  );
  if (!name) return;
  const content = getTextfsmTemplateContentValue();
  setRunningStatus(STATUS.textfsmTemplate);
  try {
    const createdTextfsmTemplatePayload = await createTextfsmTemplate(
      name,
      content,
    );
    await templateWorkspace.loadTemplates();
    templateWorkspace.setSelectedName(
      createdTextfsmTemplatePayload.name || name,
    );
    setTextfsmTemplateContentValue(createdTextfsmTemplatePayload.content || "");
    templateWorkspace.refreshListState();
    setNamedStatus(
      STATUS.textfsmTemplate,
      "created",
      "Created",
      createdTextfsmTemplatePayload.name || name,
    );
  } catch (error) {
    templateWorkspace.setSelectedName(name);
    templateWorkspace.refreshListState();
    setErrorStatus(STATUS.textfsmTemplate, error);
  }
}

async function saveCurrentTextfsmTemplate(templateWorkspace, hooks = {}) {
  const name = getTextfsmTemplateSelected().trim();
  const content = getTextfsmTemplateContentValue();
  if (!name) {
    setStatus(
      STATUS.textfsmTemplate,
      tr("textfsmTemplateNameRequired", "TextFSM template name is required"),
      "error",
    );
    return;
  }
  setRunningStatus(STATUS.textfsmTemplate);
  try {
    const exists = templateWorkspace.templateExists(name);
    const savedTextfsmTemplatePayload = exists
      ? await updateTextfsmTemplate(name, content)
      : await createTextfsmTemplate(name, content);
    await templateWorkspace.loadTemplates();
    templateWorkspace.setSelectedName(savedTextfsmTemplatePayload.name || name);
    setTextfsmTemplateContentValue(
      savedTextfsmTemplatePayload.content || content,
    );
    templateWorkspace.refreshListState();
    callHook(hooks, "onTemplateSaved");
    setStatus(
      STATUS.textfsmTemplate,
      `${exists ? tr("saved", "Saved") : tr("created", "Created")}: ${
        savedTextfsmTemplatePayload.name || name
      }`,
      "success",
    );
  } catch (error) {
    setErrorStatus(STATUS.textfsmTemplate, error);
  }
}

async function deleteCurrentTextfsmTemplate(templateWorkspace, hooks = {}) {
  const name = getTextfsmTemplateSelected().trim();
  if (!name) {
    setStatus(
      STATUS.textfsmTemplate,
      tr("textfsmTemplateNameRequired", "TextFSM template name is required"),
      "error",
    );
    return;
  }
  setRunningStatus(STATUS.textfsmTemplate);
  try {
    await deleteTextfsmTemplateRequest(name);
    templateWorkspace.clearCurrentTemplateContent();
    await templateWorkspace.loadTemplates();
    await callHook(hooks, "onTemplateDeleted");
    setNamedStatus(STATUS.textfsmTemplate, "deleted", "Deleted", name);
  } catch (error) {
    setErrorStatus(STATUS.textfsmTemplate, error);
  }
}

async function selectTextfsmTemplateName(
  templateWorkspace,
  textfsmTemplateName,
) {
  if (!textfsmTemplateName) return;
  templateWorkspace.setSelectedName(textfsmTemplateName);
  templateWorkspace.refreshListState();
  await templateWorkspace.loadTemplateDetail(textfsmTemplateName);
  templateWorkspace.refreshListState();
}

async function refreshSelectedTextfsmTemplate(templateWorkspace) {
  if (!getTextfsmTemplateSelected().trim()) return;
  await templateWorkspace.loadTemplateDetail();
  templateWorkspace.refreshListState();
}

export function createTextfsmMappingSectionWorkspace(hooks = {}) {
  const mappingWorkspace = createTextfsmMappingState();

  function updateProfileOptions() {
    updateTextfsmMappingProfileOptions({ hooks });
  }

  function refreshListState(errorMessage = "") {
    updateTextfsmMappingListState({ errorMessage, mappingWorkspace });
  }

  function init() {
    updateProfileOptions();
    refreshListState();
  }

  return {
    deleteTextfsmMapping: () =>
      deleteCurrentTextfsmMapping(mappingWorkspace, hooks),
    init,
    load: (profile) => loadTextfsmMappingsForProfile(mappingWorkspace, profile),
    loadTextfsmMappings: (profile) =>
      loadTextfsmMappingsForProfile(mappingWorkspace, profile),
    onProfileChange: () => callHook(hooks, "onProfileChange"),
    refreshList: refreshListState,
    refreshProfileOptions: updateProfileOptions,
    saveTextfsmMapping: () =>
      saveCurrentTextfsmMapping(mappingWorkspace, hooks),
    selectTextfsmMapping: (mapping) =>
      selectTextfsmMappingRow(mappingWorkspace, mapping),
  };
}

export function createTextfsmTemplateSectionWorkspace(hooks = {}) {
  const templateWorkspace = createTextfsmTemplateState({ hooks });

  function init() {
    templateWorkspace.refreshListState();
  }

  return {
    createTextfsmTemplateDraft: () =>
      createTextfsmTemplateDraft(templateWorkspace),
    deleteTextfsmTemplate: () =>
      deleteCurrentTextfsmTemplate(templateWorkspace, hooks),
    init,
    load: templateWorkspace.loadTemplates,
    loadTextfsmTemplates: templateWorkspace.loadTemplates,
    refreshSelectedTextfsmTemplate: () =>
      refreshSelectedTextfsmTemplate(templateWorkspace),
    saveTextfsmTemplate: () =>
      saveCurrentTextfsmTemplate(templateWorkspace, hooks),
    selectTextfsmTemplateName: (textfsmTemplateName) =>
      selectTextfsmTemplateName(templateWorkspace, textfsmTemplateName),
  };
}
