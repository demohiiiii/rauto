import { get as getStore, writable } from "svelte/store";
import {
  deleteCustomShowObject as deleteCustomShowObjectRequest,
  getProfileModes,
  listCustomShowObjects,
  listTextfsmMappings,
  saveCustomShowObject as saveCustomShowObjectRequest,
} from "../api/client.js";
import { tr } from "../lib/i18n.js";
import { safeString, statusPresentation } from "../lib/ui.js";
import { setConnectionDeviceProfiles } from "./connections.js";
import { showToast } from "./overlays.js";

const arrayInput = (candidate) => (Array.isArray(candidate) ? candidate : []);

function selectedFromOptions(optionValues, selected) {
  const picked = safeString(selected || "");
  return !picked || optionValues.includes(picked) ? picked : "";
}

const selectedFromInput = (options, stateInput = {}) =>
  selectedFromOptions(options, safeString(stateInput?.selected || ""));

function normalizeProfileNames(profiles) {
  return (Array.isArray(profiles) ? profiles : [])
    .map((name) => String(name || "").trim())
    .filter((name, index, values) => !!name && values.indexOf(name) === index);
}

let cachedDeviceProfiles = [];
let customShowObjectsChangedHandler = null;

export const customShowObjectForm = writable({
  command: "",
  deviceProfile: "",
  enabled: true,
  manualCommand: "",
  mode: "",
  object: "",
  textfsmMappingCommand: "",
  textfsmTemplateName: "",
  useMapping: false,
});

export const customShowObjectListState = writable({
  customShowObjects: [],
  errorMessage: "",
  selectedObject: "",
  selectedProfile: "",
});

export const customShowObjectMappingState = writable({
  mappings: [],
  selected: "",
});

export const customShowObjectModeState = writable({
  modes: [],
  selected: "",
});

export const customShowObjectProfileState = writable({
  profiles: [],
  selected: "",
});

export const customShowObjectTemplateState = writable({
  names: [],
  selected: "",
});

export const showObjectStatusState = writable({
  message: "",
  tone: "info",
});

function setShowObjectStatus(message, tone = "info") {
  const presentation = statusPresentation(message, tone);
  showObjectStatusState.set({
    message: presentation.inlineMessage,
    tone: presentation.tone,
  });
  if (presentation.shouldToast) {
    showToast(presentation.text, presentation.tone);
  }
}

function setShowObjectRunningStatus() {
  setShowObjectStatus(tr("running", "running"), "running");
}

function setShowObjectErrorStatus(error) {
  setShowObjectStatus(error?.message || String(error || ""), "error");
}

export function setCustomShowObjectsChangedCallback(onChanged = null) {
  customShowObjectsChangedHandler =
    typeof onChanged === "function" ? onChanged : null;
}

export function notifyCustomShowObjectsChanged() {
  if (typeof customShowObjectsChangedHandler === "function") {
    customShowObjectsChangedHandler();
  }
}

export function getCachedDeviceProfiles() {
  return cachedDeviceProfiles;
}

export function setCachedDeviceProfiles(profiles) {
  cachedDeviceProfiles = normalizeProfileNames(profiles);
  setConnectionDeviceProfiles(cachedDeviceProfiles);
  return cachedDeviceProfiles;
}

function normalizeCustomShowObjectForm(form = {}) {
  const textfsmMappingCommand = safeString(
    form.textfsmMappingCommand ??
      form.textfsm_mapping_command ??
      (form.useMapping || form.use_mapping ? form.command : "") ??
      "",
  ).trim();
  const useMapping =
    form.useMapping !== undefined
      ? !!form.useMapping
      : form.use_mapping !== undefined
        ? !!form.use_mapping
        : !!textfsmMappingCommand;
  const manualCommand = safeString(
    form.manualCommand ??
      form.manual_command ??
      (!useMapping ? form.command : form.command || "") ??
      "",
  ).trim();
  const command = useMapping
    ? textfsmMappingCommand
    : manualCommand || safeString(form.command ?? "").trim();
  const enabled = !(form.enabled === "false" || form.enabled === false);

  return {
    command,
    deviceProfile: safeString(
      form.deviceProfile ?? form.device_profile ?? form.profile ?? "",
    ).trim(),
    enabled,
    manualCommand,
    mode: safeString(form.mode ?? "").trim(),
    object: safeString(form.object ?? "").trim(),
    textfsmMappingCommand,
    textfsmTemplateName: safeString(
      form.textfsmTemplateName ?? form.textfsm_template_name ?? "",
    ).trim(),
    useMapping,
  };
}

