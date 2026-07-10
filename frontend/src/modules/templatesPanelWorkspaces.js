import { callIfFunction } from "../lib/events.js";
import { currentLanguageState } from "../lib/i18n.js";
import { createLoadingStateRunner } from "../lib/svelte.js";
import { derived, writable } from "svelte/store";
import {
  builtinFlowTemplatePanelDisplay,
  builtinFlowTemplateContentText,
  builtinFlowTemplateListState,
  builtinFlowTemplateNames,
  builtinFlowTemplateSelectedName,
  customFlowTemplatePanelDisplay,
  flowTemplateContentText,
  flowTemplateListState,
  flowTemplateNames,
  flowTemplateSelectedName,
  flowTemplateStatusState,
  setBuiltinFlowTemplatePickerValue,
  setFlowTemplateContent,
  setFlowTemplatePickerValue,
} from "./templatesFlow.js";
import {
  customShowObjectCommandDisplay,
  customShowObjectFormPresentation,
  customShowObjectsPanelDisplay,
  setTemplateLibraryContent,
  setTemplateLibraryPickerValue,
  setTextfsmTemplateContent,
  setTextfsmTemplatePickerValue,
  templateLibraryPanelDisplay,
  templateContentText,
  templateLibraryListState,
  templateLibraryNames,
  templateLibrarySelectedName,
  templateLibraryStatusState,
  textfsmMappingForm,
  textfsmMappingFormDisplay,
  textfsmMappingFormFieldUpdaters,
  textfsmMappingListState,
  textfsmMappingProfileState,
  textfsmMappingStatusState,
  textfsmMappingTemplateState,
  textfsmMappingsPanelDisplay,
  textfsmTemplateContentText,
  textfsmTemplateEditorPanelDisplay,
  textfsmTemplateListState,
  textfsmTemplateNames,
  textfsmTemplateSelectedName,
  textfsmTemplateStatusState,
} from "./templateSectionWorkspaces.js";
import {
  customShowObjectForm,
  customShowObjectFormFieldUpdaters,
  customShowObjectListState,
  customShowObjectMappingState,
  customShowObjectModeState,
  customShowObjectProfileState,
  customShowObjectTemplateState,
  showObjectStatusState,
} from "./templatesShowObjects.js";
import {
  builtinFlowTemplatePanelDisplayStores,
  customShowObjectEditorDisplayStores,
  customShowObjectsPanelDisplayStores,
  templateEditorPanelDisplayStores,
  textfsmMappingsPanelDisplayStores,
} from "./templatesPanelDisplayState.js";

function normalizeOptionalHandler(handler) {
  return typeof handler === "function" ? handler : null;
}

function createTemplatePanelLoadingWorkspace(loadingKeys = {}) {
  const loadingState = { keys: [] };
  const loadingFields = Object.keys(loadingKeys);
  const loadingStateStore = writable(
    Object.fromEntries(loadingFields.map((fieldName) => [fieldName, false])),
  );
  const loadingRunner = createLoadingStateRunner(loadingState, {
    setKeys(keys) {
      loadingStateStore.set(
        Object.fromEntries(
          loadingFields.map((fieldName) => [
            fieldName,
            keys.includes(loadingKeys[fieldName]),
          ]),
        ),
      );
    },
  });
  return {
    loadingRunner,
    loadingStateStore,
  };
}

