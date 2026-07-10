import { get as getStore, writable } from "svelte/store";
import {
  createTemplate,
  deleteTemplate as deleteTemplateByName,
  getTemplate,
  listTemplates,
  updateTemplate,
} from "../api/client.js";
import { tr } from "../lib/i18n.js";
import {
  promptForResourceName,
  safeString,
  statusPresentation,
} from "../lib/ui.js";
import { protectedDashboardResourcesRefreshState } from "./dashboardApp.js";
import { showToast } from "./overlays.js";
import {
  createTextfsmMappingSectionWorkspace as createTextfsmMappingSectionWorkspaceImpl,
  createTextfsmTemplateSectionWorkspace as createTextfsmTemplateSectionWorkspaceImpl,
  setTextfsmMappingCommand as setTextfsmMappingCommandImpl,
  setTextfsmMappingProfile as setTextfsmMappingProfileImpl,
  setTextfsmMappingTemplateName as setTextfsmMappingTemplateNameImpl,
  setTextfsmTemplateContent as setTextfsmTemplateContentImpl,
  setTextfsmTemplatePickerValue as setTextfsmTemplatePickerValueImpl,
  textfsmMappingForm as textfsmMappingFormStore,
  textfsmMappingFormFieldUpdaters as textfsmMappingFormFieldUpdatersImpl,
  textfsmMappingListState as textfsmMappingListStateStore,
  textfsmMappingProfileState as textfsmMappingProfileStateStore,
  textfsmMappingStatusState as textfsmMappingStatusStateStore,
  textfsmMappingTemplateState as textfsmMappingTemplateStateStore,
  textfsmTemplateContentText as textfsmTemplateContentTextStore,
  textfsmTemplateListState as textfsmTemplateListStateStore,
  textfsmTemplateNames as textfsmTemplateNamesStore,
  textfsmTemplateSelectedName as textfsmTemplateSelectedNameStore,
  textfsmTemplateStatusState as textfsmTemplateStatusStateStore,
} from "./templatesTextfsm.js";

export const templatesProtectedResourcesRefreshState =
  protectedDashboardResourcesRefreshState;

export const runTemplateSelectState = writable({
  names: [],
  selected: "",
});

export const templateContentText = writable("");
export const templateLibraryListState = writable({
  errorMessage: "",
  selectedName: "",
  templateMetas: [],
});
export const templateLibraryNames = writable([]);
export const templateLibrarySelectedName = writable("");
export const templateLibraryStatusState = writable({
  message: "",
  tone: "info",
});
export const textfsmTemplateContentText = textfsmTemplateContentTextStore;
export const textfsmMappingStatusState = textfsmMappingStatusStateStore;
export const textfsmMappingForm = textfsmMappingFormStore;
export const textfsmMappingListState = textfsmMappingListStateStore;
export const textfsmMappingProfileState = textfsmMappingProfileStateStore;
export const textfsmMappingTemplateState = textfsmMappingTemplateStateStore;
export const textfsmTemplateListState = textfsmTemplateListStateStore;
export const textfsmTemplateNames = textfsmTemplateNamesStore;
export const textfsmTemplateSelectedName = textfsmTemplateSelectedNameStore;
export const textfsmTemplateStatusState = textfsmTemplateStatusStateStore;

const STATUS = Object.freeze({
  templateLibrary: "templateLibrary",
  textfsmMapping: "textfsmMapping",
  textfsmTemplate: "textfsmTemplate",
});

const templateStatusStates = new Map([
  [STATUS.templateLibrary, templateLibraryStatusState],
  [STATUS.textfsmMapping, textfsmMappingStatusState],
  [STATUS.textfsmTemplate, textfsmTemplateStatusState],
]);

export function setStatus(target, message, tone = "info") {
  const presentation = statusPresentation(message, tone);
  templateStatusStates.get(target)?.set({
    message: presentation.inlineMessage,
    tone: presentation.tone,
  });
  if (presentation.shouldToast) {
    showToast(presentation.text, presentation.tone);
  }
}

function namedStatusMessage(key, fallback, name) {
  return `${tr(key, fallback)}: ${name}`;
}

