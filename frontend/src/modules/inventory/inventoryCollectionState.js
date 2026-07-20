import {
  deleteInventoryGroup,
  deleteInventoryLabel,
  getInventoryGroup,
  getInventoryLabel,
  listConnections,
  listInventoryGroups,
  listInventoryLabels,
  saveInventoryGroup,
  saveInventoryLabel,
} from "../../api/client.js";
import { INVENTORY_KIND } from "../../config/dashboardModes.js";
import { promptForResourceName } from "../../lib/ui.js";
import { tr } from "../../lib/i18n.js";
import {
  CONNECTION_PICKER,
  getConnectionGroupValues,
  refreshSavedConnectionGroupOptions,
  refreshSavedConnectionLabelOptions,
} from "../connections/connectionFieldStoreState.js";
import { loadSavedConnections } from "../connections/connections.js";
import {
  applySelectedInventoryItem,
  applyInventoryGroupFormState,
  applyInventoryLabelFormState,
  buildInventoryGroupFormPayload,
  createInventoryHostSelection,
  createInventoryStateContext,
  createInventoryWorkspaceState,
  inventorySelectionFor,
  normalizeInventoryItems,
  refreshInventoryHostChecklist,
  requireInventoryName,
  resetInventoryGroupFormState,
  resetInventoryLabelFormState,
  setInventorySelection,
  sortedInventoryHosts,
} from "./inventoryCollectionStoreState.js";

async function loadInventoryDetail({
  applyForm,
  getDetail,
  kind,
  refreshList,
  resetForm,
  setStatus,
  stateContext,
  statusKind = kind,
}) {
  const inventoryName = stateContext.selectedInventoryName(kind);
  if (!inventoryName) {
    resetForm("");
    setStatus(statusKind, "-", "info");
    refreshList();
    return;
  }
  setStatus(statusKind, tr("running", "running"), "running");
  try {
    const inventoryDetailPayload = await getDetail(inventoryName);
    applyForm(inventoryDetailPayload);
    refreshList();
    setStatus(
      statusKind,
      `${tr("loaded", "loaded")}: ${inventoryDetailPayload.name || inventoryName}`,
      "success",
    );
  } catch (error) {
    setStatus(statusKind, error.message, "error");
  }
}

async function loadInventoryCollection({
  applySelected,
  listItems,
  onLoaded,
  onReset,
  refreshList,
  refreshOptions,
  refreshSnapshots,
  selectedName = "",
}) {
  try {
    const inventoryItems = await listItems();
    onLoaded(inventoryItems);
    refreshSnapshots();
    refreshOptions(selectedName);
    refreshList();
    applySelected();
  } catch (error) {
    onReset();
    refreshSnapshots();
    refreshOptions("");
    refreshList(error.message);
  }
}

async function createInventoryDraft({
  existsHint,
  inventoryItems,
  kind,
  loadDetail,
  promptForInventoryName,
  promptMessage,
  saveByName,
  setStatus,
  stateContext,
  statusKind = kind,
}) {
  const trimmedName = promptForInventoryName(promptMessage);
  if (!trimmedName) return;
  if (
    inventoryItems.some((inventoryItem) => inventoryItem.name === trimmedName)
  ) {
    stateContext.setInventorySelectedName(kind, trimmedName);
    await loadDetail();
    setStatus(statusKind, existsHint, "info");
    return;
  }
  await saveByName(trimmedName, tr("created", "created"));
}

async function saveInventoryEntity({
  applyForm,
  buildPayload,
  inventoryName,
  saveEntity,
  setStatus,
  statusKind,
  verb = tr("saved", "saved"),
  reload,
}) {
  setStatus(statusKind, tr("running", "running"), "running");
  try {
    const savedInventoryPayload = await saveEntity(
      inventoryName,
      buildPayload(inventoryName),
    );
    applyForm(savedInventoryPayload);
    setStatus(
      statusKind,
      `${verb}: ${savedInventoryPayload.name || inventoryName}`,
      "success",
    );
    await reload();
  } catch (error) {
    setStatus(statusKind, error.message, "error");
  }
}

