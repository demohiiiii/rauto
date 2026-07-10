import { getDeviceProfilesOverview } from "../api/client.js";
import {
  defaultTemplatePageSection,
  normalizeTemplatePageSection,
} from "../config/dashboardModes.js";
import { currentLanguageState } from "../lib/i18n.js";
import { derived, get as getStore, writable } from "svelte/store";
import {
  createCustomShowObjectSectionWorkspace,
  getCachedDeviceProfiles,
  notifyCustomShowObjectsChanged,
  setCachedDeviceProfiles,
} from "./templatesShowObjects.js";
import {
  createTemplateLibrarySectionWorkspace,
  createTextfsmMappingSectionWorkspace,
  createTextfsmTemplateSectionWorkspace,
  templatesProtectedResourcesRefreshState,
} from "./templateSectionRuntimeState.js";
import { templatePageDisplay } from "./templateSectionDisplayState.js";
import { createFlowTemplateSectionWorkspace as createFlowTemplateSectionWorkspaceOwner } from "./templatesFlow.js";
export * from "./templateSectionDisplayState.js";
export * from "./templateSectionRuntimeState.js";

function deviceProfileNamesFromOverview(profilesOverviewPayload) {
  return [
    ...(Array.isArray(profilesOverviewPayload?.builtins)
      ? profilesOverviewPayload.builtins
      : []
    ).map((builtinProfile) => builtinProfile.name),
    ...(Array.isArray(profilesOverviewPayload?.custom)
      ? profilesOverviewPayload.custom
      : []
    ).map((customProfile) => customProfile.name),
  ].filter((name, index, values) => !!name && values.indexOf(name) === index);
}

export function createTemplatesWorkspace(hooks = {}) {
  let cachedDeviceProfileNames = [];
  let initialized = false;

  function getDeviceProfileNames() {
    return cachedDeviceProfileNames.length
      ? cachedDeviceProfileNames
      : getCachedDeviceProfiles();
  }

  function refreshDeviceProfileOptions() {
    textfsmMappingSection.refreshProfileOptions();
    customShowObjectSection.refreshProfileOptions();
  }

  function refreshTemplatesLanguageFields() {
    templateLibrarySection.refreshOptions();
    templateLibrarySection.refreshList();
    flowTemplateSection.refreshOptions();
    flowTemplateSection.refreshList();
    flowTemplateSection.refreshBuiltinList();
  }

  async function loadDeviceProfileOptions() {
    try {
      const profilesOverviewPayload = await getDeviceProfilesOverview();
      cachedDeviceProfileNames = deviceProfileNamesFromOverview(
        profilesOverviewPayload,
      );
      setCachedDeviceProfiles(cachedDeviceProfileNames);
    } catch (_) {
      cachedDeviceProfileNames = getCachedDeviceProfiles();
    }

    refreshDeviceProfileOptions();
    customShowObjectSection.loadModes();
  }

  async function loadTemplateCollections() {
    await Promise.allSettled([
      loadDeviceProfileOptions(),
      templateLibrarySection.load(),
      flowTemplateSection.load(),
      textfsmTemplateSection.load(),
      textfsmMappingSection.load(),
      customShowObjectSection.loadMappings(),
      customShowObjectSection.load(),
    ]);
  }

  function openSection(sectionKey) {
    const normalizedSection = normalizeTemplatePageSection(sectionKey);
    if (normalizedSection === "textfsm") {
      loadDeviceProfileOptions();
      textfsmTemplateSection.load();
      textfsmMappingSection.load();
    }
    if (normalizedSection === "show-objects") {
      loadDeviceProfileOptions();
      textfsmTemplateSection.load();
      customShowObjectSection.loadMappings();
      customShowObjectSection.load();
    }
    return normalizedSection;
  }

  const templateLibrarySection = createTemplateLibrarySectionWorkspace();
  const flowTemplateSection = createFlowTemplateSectionWorkspaceOwner();
  const customShowObjectSection = createCustomShowObjectSectionWorkspace({
    getDeviceProfiles: getDeviceProfileNames,
    onCustomObjectsChanged:
      hooks.onCustomObjectsChanged || notifyCustomShowObjectsChanged,
  });
  const textfsmMappingSection = createTextfsmMappingSectionWorkspace({
    getDeviceProfiles: getDeviceProfileNames,
    onProfileChange: () => textfsmMappingSection.load(),
    onMappingsChanged: (profile) =>
      customShowObjectSection.loadMappings(profile),
  });
  const textfsmTemplateSection = createTextfsmTemplateSectionWorkspace({
    onTemplateDeleted: () => textfsmMappingSection.load(),
    onTemplateSaved: () => textfsmMappingSection.refreshList(),
  });
  const initWorkspaces = [
    templateLibrarySection,
    customShowObjectSection,
    textfsmMappingSection,
    textfsmTemplateSection,
  ];

  function init() {
    if (initialized) return;
    initialized = true;
    flowTemplateSection.init();
    initWorkspaces.forEach((sectionWorkspace) => sectionWorkspace.init());
    refreshDeviceProfileOptions();
  }

  function destroy() {
    initialized = false;
    cachedDeviceProfileNames = [];
  }

  return {
    copyBuiltinFlowTemplateToCustom:
      flowTemplateSection.copyBuiltinFlowTemplateToCustom,
    createFlowTemplateDraft: flowTemplateSection.createFlowTemplateDraft,
    createTemplateDraft: templateLibrarySection.createTemplateDraft,
    createTextfsmTemplateDraft:
      textfsmTemplateSection.createTextfsmTemplateDraft,
    deleteCustomShowObject: customShowObjectSection.deleteCustomShowObject,
    deleteFlowTemplate: flowTemplateSection.deleteFlowTemplate,
    deleteTemplate: templateLibrarySection.deleteTemplate,
    deleteTextfsmMapping: textfsmMappingSection.deleteTextfsmMapping,
    deleteTextfsmTemplate: textfsmTemplateSection.deleteTextfsmTemplate,
    destroy,
    handleCustomShowObjectCommandInput: customShowObjectSection.onCommandInput,
    handleCustomShowObjectMappingChange:
      customShowObjectSection.onMappingChange,
    handleCustomShowObjectProfileChange:
      customShowObjectSection.onProfileChange,
    handleCustomShowObjectUseMappingChange:
      customShowObjectSection.onUseMappingChange,
    handleFlowTemplatePickerChange:
      flowTemplateSection.onFlowTemplatePickerChange,
    handleTemplatePickerChange: templateLibrarySection.onTemplatePickerChange,
    handleTextfsmMappingProfileChange: textfsmMappingSection.onProfileChange,
    init,
    loadTemplateCollections,
    loadBuiltinFlowTemplateDetail:
      flowTemplateSection.loadBuiltinFlowTemplateDetail,
    loadDeviceProfileOptions,
    loadTextfsmMappings: textfsmMappingSection.loadTextfsmMappings,
    openSection,
    refreshTemplatesLanguageFields,
    refreshCustomShowObjects: customShowObjectSection.refreshCustomShowObjects,
    refreshSelectedBuiltinFlowTemplate:
      flowTemplateSection.refreshSelectedBuiltinFlowTemplate,
    refreshSelectedTextfsmTemplate:
      textfsmTemplateSection.refreshSelectedTextfsmTemplate,
    saveCustomShowObject: customShowObjectSection.saveCustomShowObject,
    saveFlowTemplate: flowTemplateSection.saveFlowTemplate,
    saveTemplate: templateLibrarySection.saveTemplate,
    saveTextfsmMapping: textfsmMappingSection.saveTextfsmMapping,
    saveTextfsmTemplate: textfsmTemplateSection.saveTextfsmTemplate,
    selectBuiltinFlowTemplateName:
      flowTemplateSection.selectBuiltinFlowTemplateName,
    selectCustomShowObject: customShowObjectSection.selectCustomShowObject,
    selectFlowTemplateName: flowTemplateSection.selectFlowTemplateName,
    selectTemplateName: templateLibrarySection.selectTemplateName,
    selectTextfsmMapping: textfsmMappingSection.selectTextfsmMapping,
    selectTextfsmTemplateName: textfsmTemplateSection.selectTextfsmTemplateName,
  };
}