export function createTemplateLibraryPanelWorkspace({
  onCreateDraft = null,
  onDelete = null,
  onPickerChange = null,
  onSave = null,
  onSelect = null,
} = {}) {
  const inputState = {
    onCreateDraft: normalizeOptionalHandler(onCreateDraft),
    onDelete: normalizeOptionalHandler(onDelete),
    onPickerChange: normalizeOptionalHandler(onPickerChange),
    onSave: normalizeOptionalHandler(onSave),
    onSelect: normalizeOptionalHandler(onSelect),
  };
  const { loadingRunner, loadingStateStore } =
    createTemplatePanelLoadingWorkspace({
      deleteLoading: "delete",
      newLoading: "new",
      saveLoading: "save",
    });
  const panelDisplayStateStore = derived(
    [
      templateContentText,
      templateLibraryListState,
      templateLibraryNames,
      templateLibrarySelectedName,
      templateLibraryStatusState,
      currentLanguageState,
    ],
    ([
      $templateContentText,
      $templateLibraryListState,
      $templateLibraryNames,
      $templateLibrarySelectedName,
      $templateLibraryStatusState,
      _currentLanguageState,
    ]) =>
      templateLibraryPanelDisplay({
        contentText: $templateContentText,
        listState: $templateLibraryListState,
        names: $templateLibraryNames,
        selectedName: $templateLibrarySelectedName,
        statusState: $templateLibraryStatusState,
      }),
  );
  const {
    contentFieldStateStore,
    headerDisplayStateStore,
    pickerDisplayStateStore,
    statusDisplayStateStore,
  } = templateEditorPanelDisplayStores(panelDisplayStateStore);
  return {
    changeContent: setTemplateLibraryContent,
    changePicker(templateName = "") {
      setTemplateLibraryPickerValue(templateName);
      return callIfFunction(inputState.onPickerChange);
    },
    contentFieldStateStore,
    createDraft() {
      return loadingRunner.run("new", inputState.onCreateDraft);
    },
    deleteTemplate() {
      return loadingRunner.run("delete", inputState.onDelete);
    },
    headerDisplayStateStore,
    loadingStateStore,
    panelDisplayStateStore,
    pickerDisplayStateStore,
    saveTemplate() {
      return loadingRunner.run("save", inputState.onSave);
    },
    selectTemplate(templateName = "") {
      return callIfFunction(inputState.onSelect, templateName);
    },
    statusDisplayStateStore,
  };
}

export function createTextfsmTemplateEditorPanelWorkspace({
  onCreateDraft = null,
  onDelete = null,
  onPickerChange = null,
  onSave = null,
  onSelect = null,
} = {}) {
  const inputState = {
    onCreateDraft: normalizeOptionalHandler(onCreateDraft),
    onDelete: normalizeOptionalHandler(onDelete),
    onPickerChange: normalizeOptionalHandler(onPickerChange),
    onSave: normalizeOptionalHandler(onSave),
    onSelect: normalizeOptionalHandler(onSelect),
  };
  const { loadingRunner, loadingStateStore } =
    createTemplatePanelLoadingWorkspace({
      deleteLoading: "template-delete",
      newLoading: "template-new",
      saveLoading: "template-save",
    });
  const panelDisplayStateStore = derived(
    [
      textfsmTemplateContentText,
      textfsmTemplateListState,
      textfsmTemplateNames,
      textfsmTemplateSelectedName,
      textfsmTemplateStatusState,
      currentLanguageState,
    ],
    ([
      $textfsmTemplateContentText,
      $textfsmTemplateListState,
      $textfsmTemplateNames,
      $textfsmTemplateSelectedName,
      $textfsmTemplateStatusState,
      _currentLanguageState,
    ]) =>
      textfsmTemplateEditorPanelDisplay({
        contentText: $textfsmTemplateContentText,
        listState: $textfsmTemplateListState,
        names: $textfsmTemplateNames,
        selectedName: $textfsmTemplateSelectedName,
        statusState: $textfsmTemplateStatusState,
      }),
  );
  const {
    contentFieldStateStore,
    headerDisplayStateStore,
    pickerDisplayStateStore,
    statusDisplayStateStore,
  } = templateEditorPanelDisplayStores(panelDisplayStateStore);
  return {
    changeContent: setTextfsmTemplateContent,
    changePicker(textfsmTemplateName = "") {
      setTextfsmTemplatePickerValue(textfsmTemplateName);
      return callIfFunction(inputState.onPickerChange);
    },
    contentFieldStateStore,
    createDraft() {
      return loadingRunner.run("template-new", inputState.onCreateDraft);
    },
    deleteTemplate() {
      return loadingRunner.run("template-delete", inputState.onDelete);
    },
    headerDisplayStateStore,
    loadingStateStore,
    panelDisplayStateStore,
    pickerDisplayStateStore,
    saveTemplate() {
      return loadingRunner.run("template-save", inputState.onSave);
    },
    selectTemplate(textfsmTemplateName = "") {
      return callIfFunction(inputState.onSelect, textfsmTemplateName);
    },
    statusDisplayStateStore,
  };
}