export function readCustomShowObjectForm() {
  const normalized = normalizeCustomShowObjectForm(
    getStore(customShowObjectForm),
  );
  customShowObjectForm.set(normalized);
  return normalized;
}

function updateCustomShowObjectFormValue(patch = {}) {
  customShowObjectForm.set(
    normalizeCustomShowObjectForm({ ...readCustomShowObjectForm(), ...patch }),
  );
}

export const customShowObjectFormFieldUpdaters = {
  enabled: (enabled) => updateCustomShowObjectFormValue({ enabled }),
  manualCommand: (manualCommand) =>
    updateCustomShowObjectFormValue({ manualCommand }),
  mode: (mode) => updateCustomShowObjectFormValue({ mode }),
  object: (object) => updateCustomShowObjectFormValue({ object }),
  profile: (deviceProfile) =>
    updateCustomShowObjectFormValue({ deviceProfile }),
  textfsmMappingCommand: (textfsmMappingCommand) =>
    updateCustomShowObjectFormValue({ textfsmMappingCommand }),
  textfsmTemplate: (textfsmTemplateName) =>
    updateCustomShowObjectFormValue({ textfsmTemplateName }),
  useMapping: (useMapping) => updateCustomShowObjectFormValue({ useMapping }),
};

export function setCustomShowObjectEnabled(enabled) {
  customShowObjectFormFieldUpdaters.enabled(enabled);
}

export function setCustomShowObjectManualCommand(manualCommand = "") {
  customShowObjectFormFieldUpdaters.manualCommand(manualCommand);
}

export function setCustomShowObjectMode(mode = "") {
  customShowObjectFormFieldUpdaters.mode(mode);
}

export function setCustomShowObjectObjectName(object = "") {
  customShowObjectFormFieldUpdaters.object(object);
}

export function setCustomShowObjectProfile(deviceProfile = "") {
  customShowObjectFormFieldUpdaters.profile(deviceProfile);
}

export function setCustomShowObjectTextfsmMappingCommand(
  textfsmMappingCommand = "",
) {
  customShowObjectFormFieldUpdaters.textfsmMappingCommand(
    textfsmMappingCommand,
  );
}

export function setCustomShowObjectTextfsmTemplateName(
  textfsmTemplateName = "",
) {
  customShowObjectFormFieldUpdaters.textfsmTemplate(textfsmTemplateName);
}

export function setCustomShowObjectUseMapping(useMapping) {
  customShowObjectFormFieldUpdaters.useMapping(useMapping);
}

function setCustomShowObjectListState(listInput = {}) {
  customShowObjectListState.set({
    customShowObjects: arrayInput(listInput?.customShowObjects),
    errorMessage: safeString(listInput?.errorMessage || ""),
    selectedObject: safeString(listInput?.selectedObject || ""),
    selectedProfile: safeString(listInput?.selectedProfile || ""),
  });
}

function setCustomShowObjectMappingValue(mappingCommand = "") {
  updateCustomShowObjectFormValue({ textfsmMappingCommand: mappingCommand });
}

function setCustomShowObjectMappingState(stateInput = {}) {
  const mappings = arrayInput(stateInput?.mappings);
  const mappingCommands = mappings.map((textfsmMapping) =>
    safeString(textfsmMapping.command || ""),
  );
  const validSelected = selectedFromInput(mappingCommands, stateInput);
  customShowObjectMappingState.set({
    mappings,
    selected: validSelected,
  });
  updateCustomShowObjectFormValue({ textfsmMappingCommand: validSelected });
}

function setCustomShowObjectProfileState(stateInput = {}) {
  const profiles = arrayInput(stateInput?.profiles);
  const validSelected = selectedFromInput(profiles, stateInput);
  customShowObjectProfileState.set({
    profiles,
    selected: validSelected,
  });
  updateCustomShowObjectFormValue({ deviceProfile: validSelected });
}

function setCustomShowObjectModeState(stateInput = {}) {
  const modes = arrayInput(stateInput?.modes);
  const validSelected = selectedFromInput(modes, stateInput);
  customShowObjectModeState.set({
    modes,
    selected: validSelected,
  });
  updateCustomShowObjectFormValue({ mode: validSelected });
}