export function createTemplatesPageWorkspace(hooks = {}) {
  const templatesWorkspace = createTemplatesWorkspace(hooks);
  const currentTemplateSectionState = writable(
    normalizeTemplatePageSection(defaultTemplatePageSection),
  );
  const pageDisplayStateStore = derived(
    [currentTemplateSectionState, currentLanguageState],
    ([$currentTemplateSectionState, _currentLanguageState]) =>
      templatePageDisplay($currentTemplateSectionState),
  );
  const pageSyncStateStore = derived(
    [currentLanguageState, templatesProtectedResourcesRefreshState],
    ([$currentLanguageState, $templatesProtectedResourcesRefreshState]) => ({
      language: $currentLanguageState,
      protectedResourcesVersion: $templatesProtectedResourcesRefreshState,
    }),
  );
  let didLoadTemplateCollections = false;
  let initialized = false;
  let lastLanguage = "";
  let lastProtectedResourcesVersion = 0;

  function resetPageState() {
    didLoadTemplateCollections = false;
    initialized = false;
    lastLanguage = "";
    lastProtectedResourcesVersion = 0;
  }

  function openTemplateSection(templateSection) {
    const normalizedSection = templatesWorkspace.openSection(templateSection);
    currentTemplateSectionState.set(normalizedSection);
    return normalizedSection;
  }

  function setPageContext({ active = false } = {}) {
    if (!active) {
      resetPageState();
      templatesWorkspace.destroy();
      return;
    }
    const { language, protectedResourcesVersion } =
      getStore(pageSyncStateStore);
    if (!initialized) {
      initialized = true;
      templatesWorkspace.init();
    }
    if (!didLoadTemplateCollections) {
      didLoadTemplateCollections = true;
      void templatesWorkspace.loadTemplateCollections();
    }
    if (lastLanguage !== language) {
      lastLanguage = language;
      templatesWorkspace.refreshTemplatesLanguageFields();
    }
    if (lastProtectedResourcesVersion !== protectedResourcesVersion) {
      lastProtectedResourcesVersion = protectedResourcesVersion;
      void templatesWorkspace.loadTemplateCollections();
    }
  }

  function destroy() {
    resetPageState();
    templatesWorkspace.destroy();
  }

  return {
    ...templatesWorkspace,
    currentTemplateSectionState,
    destroy,
    openTemplateSection,
    pageDisplayStateStore,
    setPageContext,
  };
}