export function createBuiltinFlowTemplatePanelWorkspace({
  onCopy = null,
  onLoadBuiltinFlowTemplateDetail = null,
  onPickerChange = null,
  onSelect = null,
} = {}) {
  const inputState = {
    onCopy: normalizeOptionalHandler(onCopy),
    onLoadBuiltinFlowTemplateDetail: normalizeOptionalHandler(
      onLoadBuiltinFlowTemplateDetail,
    ),
    onPickerChange: normalizeOptionalHandler(onPickerChange),
    onSelect: normalizeOptionalHandler(onSelect),
  };
  const { loadingRunner, loadingStateStore } =
    createTemplatePanelLoadingWorkspace({
      copyLoading: "builtin-copy",
      detailLoading: "builtin-detail",
    });
  const panelDisplayStateStore = derived(
    [
      builtinFlowTemplateContentText,
      builtinFlowTemplateListState,
      builtinFlowTemplateNames,
      builtinFlowTemplateSelectedName,
      currentLanguageState,
    ],
    ([
      $builtinFlowTemplateContentText,
      $builtinFlowTemplateListState,
      $builtinFlowTemplateNames,
      $builtinFlowTemplateSelectedName,
      _currentLanguageState,
    ]) =>
      builtinFlowTemplatePanelDisplay({
        contentText: $builtinFlowTemplateContentText,
        listState: $builtinFlowTemplateListState,
        names: $builtinFlowTemplateNames,
        selectedName: $builtinFlowTemplateSelectedName,
      }),
  );
  function changePicker(builtinFlowTemplateName = "") {
    setBuiltinFlowTemplatePickerValue(builtinFlowTemplateName);
    return callIfFunction(inputState.onPickerChange, builtinFlowTemplateName);
  }
  function selectTemplate(builtinFlowTemplateName = "") {
    return callIfFunction(inputState.onSelect, builtinFlowTemplateName);
  }
  const {
    contentFieldStateStore,
    headerDisplayStateStore,
    listDisplayStateStore,
    selectFieldStateStore,
  } = builtinFlowTemplatePanelDisplayStores(panelDisplayStateStore);
  return {
    changePicker,
    contentFieldStateStore,
    copyTemplate() {
      return loadingRunner.run("builtin-copy", inputState.onCopy);
    },
    headerDisplayStateStore,
    listDisplayStateStore,
    loadDetail() {
      return loadingRunner.run(
        "builtin-detail",
        inputState.onLoadBuiltinFlowTemplateDetail,
      );
    },
    loadingStateStore,
    panelDisplayStateStore,
    selectFieldStateStore,
    selectTemplate,
  };
}

export function createCustomFlowTemplatePanelWorkspace({
  onCreateDraft = null,
  onDelete = null,
  onPickerChange = null,
  onSave = null,
  onSelect = null,
} = {}) {
  const inputState = {
    onCreateDraft: normalizeOptionalHandler(onCreateDraft),
    onDelete: normalizeOptionalHandler(onDelete),
    onPickerChange: normalizeOptionalHandler(onPickerChange),
    onSave: normalizeOptionalHandler(onSave),
    onSelect: normalizeOptionalHandler(onSelect),
  };
  const { loadingRunner, loadingStateStore } =
    createTemplatePanelLoadingWorkspace({
      deleteLoading: "flow-delete",
      newLoading: "flow-new",
      saveLoading: "flow-save",
    });
  const panelDisplayStateStore = derived(
    [
      flowTemplateContentText,
      flowTemplateListState,
      flowTemplateNames,
      flowTemplateSelectedName,
      flowTemplateStatusState,
      currentLanguageState,
    ],
    ([
      $flowTemplateContentText,
      $flowTemplateListState,
      $flowTemplateNames,
      $flowTemplateSelectedName,
      $flowTemplateStatusState,
      _currentLanguageState,
    ]) =>
      customFlowTemplatePanelDisplay({
        contentText: $flowTemplateContentText,
        listState: $flowTemplateListState,
        names: $flowTemplateNames,
        selectedName: $flowTemplateSelectedName,
        statusState: $flowTemplateStatusState,
      }),
  );
  const {
    contentFieldStateStore,
    headerDisplayStateStore,
    pickerDisplayStateStore,
    statusDisplayStateStore,
  } = templateEditorPanelDisplayStores(panelDisplayStateStore);
  return {
    changeContent: setFlowTemplateContent,
    changePicker(flowTemplateName = "") {
      setFlowTemplatePickerValue(flowTemplateName);
      return callIfFunction(inputState.onPickerChange);
    },
    contentFieldStateStore,
    createDraft() {
      return loadingRunner.run("flow-new", inputState.onCreateDraft);
    },
    deleteTemplate() {
      return loadingRunner.run("flow-delete", inputState.onDelete);
    },
    headerDisplayStateStore,
    loadingStateStore,
    panelDisplayStateStore,
    pickerDisplayStateStore,
    saveTemplate() {
      return loadingRunner.run("flow-save", inputState.onSave);
    },
    selectTemplate(flowTemplateName = "") {
      return callIfFunction(inputState.onSelect, flowTemplateName);
    },
    statusDisplayStateStore,
  };
}