export function setCustomShowObjectTemplateState(stateInput = {}) {
  const names = arrayInput(stateInput?.names);
  const validSelected = selectedFromInput(names, stateInput);
  customShowObjectTemplateState.set({
    names,
    selected: validSelected,
  });
  updateCustomShowObjectFormValue({ textfsmTemplateName: validSelected });
}

function validateCustomShowObjectForm(form) {
  if (!form.deviceProfile || !form.object) {
    return tr(
      "showObjectCustomRequired",
      "profile, object, and command are required",
    );
  }
  if (!form.mode) {
    return tr("showObjectModeRequired", "mode is required");
  }
  if (form.useMapping && !form.textfsmMappingCommand) {
    return tr(
      "showObjectMappingRequired",
      "profile command mapping is required",
    );
  }
  if (!form.command) {
    return tr(
      "showObjectCustomRequired",
      "profile, object, and command are required",
    );
  }
  return "";
}

function customShowObjectSavePayload(form) {
  return {
    command: form.command,
    device_profile: form.deviceProfile,
    enabled: form.enabled,
    mode: form.mode || null,
    object: form.object,
    textfsm_mapping_command: form.useMapping
      ? form.textfsmMappingCommand
      : null,
    textfsm_template_name: form.useMapping
      ? null
      : form.textfsmTemplateName || null,
  };
}

function readCustomShowObjectDeleteTarget() {
  const form = readCustomShowObjectForm();
  return {
    deviceProfile: form.deviceProfile,
    object: form.object,
  };
}

function updateShowObjectMappingRefFromManualCommandInput(mappings) {
  const form = readCustomShowObjectForm();
  if (form.useMapping) return;
  const command = form.manualCommand;
  const matched = (Array.isArray(mappings) ? mappings : []).some(
    (textfsmMapping) => safeString(textfsmMapping.command || "") === command,
  );
  setCustomShowObjectMappingValue(matched ? command : "");
}

function applyShowObjectTextfsmMappingSelectionToForm() {
  const command = readCustomShowObjectForm().textfsmMappingCommand;
  if (!command) return;
  updateCustomShowObjectFormValue({
    command,
    manualCommand: command,
    textfsmTemplateName: "",
  });
}

function applyShowObjectInputModeToForm(applyMappingSelection) {
  const { useMapping } = readCustomShowObjectForm();
  if (useMapping) {
    updateCustomShowObjectFormValue({ textfsmTemplateName: "" });
    applyMappingSelection();
  } else {
    updateCustomShowObjectFormValue({ textfsmMappingCommand: "" });
  }
}

function applyCustomShowObjectFormPayload(customObject = {}, fallback = {}) {
  updateCustomShowObjectFormValue({
    command: customObject.command || fallback.command || "",
    deviceProfile:
      customObject.device_profile ||
      fallback.deviceProfile ||
      fallback.profile ||
      "",
    enabled: customObject.enabled !== false,
    manualCommand: customObject.command || fallback.command || "",
    mode: customObject.mode || "",
    object: customObject.object || fallback.object || "",
    textfsmMappingCommand: customObject.textfsm_mapping_command || "",
    textfsmTemplateName: customObject.textfsm_template_name || "",
    useMapping: !!customObject.textfsm_mapping_command,
  });
}

function clearCustomShowObjectForm() {
  updateCustomShowObjectFormValue({
    command: "",
    enabled: true,
    manualCommand: "",
    mode: "",
    object: "",
    textfsmMappingCommand: "",
    textfsmTemplateName: "",
    useMapping: false,
  });
}

function applyCustomShowObjectRowPayload(customObjectRow) {
  if (!customObjectRow) return;
  updateCustomShowObjectFormValue({
    command: customObjectRow.command || "",
    deviceProfile:
      customObjectRow.profile ||
      customObjectRow.device_profile ||
      customObjectRow.deviceProfile ||
      "",
    enabled: customObjectRow.enabled !== false,
    manualCommand: customObjectRow.command || "",
    mode: customObjectRow.mode || "",
    object: customObjectRow.object || "",
    textfsmMappingCommand: customObjectRow.textfsm_mapping_command || "",
    textfsmTemplateName: customObjectRow.textfsm_template_name || "",
    useMapping:
      customObjectRow.useMapping ?? !!customObjectRow.textfsm_mapping_command,
  });
}

function getCustomShowObjectProfiles(hooks = {}) {
  const profiles =
    typeof hooks.getDeviceProfiles === "function"
      ? hooks.getDeviceProfiles()
      : getCachedDeviceProfiles();
  return profiles.filter((name) => name && name !== "autodetect");
}