async function deleteInventoryEntity({
  deleteEntity,
  inventoryName,
  reload,
  resetForm,
  setStatus,
  statusKind,
}) {
  setStatus(statusKind, tr("running", "running"), "running");
  try {
    await deleteEntity(inventoryName);
    resetForm("");
    setStatus(
      statusKind,
      `${tr("deleted", "deleted")}: ${inventoryName}`,
      "success",
    );
    await reload();
  } catch (error) {
    setStatus(statusKind, error.message, "error");
  }
}

function createInventoryWorkspaceCoordinator({
  dependencies,
  stateContext,
  workspaceState,
}) {
  function setStatus(kind, message, tone = "info") {
    stateContext.updateInventoryState(kind, {
      statusMessage: message || "",
      statusTone: tone || "info",
    });
  }

  function refreshInventoryHosts(kind) {
    refreshInventoryHostChecklist({ kind, workspaceState });
  }

  function refreshInventoryGroupHosts() {
    refreshInventoryHosts(INVENTORY_KIND.groups);
  }

  function refreshInventoryLabelHosts() {
    refreshInventoryHosts(INVENTORY_KIND.labels);
  }

  function applyInventoryGroupForm(inventoryGroup) {
    setInventorySelection(
      workspaceState,
      INVENTORY_KIND.groups,
      applyInventoryGroupFormState({
        group: inventoryGroup || {},
        stateContext,
      }),
    );
    refreshInventoryGroupHosts();
  }

  function inventoryGroupFormPayload(inventoryName) {
    return buildInventoryGroupFormPayload({
      hostSelection: workspaceState.groupHostSelection,
      inventoryName,
      stateContext,
    });
  }

  function refreshInventoryGroupList(errorMessage = "") {
    stateContext.updateInventoryState("groups", {
      collectionItems: workspaceState.groups,
      errorMessage,
      selectedName: stateContext.selectedInventoryName("groups"),
    });
  }

  function refreshInventoryGroupOptions(selectedName = "") {
    stateContext.setInventoryPickerOptions(
      INVENTORY_KIND.groups,
      workspaceState.groups,
      selectedName,
    );
    refreshInventoryGroupHosts();
    dependencies.refreshSavedConnectionGroupOptions(
      dependencies.getSavedConnectionGroupValues(),
    );
  }

  function resetInventoryGroupForm(inventoryName = "") {
    setInventorySelection(
      workspaceState,
      INVENTORY_KIND.groups,
      resetInventoryGroupFormState({ inventoryName, stateContext }),
    );
    refreshInventoryGroupHosts();
  }

  function applyInventoryLabelForm(inventoryLabel) {
    setInventorySelection(
      workspaceState,
      INVENTORY_KIND.labels,
      applyInventoryLabelFormState({
        label: inventoryLabel || {},
        stateContext,
      }),
    );
    refreshInventoryLabelHosts();
  }

  function refreshInventoryLabelList(errorMessage = "") {
    stateContext.updateInventoryState("labels", {
      collectionItems: workspaceState.labels,
      errorMessage,
      selectedName: stateContext.selectedInventoryName("labels"),
    });
  }

  function refreshInventoryLabelOptions(selectedName = "") {
    stateContext.setInventoryPickerOptions(
      INVENTORY_KIND.labels,
      workspaceState.labels,
      selectedName,
    );
    refreshInventoryLabelHosts();
    dependencies.refreshSavedConnectionLabelOptions();
  }

  function resetInventoryLabelForm(inventoryName = "") {
    setInventorySelection(
      workspaceState,
      INVENTORY_KIND.labels,
      resetInventoryLabelFormState({ inventoryName, stateContext }),
    );
    refreshInventoryLabelHosts();
  }

  return {
    applyInventoryGroupForm,
    applyInventoryLabelForm,
    inventoryGroupFormPayload,
    refreshInventoryGroupHosts,
    refreshInventoryGroupList,
    refreshInventoryGroupOptions,
    refreshInventoryLabelHosts,
    refreshInventoryLabelList,
    refreshInventoryLabelOptions,
    resetInventoryGroupForm,
    resetInventoryLabelForm,
    setStatus,
  };
}