export function createCustomShowObjectsPanelWorkspace({
  onCommandInput = null,
  onDelete = null,
  onMappingChange = null,
  onProfileChange = null,
  onRefresh = null,
  onSave = null,
  onSelect = null,
  onUseMappingChange = null,
} = {}) {
  const inputState = {
    onCommandInput: normalizeOptionalHandler(onCommandInput),
    onDelete: normalizeOptionalHandler(onDelete),
    onMappingChange: normalizeOptionalHandler(onMappingChange),
    onProfileChange: normalizeOptionalHandler(onProfileChange),
    onRefresh: normalizeOptionalHandler(onRefresh),
    onSave: normalizeOptionalHandler(onSave),
    onSelect: normalizeOptionalHandler(onSelect),
    onUseMappingChange: normalizeOptionalHandler(onUseMappingChange),
  };
  const { loadingRunner, loadingStateStore } =
    createTemplatePanelLoadingWorkspace({
      deleteLoading: "delete",
      refreshLoading: "refresh",
      saveLoading: "save",
    });
  const panelDisplayStateStore = derived(
    [customShowObjectListState, showObjectStatusState, currentLanguageState],
    ([
      $customShowObjectListState,
      $showObjectStatusState,
      _currentLanguageState,
    ]) =>
      customShowObjectsPanelDisplay({
        listState: $customShowObjectListState,
        statusState: $showObjectStatusState,
      }),
  );
  const formDisplayStateStore = derived(
    [
      customShowObjectForm,
      customShowObjectModeState,
      customShowObjectProfileState,
      currentLanguageState,
    ],
    ([
      $customShowObjectForm,
      $customShowObjectModeState,
      $customShowObjectProfileState,
      _currentLanguageState,
    ]) =>
      customShowObjectFormPresentation({
        form: $customShowObjectForm,
        modeState: $customShowObjectModeState,
        profileState: $customShowObjectProfileState,
      }),
  );
  const commandDisplayStateStore = derived(
    [
      customShowObjectForm,
      customShowObjectMappingState,
      customShowObjectTemplateState,
      currentLanguageState,
    ],
    ([
      $customShowObjectForm,
      $customShowObjectMappingState,
      $customShowObjectTemplateState,
      _currentLanguageState,
    ]) =>
      customShowObjectCommandDisplay({
        form: $customShowObjectForm,
        mappingState: $customShowObjectMappingState,
        templateState: $customShowObjectTemplateState,
      }),
  );
  const {
    basicFieldsDisplayStateStore,
    buttonDisplayStateStore,
    commandSectionDisplayStateStore,
  } = customShowObjectEditorDisplayStores(
    formDisplayStateStore,
    commandDisplayStateStore,
  );
  const { headerDisplayStateStore, listSectionDisplayStateStore } =
    customShowObjectsPanelDisplayStores(panelDisplayStateStore);
  return {
    basicFieldsDisplayStateStore,
    buttonDisplayStateStore,
    changeCommand(manualCommand = "") {
      customShowObjectFormFieldUpdaters.manualCommand(manualCommand);
      return callIfFunction(inputState.onCommandInput);
    },
    changeEnabled(enabled) {
      customShowObjectFormFieldUpdaters.enabled(enabled);
    },
    changeMapping(mappingCommand = "") {
      customShowObjectFormFieldUpdaters.textfsmMappingCommand(mappingCommand);
      return callIfFunction(inputState.onMappingChange);
    },
    changeMode(mode = "") {
      customShowObjectFormFieldUpdaters.mode(mode);
    },
    changeObject(objectName = "") {
      customShowObjectFormFieldUpdaters.object(objectName);
    },
    changeProfile(deviceProfile = "") {
      customShowObjectFormFieldUpdaters.profile(deviceProfile);
      return callIfFunction(inputState.onProfileChange);
    },
    changeTemplate(templateName = "") {
      customShowObjectFormFieldUpdaters.textfsmTemplate(templateName);
    },
    changeUseMapping(useMapping) {
      customShowObjectFormFieldUpdaters.useMapping(useMapping);
      return callIfFunction(inputState.onUseMappingChange);
    },
    commandDisplayStateStore,
    commandSectionDisplayStateStore,
    deleteCustomShowObject() {
      return loadingRunner.run("delete", inputState.onDelete);
    },
    formDisplayStateStore,
    headerDisplayStateStore,
    listSectionDisplayStateStore,
    loadingStateStore,
    panelDisplayStateStore,
    refreshCustomShowObjects() {
      return loadingRunner.run("refresh", inputState.onRefresh);
    },
    saveCustomShowObject() {
      return loadingRunner.run("save", inputState.onSave);
    },
    selectItem(customShowObjectName = "") {
      return callIfFunction(inputState.onSelect, customShowObjectName);
    },
  };
}

