import { get, writable } from "svelte/store";
import { templatesApi } from "../infrastructure/templatesApi.js";
import { templatesRuntime } from "../infrastructure/templatesRuntime.js";
import { profileModeNames, trimmedText } from "../model/templateResources.js";
import type {
  CustomShowObjectApiRow,
  ResourceWorkspaceOptions,
  ShowObjectForm,
  ShowObjectState,
  ShowObjectWorkspace,
  TemplateApi,
} from "../model/types.js";
import {
  filteredWorkspaceItemsStore,
  loadProfileTemplateReferences,
  normalizeMapping,
  runWorkspaceAction,
  setWorkspaceSearch,
  workspaceFailure,
} from "./templateWorkspaceSupport.js";

function emptyShowObjectForm(profiles: string[] = []): ShowObjectForm {
  return {
    deviceProfile: profiles[0] || "",
    object: "",
    command: "",
    mode: "",
    textfsmMappingCommand: "",
    textfsmTemplateName: "",
    useMapping: false,
    enabled: true,
  };
}

function showObjectIdentity(
  value: CustomShowObjectApiRow | ShowObjectForm,
): string {
  const deviceProfile =
    "device_profile" in value ? value.device_profile : value.deviceProfile;
  return `${deviceProfile.trim()}\u0000${value.object.trim()}`;
}

function normalizeShowObject(
  value: CustomShowObjectApiRow | ShowObjectForm,
): ShowObjectForm {
  if (!("device_profile" in value)) {
    return {
      ...value,
      deviceProfile: value.deviceProfile.trim(),
      object: value.object.trim(),
      command: value.command.trim(),
      mode: value.mode.trim(),
      textfsmMappingCommand: value.textfsmMappingCommand.trim(),
      textfsmTemplateName: value.textfsmTemplateName.trim(),
    };
  }
  const textfsmMappingCommand = value.textfsm_mapping_command?.trim() ?? "";
  return {
    deviceProfile: value.device_profile.trim(),
    object: value.object.trim(),
    command: value.command.trim(),
    mode: value.mode?.trim() ?? "",
    textfsmMappingCommand,
    textfsmTemplateName: value.textfsm_template_name?.trim() ?? "",
    useMapping: !!textfsmMappingCommand,
    enabled: value.enabled,
  };
}