function createInventoryLoaders({ coordinator, stateContext, workspaceState }) {
  async function loadInventoryConnections() {
    try {
      const connectionsPayload = await listConnections();
      workspaceState.savedConnections =
        normalizeInventoryItems(connectionsPayload);
    } catch (_) {
      workspaceState.savedConnections = [];
    }
    coordinator.refreshInventoryGroupHosts();
    coordinator.refreshInventoryLabelHosts();
  }

  async function loadInventoryGroups() {
    await loadInventoryCollection({
      applySelected: () =>
        applySelectedInventoryItem({
          applyForm: coordinator.applyInventoryGroupForm,
          inventoryItems: workspaceState.groups,
          kind: "groups",
          stateContext,
        }),
      listItems: async () => {
        const inventoryGroupsPayload = await listInventoryGroups();
        return normalizeInventoryItems(inventoryGroupsPayload);
      },
      onLoaded: (inventoryGroups) => {
        workspaceState.groups = inventoryGroups;
      },
      onReset: () => {
        workspaceState.groups = [];
      },
      refreshList: coordinator.refreshInventoryGroupList,
      refreshOptions: coordinator.refreshInventoryGroupOptions,
      refreshSnapshots: () =>
        stateContext.refreshInventorySnapshots(workspaceState),
      selectedName: stateContext.selectedInventoryName("groups"),
    });
  }

  async function loadInventoryLabels() {
    await loadInventoryCollection({
      applySelected: () =>
        applySelectedInventoryItem({
          applyForm: coordinator.applyInventoryLabelForm,
          inventoryItems: workspaceState.labels,
          kind: "labels",
          stateContext,
        }),
      listItems: async () => {
        const inventoryLabelsPayload = await listInventoryLabels();
        return normalizeInventoryItems(inventoryLabelsPayload);
      },
      onLoaded: (inventoryLabels) => {
        workspaceState.labels = inventoryLabels;
      },
      onReset: () => {
        workspaceState.labels = [];
      },
      refreshList: coordinator.refreshInventoryLabelList,
      refreshOptions: coordinator.refreshInventoryLabelOptions,
      refreshSnapshots: () =>
        stateContext.refreshInventorySnapshots(workspaceState),
      selectedName: stateContext.selectedInventoryName("labels"),
    });
  }

  async function loadInventoryGroupDetail() {
    await loadInventoryDetail({
      applyForm: coordinator.applyInventoryGroupForm,
      getDetail: getInventoryGroup,
      kind: "groups",
      refreshList: coordinator.refreshInventoryGroupList,
      resetForm: coordinator.resetInventoryGroupForm,
      setStatus: coordinator.setStatus,
      stateContext,
      statusKind: INVENTORY_KIND.groups,
    });
  }

  async function loadInventoryLabelDetail() {
    await loadInventoryDetail({
      applyForm: coordinator.applyInventoryLabelForm,
      getDetail: getInventoryLabel,
      kind: "labels",
      refreshList: coordinator.refreshInventoryLabelList,
      resetForm: coordinator.resetInventoryLabelForm,
      setStatus: coordinator.setStatus,
      stateContext,
      statusKind: INVENTORY_KIND.labels,
    });
  }

  return {
    loadInventoryConnections,
    loadInventoryGroupDetail,
    loadInventoryGroups,
    loadInventoryLabelDetail,
    loadInventoryLabels,
  };
}

function createInventoryReloaders({ dependencies, loaders }) {
  async function reloadLabelsAndSavedConnections() {
    await loaders.loadInventoryLabels();
    await dependencies.loadSavedConnections();
  }

  async function reloadGroupsAndConnections() {
    await loaders.loadInventoryGroups();
    await loaders.loadInventoryConnections();
  }

  return {
    reloadGroupsAndConnections,
    reloadLabelsAndSavedConnections,
  };
}