export function createTextfsmMappingsPanelWorkspace({
  onDelete = null,
  onLoad = null,
  onProfileChange = null,
  onSave = null,
  onSelect = null,
} = {}) {
  const inputState = {
    onDelete: normalizeOptionalHandler(onDelete),
    onLoad: normalizeOptionalHandler(onLoad),
    onProfileChange: normalizeOptionalHandler(onProfileChange),
    onSave: normalizeOptionalHandler(onSave),
    onSelect: normalizeOptionalHandler(onSelect),
  };
  const { loadingRunner, loadingStateStore } =
    createTemplatePanelLoadingWorkspace({
      deleteLoading: "mapping-delete",
      refreshLoading: "mapping-refresh",
      saveLoading: "mapping-save",
    });
  const panelDisplayStateStore = derived(
    [textfsmMappingListState, textfsmMappingStatusState, currentLanguageState],
    ([
      $textfsmMappingListState,
      $textfsmMappingStatusState,
      _currentLanguageState,
    ]) =>
      textfsmMappingsPanelDisplay({
        listState: $textfsmMappingListState,
        statusState: $textfsmMappingStatusState,
      }),
  );
  const formDisplayStateStore = derived(
    [
      textfsmMappingForm,
      textfsmMappingProfileState,
      textfsmMappingTemplateState,
      currentLanguageState,
    ],
    ([
      $textfsmMappingForm,
      $textfsmMappingProfileState,
      $textfsmMappingTemplateState,
      _currentLanguageState,
    ]) =>
      textfsmMappingFormDisplay({
        form: $textfsmMappingForm,
        profileState: $textfsmMappingProfileState,
        templateState: $textfsmMappingTemplateState,
      }),
  );
  const {
    formSectionDisplayStateStore,
    headerDisplayStateStore,
    listDisplayStateStore,
    statusDisplayStateStore,
  } = textfsmMappingsPanelDisplayStores(
    panelDisplayStateStore,
    formDisplayStateStore,
  );
  return {
    changeCommand(mappingCommand = "") {
      textfsmMappingFormFieldUpdaters.command(mappingCommand);
    },
    changeProfile(deviceProfile = "") {
      textfsmMappingFormFieldUpdaters.profile(deviceProfile);
      return callIfFunction(inputState.onProfileChange, deviceProfile);
    },
    changeTemplate(templateName = "") {
      textfsmMappingFormFieldUpdaters.template(templateName);
    },
    deleteTextfsmMapping() {
      return loadingRunner.run("mapping-delete", inputState.onDelete);
    },
    formDisplayStateStore,
    formSectionDisplayStateStore,
    headerDisplayStateStore,
    listDisplayStateStore,
    loadingStateStore,
    loadTextfsmMappings() {
      return loadingRunner.run("mapping-refresh", inputState.onLoad);
    },
    panelDisplayStateStore,
    saveTextfsmMapping() {
      return loadingRunner.run("mapping-save", inputState.onSave);
    },
    selectItem(textfsmMapping = "") {
      return callIfFunction(inputState.onSelect, textfsmMapping);
    },
    statusDisplayStateStore,
  };
}

export function createTemplateResourcePickerPanelWorkspace({
  onPickerChange = null,
  onSelect = null,
} = {}) {
  const inputState = {
    onPickerChange: normalizeOptionalHandler(onPickerChange),
    onSelect: normalizeOptionalHandler(onSelect),
  };
  function changePicker(templateResourceName = "") {
    return callIfFunction(inputState.onPickerChange, templateResourceName);
  }
  function selectItem(templateResourceName = "") {
    return callIfFunction(inputState.onSelect, templateResourceName);
  }
  return {
    changePicker,
    selectItem,
  };
}
