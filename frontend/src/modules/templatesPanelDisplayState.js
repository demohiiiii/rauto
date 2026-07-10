import { tr } from "../lib/i18n.js";
import { classNames, safeString, stringSelectOptionRows } from "../lib/ui.js";
import { derived } from "svelte/store";

export function templatePanelStatusDisplay(statusDisplay = {}) {
  return {
    message: statusDisplay.message || "",
    show: !!statusDisplay.show,
    tone: statusDisplay.tone || "info",
  };
}

function templatePickerItemClass(selected) {
  return classNames(
    "w-full rounded-xl border px-3 py-2 text-left transition",
    selected
      ? "border-teal-300 bg-teal-50/70"
      : "border-slate-200 bg-white hover:border-slate-300",
  );
}

function templatePickerDisplay(panelDisplayState = {}) {
  const title = safeString(panelDisplayState.title || "");
  const selectedName = safeString(panelDisplayState.selectedName || "");
  const names = Array.isArray(panelDisplayState.names)
    ? panelDisplayState.names
    : [];
  const resourceItems = names.map((name) => {
    const normalizedName = safeString(name);
    const selected = Boolean(selectedName && normalizedName === selectedName);
    return {
      badgeClass: classNames(
        "inline-flex min-h-6 min-w-6 items-center justify-center rounded-full border px-2 py-0.5 text-xs font-semibold",
        selected
          ? "border-teal-200 bg-teal-100 text-teal-700"
          : "border-transparent text-transparent",
      ),
      badgeText: selected ? "●" : "",
      itemClass: templatePickerItemClass(selected),
      name: normalizedName,
      nameText: normalizedName || "-",
    };
  });
  const errorMessage = safeString(panelDisplayState.errorMessage || "").trim();

  return {
    deleteLabel: tr("savedConnDeleteBtn", "Delete"),
    emptyStatus: errorMessage
      ? { message: errorMessage, tone: "error" }
      : {
          message: tr("templateSelectEmpty", "No templates available."),
          tone: "info",
        },
    hasItems: resourceItems.length > 0,
    resourceItems,
    rootClass: "grid gap-3",
    saveLabel: tr("savedConnSaveBtn", "Save"),
    selectedName,
    selectOptionRows: stringSelectOptionRows(names, {
      includeEmptyOption: true,
      placeholderText: title,
    }),
    selectPlaceholder: title,
  };
}

export function templateEditorPanelDisplayStores(panelDisplayStateStore) {
  const headerDisplayStateStore = derived(
    panelDisplayStateStore,
    ($panelDisplayStateStore) => ({
      editorTitle: $panelDisplayStateStore.editorTitle || "",
      hintText: $panelDisplayStateStore.hintText || "",
      listTitle: $panelDisplayStateStore.listTitle || "",
      newButtonLabel: $panelDisplayStateStore.newButtonLabel || "",
      title: $panelDisplayStateStore.title || "",
    }),
  );
  const pickerDisplayStateStore = derived(
    panelDisplayStateStore,
    ($panelDisplayStateStore) => templatePickerDisplay($panelDisplayStateStore),
  );
  const contentFieldStateStore = derived(
    panelDisplayStateStore,
    ($panelDisplayStateStore) => {
      const placeholderText = $panelDisplayStateStore.contentPlaceholder || "";
      return {
        ariaLabel: placeholderText,
        placeholderText,
        value: $panelDisplayStateStore.contentText || "",
      };
    },
  );
  const statusDisplayStateStore = derived(
    panelDisplayStateStore,
    ($panelDisplayStateStore) =>
      templatePanelStatusDisplay($panelDisplayStateStore.status),
  );
  return {
    contentFieldStateStore,
    headerDisplayStateStore,
    pickerDisplayStateStore,
    statusDisplayStateStore,
  };
}

export function builtinFlowTemplatePanelDisplayStores(panelDisplayStateStore) {
  const headerDisplayStateStore = derived(
    panelDisplayStateStore,
    ($panelDisplayStateStore) => ({
      copyButtonLabel: $panelDisplayStateStore.copyButtonLabel || "",
      detailButtonLabel: $panelDisplayStateStore.detailButtonLabel || "",
      hintText: $panelDisplayStateStore.hintText || "",
      title: $panelDisplayStateStore.title || "",
    }),
  );
  const selectFieldStateStore = derived(
    panelDisplayStateStore,
    ($panelDisplayStateStore) => ({
      ariaLabel: $panelDisplayStateStore.selectPlaceholder || "",
      optionRows: $panelDisplayStateStore.selectOptionRows || [],
      title: $panelDisplayStateStore.selectPlaceholder || "",
      value: $panelDisplayStateStore.selectedName || "",
    }),
  );
  const listDisplayStateStore = derived(
    panelDisplayStateStore,
    ($panelDisplayStateStore) => $panelDisplayStateStore.list || {},
  );
  const contentFieldStateStore = derived(
    panelDisplayStateStore,
    ($panelDisplayStateStore) => ({
      placeholderText: $panelDisplayStateStore.contentPlaceholder || "",
      value: $panelDisplayStateStore.contentText || "",
    }),
  );
  return {
    contentFieldStateStore,
    headerDisplayStateStore,
    listDisplayStateStore,
    selectFieldStateStore,
  };
}