function createInventoryEntityMutations({
  config,
  dependencies,
  stateContext,
  coordinator,
}) {
  async function saveByName(inventoryName, verb = tr("saved", "saved")) {
    await saveInventoryEntity({
      applyForm: config.applyForm,
      buildPayload: config.buildPayload,
      inventoryName,
      reload: config.reload,
      saveEntity: config.saveEntity,
      setStatus: coordinator.setStatus,
      statusKind: config.kind,
      verb,
    });
  }

  async function createDraft() {
    await createInventoryDraft({
      existsHint: tr(config.existsHintKey, config.existsHintFallback),
      inventoryItems: config.inventoryItems(),
      kind: config.kind,
      loadDetail: config.loadDetail,
      promptForInventoryName: dependencies.promptForResourceName,
      promptMessage: tr(config.promptKey, config.promptFallback),
      saveByName,
      setStatus: coordinator.setStatus,
      stateContext,
      statusKind: config.kind,
    });
  }

  async function saveSelection() {
    const inventoryName = requireInventoryName({
      kind: config.kind,
      message: tr(config.nameRequiredKey, config.nameRequiredFallback),
      setStatus: coordinator.setStatus,
      stateContext,
      statusKind: config.kind,
    });
    if (!inventoryName) return;
    await saveByName(inventoryName);
  }

  async function deleteSelection() {
    const inventoryName = requireInventoryName({
      kind: config.kind,
      message: tr(config.nameRequiredKey, config.nameRequiredFallback),
      setStatus: coordinator.setStatus,
      stateContext,
      statusKind: config.kind,
    });
    if (!inventoryName) return;
    await deleteInventoryEntity({
      deleteEntity: config.deleteEntity,
      inventoryName,
      reload: config.reload,
      resetForm: config.resetForm,
      setStatus: coordinator.setStatus,
      statusKind: config.kind,
    });
  }

  return {
    createDraft,
    deleteSelection,
    saveSelection,
  };
}

function createInventoryMutations({
  dependencies,
  loaders,
  stateContext,
  workspaceState,
  coordinator,
}) {
  const reloads = createInventoryReloaders({ dependencies, loaders });
  const groupMutations = createInventoryEntityMutations({
    config: {
      applyForm: coordinator.applyInventoryGroupForm,
      buildPayload: coordinator.inventoryGroupFormPayload,
      deleteEntity: deleteInventoryGroup,
      existsHintFallback: "group already exists",
      existsHintKey: "inventoryGroupExistsHint",
      inventoryItems: () => workspaceState.groups,
      kind: INVENTORY_KIND.groups,
      loadDetail: loaders.loadInventoryGroupDetail,
      nameRequiredFallback: "group name is required",
      nameRequiredKey: "inventoryGroupNameRequired",
      promptFallback: "New inventory group name",
      promptKey: "inventoryGroupNewPrompt",
      reload: reloads.reloadGroupsAndConnections,
      resetForm: coordinator.resetInventoryGroupForm,
      saveEntity: saveInventoryGroup,
    },
    dependencies,
    stateContext,
    coordinator,
  });
  const labelMutations = createInventoryEntityMutations({
    config: {
      applyForm: coordinator.applyInventoryLabelForm,
      buildPayload: () =>
        sortedInventoryHosts(
          inventorySelectionFor(workspaceState, INVENTORY_KIND.labels),
        ),
      deleteEntity: deleteInventoryLabel,
      existsHintFallback: "label already exists",
      existsHintKey: "inventoryLabelExistsHint",
      inventoryItems: () => workspaceState.labels,
      kind: INVENTORY_KIND.labels,
      loadDetail: loaders.loadInventoryLabelDetail,
      nameRequiredFallback: "label name is required",
      nameRequiredKey: "inventoryLabelNameRequired",
      promptFallback: "New inventory label name",
      promptKey: "inventoryLabelNewPrompt",
      reload: reloads.reloadLabelsAndSavedConnections,
      resetForm: coordinator.resetInventoryLabelForm,
      saveEntity: saveInventoryLabel,
    },
    dependencies,
    stateContext,
    coordinator,
  });

  return {
    createInventoryGroupDraft: groupMutations.createDraft,
    createInventoryLabelDraft: labelMutations.createDraft,
    deleteInventoryGroupSelection: groupMutations.deleteSelection,
    deleteInventoryLabelSelection: labelMutations.deleteSelection,
    saveInventoryGroupSelection: groupMutations.saveSelection,
    saveInventoryLabelSelection: labelMutations.saveSelection,
  };
}

function createInventoryWorkspaceCore({
  dependencies,
  stateContext,
  workspaceState,
  coordinator,
}) {
  const loaders = createInventoryLoaders({
    coordinator,
    stateContext,
    workspaceState,
  });
  const mutations = createInventoryMutations({
    dependencies,
    loaders,
    stateContext,
    workspaceState,
    coordinator,
  });

  return {
    ...loaders,
    ...mutations,
  };
}

