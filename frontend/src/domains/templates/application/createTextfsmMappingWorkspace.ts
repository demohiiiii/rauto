import { get, writable } from "svelte/store";
import { templatesApi } from "../infrastructure/templatesApi.js";
import { listValue } from "../model/templateResources.js";
import type {
  ResourceWorkspaceOptions,
  TemplateApi,
  TextfsmMapping,
  TextfsmMappingState,
  TextfsmMappingWorkspace,
} from "../model/types.js";
import {
  emptyMappingForm,
  filteredWorkspaceItemsStore,
  loadProfileTemplateReferences,
  mappingIdentity,
  normalizeMapping,
  runWorkspaceAction,
  setWorkspaceSearch,
  workspaceFailure,
} from "./templateWorkspaceSupport.js";

export function createTextfsmMappingWorkspace({
  api: apiOverrides = {},
}: ResourceWorkspaceOptions = {}): TextfsmMappingWorkspace {
  const api: TemplateApi = { ...templatesApi, ...apiOverrides };
  const stateStore = writable<TextfsmMappingState>({
    profiles: [],
    templates: [],
    mappings: [],
    form: emptyMappingForm(),
    originalIdentity: "",
    search: "",
    loadingAction: "",
    errorMessage: "",
  });

  async function loadReferences(): Promise<void> {
    const { profiles, templates } = await loadProfileTemplateReferences(api);
    stateStore.update((state) => ({
      ...state,
      profiles,
      templates,
      form: {
        ...state.form,
        deviceProfile: state.form.deviceProfile || profiles[0] || "",
        templateName: state.form.templateName || templates[0] || "",
      },
    }));
  }

  async function load(): Promise<boolean> {
    return (
      await runWorkspaceAction(stateStore, "load", async () => {
        await loadReferences();
        const mappings = listValue(await api.listTextfsmMappings()).map(
          normalizeMapping,
        );
        stateStore.update((state) => ({
          ...state,
          mappings,
          loadingAction: "",
        }));
      })
    ).ok;
  }

  function createDraft(): void {
    stateStore.update((state) => ({
      ...state,
      form: emptyMappingForm(state.profiles, state.templates),
      originalIdentity: "",
      errorMessage: "",
    }));
  }

  function select(mapping: unknown): void {
    const normalized = normalizeMapping(mapping);
    stateStore.update((state) => ({
      ...state,
      form: normalized,
      originalIdentity: mappingIdentity(normalized),
      errorMessage: "",
    }));
  }

  function patchForm(patch: Partial<TextfsmMapping>): void {
    stateStore.update((state) => ({
      ...state,
      form: { ...state.form, ...patch },
    }));
  }

  function setSearch(search: unknown): void {
    setWorkspaceSearch(stateStore, search);
  }

  async function save() {
    const state = get(stateStore);
    const form = normalizeMapping(state.form);
    if (!form.deviceProfile || !form.command || !form.templateName) {
      return workspaceFailure(
        "textfsmMappingRequired",
        "Profile, command, and template are required",
      );
    }
    return runWorkspaceAction(stateStore, "save", async () => {
      await api.saveTextfsmMapping({
        device_profile: form.deviceProfile,
        command: form.command,
        template_name: form.templateName,
      });
      const nextIdentity = mappingIdentity(form);
      if (state.originalIdentity && state.originalIdentity !== nextIdentity) {
        const [oldProfile, oldCommand] = state.originalIdentity.split("\u0000");
        await api.deleteTextfsmMapping({
          device_profile: oldProfile,
          command: oldCommand,
        });
      }
      await load();
      const saved = get(stateStore).mappings.find(
        (mapping) => mappingIdentity(mapping) === nextIdentity,
      );
      if (saved) select(saved);
    });
  }

  async function remove() {
    const state = get(stateStore);
    const identity = state.originalIdentity || mappingIdentity(state.form);
    const [deviceProfile, command] = identity.split("\u0000");
    if (!deviceProfile || !command) {
      return workspaceFailure(
        "textfsmMappingDeleteRequired",
        "Profile and command are required",
      );
    }
    return runWorkspaceAction(stateStore, "delete", async () => {
      await api.deleteTextfsmMapping({
        device_profile: deviceProfile,
        command,
      });
      await load();
      createDraft();
    });
  }

  const filteredMappingsStore = filteredWorkspaceItemsStore(
    stateStore,
    (state) => state.mappings,
    ["deviceProfile", "command", "templateName"],
  );

  return {
    createDraft,
    filteredMappingsStore,
    load,
    patchForm,
    remove,
    save,
    select,
    setSearch,
    stateStore,
  };
}