export function createShowObjectWorkspace({
  api: apiOverrides = {},
  onChanged = templatesRuntime.notifyCustomShowObjectsChanged,
}: ResourceWorkspaceOptions = {}): ShowObjectWorkspace {
  const api: TemplateApi = { ...templatesApi, ...apiOverrides };
  const stateStore = writable<ShowObjectState>({
    profiles: [],
    templates: [],
    mappings: [],
    modes: [],
    objects: [],
    form: emptyShowObjectForm(),
    originalIdentity: "",
    search: "",
    loadingAction: "",
    errorMessage: "",
  });

  async function loadProfileContext(
    profile: string,
    selectedMode = "",
  ): Promise<void> {
    const normalizedProfile = trimmedText(profile);
    if (!normalizedProfile) {
      stateStore.update((state) => ({ ...state, mappings: [], modes: [] }));
      return;
    }
    const [mappingsPayload, modesPayload] = await Promise.all([
      api.listTextfsmMappings(normalizedProfile),
      api.getProfileModes(normalizedProfile),
    ]);
    const mappings = mappingsPayload.map(normalizeMapping);
    const modes = profileModeNames(modesPayload);
    const normalizedMode = trimmedText(selectedMode);
    const mode = templatesRuntime.profileModeMatches(normalizedMode, modes)
      ? normalizedMode
      : modes.includes(trimmedText(modesPayload.default_mode))
        ? trimmedText(modesPayload.default_mode)
        : "";
    stateStore.update((state) => ({
      ...state,
      mappings,
      modes,
      form: { ...state.form, mode: state.form.mode || mode },
    }));
  }

  async function load(): Promise<boolean> {
    return (
      await runWorkspaceAction(stateStore, "load", async () => {
        const [{ profiles, templates }, objectsPayload] = await Promise.all([
          loadProfileTemplateReferences(api),
          api.listCustomShowObjects(),
        ]);
        const objects = objectsPayload.map(normalizeShowObject);
        stateStore.update((state) => ({
          ...state,
          profiles,
          templates,
          objects,
          form: {
            ...state.form,
            deviceProfile: state.form.deviceProfile || profiles[0] || "",
          },
          loadingAction: "",
        }));
        const profile = get(stateStore).form.deviceProfile;
        if (profile)
          await loadProfileContext(profile, get(stateStore).form.mode);
      })
    ).ok;
  }

  function createDraft(): void {
    const state = get(stateStore);
    stateStore.update((value) => ({
      ...value,
      form: emptyShowObjectForm(state.profiles),
      originalIdentity: "",
      errorMessage: "",
    }));
    if (state.profiles[0]) void loadProfileContext(state.profiles[0]);
  }

  async function select(object: ShowObjectForm): Promise<void> {
    const normalized = normalizeShowObject(object);
    stateStore.update((state) => ({
      ...state,
      form: normalized,
      originalIdentity: showObjectIdentity(normalized),
      errorMessage: "",
    }));
    await loadProfileContext(normalized.deviceProfile, normalized.mode);
    stateStore.update((state) => ({ ...state, form: normalized }));
  }

  async function patchForm(patch: Partial<ShowObjectForm>): Promise<void> {
    const previous = get(stateStore).form;
    const next = { ...previous, ...patch };
    if (Object.hasOwn(patch, "deviceProfile")) {
      next.mode = "";
      next.textfsmMappingCommand = "";
      if (next.useMapping) next.command = "";
    }
    if (Object.hasOwn(patch, "useMapping")) {
      next.useMapping = !!patch.useMapping;
      next.textfsmMappingCommand = next.useMapping
        ? next.textfsmMappingCommand
        : "";
      if (next.useMapping) next.command = next.textfsmMappingCommand;
    }
    if (Object.hasOwn(patch, "textfsmMappingCommand")) {
      next.textfsmMappingCommand = trimmedText(
        patch.textfsmMappingCommand ?? "",
      );
      if (next.useMapping) next.command = next.textfsmMappingCommand;
    }
    stateStore.update((state) => ({ ...state, form: next }));
    if (Object.hasOwn(patch, "deviceProfile")) {
      await loadProfileContext(next.deviceProfile);
    }
  }

  function setSearch(search: string): void {
    setWorkspaceSearch(stateStore, search);
  }

  async function save() {
    const state = get(stateStore);
    const form = normalizeShowObject(state.form);
    if (!form.deviceProfile || !form.object || !form.command) {
      return workspaceFailure(
        "showObjectCustomRequired",
        "Profile, object, and command are required",
      );
    }
    if (form.useMapping && !form.textfsmMappingCommand) {
      return workspaceFailure(
        "showObjectMappingRequired",
        "Select a profile command mapping",
      );
    }
    return runWorkspaceAction(stateStore, "save", async () => {
      await api.saveCustomShowObject({
        device_profile: form.deviceProfile,
        object: form.object,
        command: form.command,
        mode: form.mode || null,
        textfsm_mapping_command: form.useMapping
          ? form.textfsmMappingCommand
          : null,
        textfsm_template_name: form.textfsmTemplateName || null,
        enabled: form.enabled,
      });
      const nextIdentity = showObjectIdentity(form);
      if (state.originalIdentity && state.originalIdentity !== nextIdentity) {
        const [oldProfile, oldObject] = state.originalIdentity.split("\u0000");
        await api.deleteCustomShowObject({
          device_profile: oldProfile,
          object: oldObject,
        });
      }
      await onChanged();
      await load();
      const saved = get(stateStore).objects.find(
        (object) => showObjectIdentity(object) === nextIdentity,
      );
      if (saved) await select(saved);
    });
  }

  async function remove() {
    const state = get(stateStore);
    const identity = state.originalIdentity || showObjectIdentity(state.form);
    const [deviceProfile, object] = identity.split("\u0000");
    if (!deviceProfile || !object) {
      return workspaceFailure(
        "showObjectCustomDeleteRequired",
        "Profile and object are required",
      );
    }
    return runWorkspaceAction(stateStore, "delete", async () => {
      await api.deleteCustomShowObject({
        device_profile: deviceProfile,
        object,
      });
      await onChanged();
      await load();
      createDraft();
    });
  }

  const filteredObjectsStore = filteredWorkspaceItemsStore(
    stateStore,
    (state) => state.objects,
    (object) => [object.deviceProfile, object.object, object.command],
  );

  return {
    createDraft,
    filteredObjectsStore,
    load,
    patchForm,
    remove,
    save,
    select,
    setSearch,
    stateStore,
  };
}