export function createInventoryWorkspace(dependencies) {
  let initialized = false;
  const stateContext = createInventoryStateContext();
  const workspaceState = createInventoryWorkspaceState();
  workspaceState.stateContext = stateContext;
  const coordinator = createInventoryWorkspaceCoordinator({
    dependencies,
    stateContext,
    workspaceState,
  });
  const workspaceCore = createInventoryWorkspaceCore({
    dependencies,
    stateContext,
    workspaceState,
    coordinator,
  });
  const hostSelection = createInventoryHostSelection({
    loadInventoryGroupDetail: workspaceCore.loadInventoryGroupDetail,
    loadInventoryLabelDetail: workspaceCore.loadInventoryLabelDetail,
    stateContext,
    workspaceState,
    coordinator,
  });

  async function loadInventoryCollections() {
    await Promise.allSettled([
      workspaceCore.loadInventoryConnections(),
      workspaceCore.loadInventoryGroups(),
      workspaceCore.loadInventoryLabels(),
    ]);
  }

  function refreshInventoryLanguageFields() {
    coordinator.refreshInventoryGroupHosts();
    coordinator.refreshInventoryLabelHosts();
    coordinator.refreshInventoryGroupOptions(
      stateContext.selectedInventoryName("groups") || "",
    );
    coordinator.refreshInventoryGroupList();
    coordinator.refreshInventoryLabelOptions(
      stateContext.selectedInventoryName("labels") || "",
    );
    coordinator.refreshInventoryLabelList();
  }

  function init() {
    if (initialized) return;
    initialized = true;
    coordinator.refreshInventoryGroupHosts();
    coordinator.refreshInventoryLabelHosts();
    coordinator.refreshInventoryGroupList();
    coordinator.refreshInventoryLabelList();
  }

  return {
    ...hostSelection,
    createInventoryGroupDraft: workspaceCore.createInventoryGroupDraft,
    createInventoryLabelDraft: workspaceCore.createInventoryLabelDraft,
    deleteInventoryGroupSelection: workspaceCore.deleteInventoryGroupSelection,
    deleteInventoryLabelSelection: workspaceCore.deleteInventoryLabelSelection,
    init,
    inventoryGroupsState: stateContext.inventoryGroupsState,
    inventoryLabelsState: stateContext.inventoryLabelsState,
    loadInventoryCollections,
    loadInventoryConnections: workspaceCore.loadInventoryConnections,
    loadInventoryGroupDetail: workspaceCore.loadInventoryGroupDetail,
    loadInventoryGroups: workspaceCore.loadInventoryGroups,
    loadInventoryLabelDetail: workspaceCore.loadInventoryLabelDetail,
    loadInventoryLabels: workspaceCore.loadInventoryLabels,
    refreshInventoryConnections: workspaceCore.loadInventoryConnections,
    refreshInventoryGroupHosts: coordinator.refreshInventoryGroupHosts,
    refreshInventoryGroupList: coordinator.refreshInventoryGroupList,
    refreshInventoryGroupOptions: coordinator.refreshInventoryGroupOptions,
    refreshInventoryLabelHosts: coordinator.refreshInventoryLabelHosts,
    refreshInventoryLabelList: coordinator.refreshInventoryLabelList,
    refreshInventoryLabelOptions: coordinator.refreshInventoryLabelOptions,
    refreshInventoryLanguageFields,
    saveInventoryGroupSelection: workspaceCore.saveInventoryGroupSelection,
    saveInventoryLabelSelection: workspaceCore.saveInventoryLabelSelection,
    selectedInventoryGroupName: () =>
      stateContext.selectedInventoryName("groups"),
    selectedInventoryLabelName: () =>
      stateContext.selectedInventoryName("labels"),
    updateInventoryGroupDescription:
      stateContext.updateInventoryGroupDescription,
  };
}

export function createInventoryDependencies() {
  return {
    getSavedConnectionGroupValues: () =>
      getConnectionGroupValues(CONNECTION_PICKER.savedGroups),
    loadSavedConnections,
    promptForResourceName,
    refreshSavedConnectionGroupOptions,
    refreshSavedConnectionLabelOptions,
  };
}