function createCustomShowObjectState({ hooks = {} }) {
  let cachedCustomShowObjects = [];
  let cachedShowObjectDefaultMode = "";
  let cachedShowObjectModes = [];
  let cachedShowObjectTextfsmMappings = [];

  function refreshCustomShowObjectListState(errorMessage = "") {
    const form = readCustomShowObjectForm();
    setCustomShowObjectListState({
      customShowObjects: cachedCustomShowObjects,
      errorMessage,
      selectedObject: form.object,
      selectedProfile: form.deviceProfile,
    });
  }

  async function loadCustomShowObjects(profileOverride = "") {
    const profile = safeString(
      profileOverride || readCustomShowObjectForm().deviceProfile || "",
    ).trim();
    try {
      const customShowObjectsPayload = await listCustomShowObjects(profile);
      cachedCustomShowObjects = Array.isArray(customShowObjectsPayload)
        ? customShowObjectsPayload
        : [];
      refreshCustomShowObjectListState();
    } catch (error) {
      cachedCustomShowObjects = [];
      refreshCustomShowObjectListState(error.message);
    }
  }

  function applyShowObjectTextfsmMappingSelection() {
    applyShowObjectTextfsmMappingSelectionToForm();
  }

  function updateShowObjectTextfsmMappingOptions() {
    const form = readCustomShowObjectForm();
    setCustomShowObjectMappingState({
      mappings: cachedShowObjectTextfsmMappings,
      selected: form.textfsmMappingCommand,
    });
    if (form.useMapping) {
      applyShowObjectTextfsmMappingSelection();
    }
  }

  function refreshShowObjectMappingRefFromCommand() {
    updateShowObjectMappingRefFromManualCommandInput(
      cachedShowObjectTextfsmMappings,
    );
  }

  async function loadShowObjectTextfsmMappings(profileOverride = "") {
    const profile = safeString(
      profileOverride || readCustomShowObjectForm().deviceProfile || "",
    ).trim();
    try {
      const textfsmMappingsPayload = await listTextfsmMappings(profile);
      cachedShowObjectTextfsmMappings = Array.isArray(textfsmMappingsPayload)
        ? textfsmMappingsPayload
        : [];
      updateShowObjectTextfsmMappingOptions();
      refreshShowObjectMappingRefFromCommand();
    } catch (_) {
      cachedShowObjectTextfsmMappings = [];
      updateShowObjectTextfsmMappingOptions();
    }
  }

  function updateShowObjectModeOptions(selectedMode = "") {
    const form = readCustomShowObjectForm();
    const selected =
      selectedMode || form.mode || cachedShowObjectDefaultMode || "";
    setCustomShowObjectModeState({
      modes: cachedShowObjectModes,
      selected,
    });
  }

  async function loadShowObjectModeOptions(
    profileOverride = "",
    selectedMode = "",
  ) {
    const profile = safeString(
      profileOverride || readCustomShowObjectForm().deviceProfile || "",
    ).trim();
    if (!profile) {
      cachedShowObjectModes = [];
      cachedShowObjectDefaultMode = "";
      updateShowObjectModeOptions(selectedMode);
      return;
    }
    try {
      const profileModesPayload = await getProfileModes(profile);
      cachedShowObjectModes = Array.isArray(profileModesPayload?.modes)
        ? profileModesPayload.modes.filter(Boolean)
        : [];
      cachedShowObjectDefaultMode = profileModesPayload?.default_mode || "";
    } catch (_) {
      cachedShowObjectModes = [];
      cachedShowObjectDefaultMode = "";
    }
    updateShowObjectModeOptions(selectedMode);
  }

  function updateProfileOptions() {
    const profiles = getCustomShowObjectProfiles(hooks);
    const selected = readCustomShowObjectForm().deviceProfile;
    setCustomShowObjectProfileState({
      profiles,
      selected,
    });
  }

  return {
    applyShowObjectTextfsmMappingSelection,
    loadCustomShowObjects,
    loadShowObjectModeOptions,
    loadShowObjectTextfsmMappings,
    refreshCustomShowObjectListState,
    refreshShowObjectMappingRefFromCommand,
    updateProfileOptions,
    updateShowObjectModeOptions,
    updateShowObjectTextfsmMappingOptions,
  };
}

function applyCustomShowObjectInputMode(showObjects) {
  applyShowObjectInputModeToForm(
    showObjects.applyShowObjectTextfsmMappingSelection,
  );
}