export function textfsmMappingsPanelDisplayStores(
  panelDisplayStateStore,
  formDisplayStateStore,
) {
  const headerDisplayStateStore = derived(
    panelDisplayStateStore,
    ($panelDisplayStateStore) => ({
      refreshButtonLabel: $panelDisplayStateStore.refreshButtonLabel || "",
      title: $panelDisplayStateStore.title || "",
    }),
  );
  const formSectionDisplayStateStore = derived(
    formDisplayStateStore,
    ($formDisplayStateStore) => ({
      commandField: $formDisplayStateStore.fields.command,
      deleteButtonLabel: $formDisplayStateStore.deleteButtonLabel || "",
      hintText: $formDisplayStateStore.hintText || "",
      profileField: $formDisplayStateStore.fields.profile,
      saveButtonLabel: $formDisplayStateStore.saveButtonLabel || "",
      templateField: $formDisplayStateStore.fields.template,
    }),
  );
  const listDisplayStateStore = derived(
    panelDisplayStateStore,
    ($panelDisplayStateStore) => $panelDisplayStateStore.list || {},
  );
  const statusDisplayStateStore = derived(
    panelDisplayStateStore,
    ($panelDisplayStateStore) =>
      templatePanelStatusDisplay($panelDisplayStateStore.status),
  );
  return {
    formSectionDisplayStateStore,
    headerDisplayStateStore,
    listDisplayStateStore,
    statusDisplayStateStore,
  };
}

export function customShowObjectsPanelDisplayStores(panelDisplayStateStore) {
  const headerDisplayStateStore = derived(
    panelDisplayStateStore,
    ($panelDisplayStateStore) => ({
      refreshButtonLabel: $panelDisplayStateStore.refreshButtonLabel || "",
      title: $panelDisplayStateStore.title || "",
    }),
  );
  const listSectionDisplayStateStore = derived(
    panelDisplayStateStore,
    ($panelDisplayStateStore) => ({
      hintText: $panelDisplayStateStore.hintText || "",
      list: $panelDisplayStateStore.list || {},
      status: templatePanelStatusDisplay($panelDisplayStateStore.status),
    }),
  );
  return {
    headerDisplayStateStore,
    listSectionDisplayStateStore,
  };
}

export function customShowObjectEditorDisplayStores(
  formDisplayStateStore,
  commandDisplayStateStore,
) {
  const basicFieldsDisplayStateStore = derived(
    formDisplayStateStore,
    ($formDisplayStateStore) => ({
      enabledField: {
        checked: !!$formDisplayStateStore.fields.enabled,
        labelText: $formDisplayStateStore.enabledLabel || "",
        title: $formDisplayStateStore.enabledLabel || "",
      },
      modeField: $formDisplayStateStore.fields.mode,
      objectField: $formDisplayStateStore.fields.object,
      profileField: $formDisplayStateStore.fields.profile,
    }),
  );
  const commandSectionDisplayStateStore = derived(
    commandDisplayStateStore,
    ($commandDisplayStateStore) => ({
      manualCommandField: $commandDisplayStateStore.fields.manualCommand,
      mappingField: $commandDisplayStateStore.fields.mapping,
      templateField: $commandDisplayStateStore.fields.template,
      useMappingField: {
        checked: !!$commandDisplayStateStore.fields.useMapping,
        labelText: $commandDisplayStateStore.useMappingLabel || "",
        title: $commandDisplayStateStore.useMappingLabel || "",
      },
    }),
  );
  const buttonDisplayStateStore = derived(
    formDisplayStateStore,
    ($formDisplayStateStore) => ({
      deleteButtonLabel: $formDisplayStateStore.deleteButtonLabel || "",
      saveButtonLabel: $formDisplayStateStore.saveButtonLabel || "",
    }),
  );
  return {
    basicFieldsDisplayStateStore,
    buttonDisplayStateStore,
    commandSectionDisplayStateStore,
  };
}