function setNamedStatus(target, key, fallback, name, tone = "success") {
  setStatus(target, namedStatusMessage(key, fallback, name), tone);
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

function setTemplateLibraryPickerState(pickerState) {
  const names = Array.isArray(pickerState?.names) ? pickerState.names : [];
  const selected = safeString(pickerState?.selected || "");
  templateLibraryNames.set(names);
  templateLibrarySelectedName.set(selectedFromOptions(names, selected));
}

function setTemplateLibrarySelected(templateName = "") {
  templateLibrarySelectedName.set(safeString(templateName || ""));
}

export function setTemplateLibraryPickerValue(templateName = "") {
  setTemplateLibrarySelected(templateName);
}

function getTemplateLibrarySelected() {
  return safeString(getStore(templateLibrarySelectedName));
}

function setRunTemplateSelectState(selectState) {
  runTemplateSelectState.set({
    names: Array.isArray(selectState?.names) ? selectState.names : [],
    selected: safeString(selectState?.selected || ""),
  });
}

export function setRunTemplateSelectValue(templateName = "") {
  runTemplateSelectState.update((state) => ({
    ...state,
    selected: safeString(templateName).trim(),
  }));
}

function getRunTemplateSelectValue() {
  return safeString(getStore(runTemplateSelectState).selected || "").trim();
}

function setTemplateLibraryListState(listStateInput = {}) {
  templateLibraryListState.set({
    errorMessage: safeString(listStateInput.errorMessage || ""),
    selectedName: safeString(listStateInput.selectedName || ""),
    templateMetas: Array.isArray(listStateInput.templateMetas)
      ? listStateInput.templateMetas
      : [],
  });
}

function getTemplateContentValue() {
  return safeString(getStore(templateContentText));
}

function setTemplateContentValue(templateContent = "") {
  templateContentText.set(safeString(templateContent));
}

export function setTemplateLibraryContent(templateContent = "") {
  setTemplateContentValue(templateContent);
}

function templateNameRequired() {
  return tr("templateNameRequired", "template name is required");
}

function updateTemplateListState({
  errorMessage = "",
  metas = [],
  selectedName = "",
}) {
  setTemplateLibraryListState({
    errorMessage,
    selectedName,
    templateMetas: Array.isArray(metas) ? metas : [],
  });
}

function updateTemplateSelectOptions({ names = [], selectedName = "" }) {
  setTemplateLibraryPickerState({ names, selected: selectedName });
  setRunTemplateSelectState({
    names,
    selected: getRunTemplateSelectValue(),
  });
}

function createTemplateLibraryState() {
  let cachedTemplateMetas = [];
  let cachedTemplates = [];

  function templateExists(name) {
    return cachedTemplates.includes(name);
  }

  function refreshTemplateListState(errorMessage = "") {
    updateTemplateListState({
      errorMessage,
      metas: cachedTemplateMetas,
      selectedName: getTemplateLibrarySelected().trim(),
    });
  }

  function refreshTemplateOptions(selectedName = "") {
    updateTemplateSelectOptions({
      names: cachedTemplates,
      selectedName,
    });
  }

  async function loadTemplates() {
    try {
      const templateListPayload = await listTemplates();
      const templateMetas = Array.isArray(templateListPayload)
        ? templateListPayload
        : [];
      cachedTemplateMetas = templateMetas;
      cachedTemplates = templateMetas
        .map((templateMeta) => templateMeta.name)
        .filter(Boolean);
      refreshTemplateOptions(getTemplateLibrarySelected());
      refreshTemplateListState();
    } catch (error) {
      cachedTemplateMetas = [];
      cachedTemplates = [];
      refreshTemplateOptions("");
      refreshTemplateListState(error.message);
    }
  }

  async function loadTemplateDetail() {
    const name = getTemplateLibrarySelected().trim();
    if (!name) {
      setStatus(STATUS.templateLibrary, templateNameRequired(), "error");
      return null;
    }
    setRunningStatus(STATUS.templateLibrary);
    try {
      const templatePayload = await getTemplate(name);
      setTemplateLibrarySelected(templatePayload.name || name);
      setTemplateContentValue(templatePayload.content || "");
      setNamedStatus(
        STATUS.templateLibrary,
        "loaded",
        "Loaded",
        templatePayload.name || name,
      );
      return templatePayload;
    } catch (error) {
      setErrorStatus(STATUS.templateLibrary, error);
      return null;
    }
  }

  function clearTemplateDetail() {
    setTemplateContentValue("");
  }

  return {
    clearTemplateDetail,
    loadTemplateDetail,
    loadTemplates,
    refreshTemplateListState,
    refreshTemplateOptions,
    setTemplatePickerValue(templateName = "") {
      setTemplateLibrarySelected(templateName);
    },
    templateExists,
  };
}

async function loadExistingTemplate({ templateName, library }) {
  setTemplateLibrarySelected(templateName);
  library.refreshTemplateOptions(templateName);
  library.refreshTemplateListState();
  await library.loadTemplateDetail();
  library.refreshTemplateListState();
}

async function saveTemplateLibraryTemplate(library) {
  const name = getTemplateLibrarySelected().trim();
  const content = getTemplateContentValue();
  if (!name) {
    setStatus(STATUS.templateLibrary, templateNameRequired(), "error");
    return;
  }
  setRunningStatus(STATUS.templateLibrary);
  try {
    const exists = library.templateExists(name);
    const savedTemplatePayload = exists
      ? await updateTemplate(name, content)
      : await createTemplate(name, content);
    setStatus(
      STATUS.templateLibrary,
      `${exists ? tr("saved", "Saved") : tr("created", "Created")}: ${savedTemplatePayload.name || name}`,
      "success",
    );
    await library.loadTemplates();
    library.setTemplatePickerValue(savedTemplatePayload.name || name);
    library.refreshTemplateListState();
  } catch (error) {
    setErrorStatus(STATUS.templateLibrary, error);
  }
}

async function createTemplateLibraryDraft(library) {
  const templateNamePrompt = tr("templateNewPrompt", "New template name");
  const templateName = promptForResourceName(templateNamePrompt);
  if (!templateName) return;
  const draftContent = getTemplateContentValue();
  const exists = library.templateExists(templateName);
  if (exists) {
    await loadExistingTemplate({ templateName, library });
    setStatus(
      STATUS.templateLibrary,
      tr("templateExistsHint", "Template already exists"),
      "info",
    );
    return;
  }
  setRunningStatus(STATUS.templateLibrary);
  try {
    const createdTemplatePayload = await createTemplate(
      templateName,
      draftContent,
    );
    await library.loadTemplates();
    library.setTemplatePickerValue(createdTemplatePayload.name || templateName);
    setTemplateContentValue(createdTemplatePayload.content || "");
    library.refreshTemplateListState();
    setNamedStatus(
      STATUS.templateLibrary,
      "created",
      "Created",
      createdTemplatePayload.name || templateName,
    );
  } catch (error) {
    const message = String(error?.message || "");
    if (message.includes("already exists")) {
      await loadExistingTemplate({ templateName, library });
      setStatus(
        STATUS.templateLibrary,
        tr("templateExistsHint", "Template already exists"),
        "info",
      );
      return;
    }
    setStatus(
      STATUS.templateLibrary,
      message || tr("requestFailed", "request failed"),
      "error",
    );
  }
}

async function deleteTemplateLibraryTemplate(library) {
  const name = getTemplateLibrarySelected().trim();
  if (!name) {
    setStatus(STATUS.templateLibrary, templateNameRequired(), "error");
    return;
  }
  setRunningStatus(STATUS.templateLibrary);
  try {
    await deleteTemplateByName(name);
    setTemplateContentValue("");
    setNamedStatus(STATUS.templateLibrary, "deleted", "Deleted", name);
    await library.loadTemplates();
    if (getTemplateLibrarySelected().trim() === name) {
      library.setTemplatePickerValue("");
    }
    library.clearTemplateDetail();
    library.refreshTemplateListState();
  } catch (error) {
    setErrorStatus(STATUS.templateLibrary, error);
  }
}

async function selectTemplateLibraryName(library, templateName) {
  if (!templateName) return;
  await loadExistingTemplate({ templateName, library });
}

async function applyTemplateLibraryPickerChange(library) {
  if (!getTemplateLibrarySelected().trim()) return;
  await library.loadTemplateDetail();
  library.refreshTemplateListState();
}

export function createTemplateLibrarySectionWorkspace() {
  const library = createTemplateLibraryState();

  function init() {
    library.refreshTemplateListState();
  }

  return {
    createTemplateDraft: () => createTemplateLibraryDraft(library),
    deleteTemplate: () => deleteTemplateLibraryTemplate(library),
    init,
    load: library.loadTemplates,
    loadTemplates: library.loadTemplates,
    onTemplatePickerChange: () => applyTemplateLibraryPickerChange(library),
    refreshList: library.refreshTemplateListState,
    refreshOptions: library.refreshTemplateOptions,
    saveTemplate: () => saveTemplateLibraryTemplate(library),
    selectTemplateName: (templateName) =>
      selectTemplateLibraryName(library, templateName),
  };
}

export const textfsmMappingFormFieldUpdaters =
  textfsmMappingFormFieldUpdatersImpl;

export function setTextfsmMappingCommand(command = "") {
  setTextfsmMappingCommandImpl(command);
}

export function setTextfsmMappingProfile(deviceProfile = "") {
  setTextfsmMappingProfileImpl(deviceProfile);
}

export function setTextfsmMappingTemplateName(templateName = "") {
  setTextfsmMappingTemplateNameImpl(templateName);
}

export function setTextfsmTemplatePickerValue(templateName = "") {
  setTextfsmTemplatePickerValueImpl(templateName);
}

export function setTextfsmTemplateContent(templateContent = "") {
  setTextfsmTemplateContentImpl(templateContent);
}

export function createTextfsmMappingSectionWorkspace(hooks = {}) {
  return createTextfsmMappingSectionWorkspaceImpl(hooks);
}

export function createTextfsmTemplateSectionWorkspace(hooks = {}) {
  return createTextfsmTemplateSectionWorkspaceImpl(hooks);
}