async function runCustomObjectsChangedHook(hooks = {}) {
  if (typeof hooks.onCustomObjectsChanged === "function") {
    await hooks.onCustomObjectsChanged();
    return;
  }
  notifyCustomShowObjectsChanged();
}

async function saveCurrentCustomShowObject(showObjects, hooks = {}) {
  const form = readCustomShowObjectForm();
  const validationError = validateCustomShowObjectForm(form);
  if (validationError) {
    setShowObjectStatus(validationError, "error");
    return;
  }
  setShowObjectRunningStatus();
  try {
    const savedPayload = await saveCustomShowObjectRequest(
      customShowObjectSavePayload(form),
    );
    await showObjects.loadCustomShowObjects(form.deviceProfile);
    await runCustomObjectsChangedHook(hooks);
    applyCustomShowObjectFormPayload(savedPayload, form);
    applyCustomShowObjectInputMode(showObjects);
    showObjects.refreshCustomShowObjectListState();
    setShowObjectStatus(
      `${tr("saved", "Saved")}: ${savedPayload.device_profile} / ${savedPayload.object}`,
      "success",
    );
  } catch (error) {
    setShowObjectErrorStatus(error);
  }
}

async function deleteCurrentCustomShowObject(showObjects, hooks = {}) {
  const target = readCustomShowObjectDeleteTarget();
  if (!target.deviceProfile || !target.object) {
    setShowObjectStatus(
      tr("showObjectCustomDeleteRequired", "profile and object are required"),
      "error",
    );
    return;
  }
  setShowObjectRunningStatus();
  try {
    await deleteCustomShowObjectRequest({
      device_profile: target.deviceProfile,
      object: target.object,
    });
    clearCustomShowObjectForm();
    applyCustomShowObjectInputMode(showObjects);
    await showObjects.loadCustomShowObjects(target.deviceProfile);
    await runCustomObjectsChangedHook(hooks);
    setShowObjectStatus(
      `${tr("deleted", "Deleted")}: ${target.deviceProfile} / ${target.object}`,
      "success",
    );
  } catch (error) {
    setShowObjectErrorStatus(error);
  }
}

async function selectCustomShowObjectRow(showObjects, rowPayload) {
  if (!rowPayload) return;
  const profile =
    rowPayload.profile ||
    rowPayload.device_profile ||
    rowPayload.deviceProfile ||
    "";
  applyCustomShowObjectRowPayload(rowPayload);
  await showObjects.loadShowObjectModeOptions(profile, rowPayload.mode);
  await showObjects.loadShowObjectTextfsmMappings(profile);
  applyCustomShowObjectRowPayload(rowPayload);
  applyCustomShowObjectInputMode(showObjects);
  showObjects.refreshCustomShowObjectListState();
}

function applyCustomShowObjectProfileChange(showObjects) {
  showObjects.loadCustomShowObjects();
  showObjects.loadShowObjectTextfsmMappings();
  showObjects.loadShowObjectModeOptions();
}

export function createCustomShowObjectSectionWorkspace(hooks = {}) {
  const showObjects = createCustomShowObjectState({ hooks });

  function init() {
    showObjects.updateProfileOptions();
    showObjects.updateShowObjectTextfsmMappingOptions();
    showObjects.updateShowObjectModeOptions();
    applyCustomShowObjectInputMode(showObjects);
    showObjects.refreshCustomShowObjectListState();
  }

  return {
    deleteCustomShowObject: () =>
      deleteCurrentCustomShowObject(showObjects, hooks),
    init,
    load: showObjects.loadCustomShowObjects,
    loadMappings: showObjects.loadShowObjectTextfsmMappings,
    loadModes: showObjects.loadShowObjectModeOptions,
    onCommandInput: showObjects.refreshShowObjectMappingRefFromCommand,
    onMappingChange: showObjects.applyShowObjectTextfsmMappingSelection,
    onProfileChange: () => applyCustomShowObjectProfileChange(showObjects),
    onUseMappingChange: () => applyCustomShowObjectInputMode(showObjects),
    refreshCustomShowObjects: showObjects.loadCustomShowObjects,
    refreshMappingOptions: showObjects.updateShowObjectTextfsmMappingOptions,
    refreshProfileOptions: showObjects.updateProfileOptions,
    saveCustomShowObject: () => saveCurrentCustomShowObject(showObjects, hooks),
    selectCustomShowObject: (row) =>
      selectCustomShowObjectRow(showObjects, row),
  };
}
