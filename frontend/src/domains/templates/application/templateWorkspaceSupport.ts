import { derived, type Readable, type Writable } from "svelte/store";
import { tr } from "../../../lib/i18n.js";
import { templatesRuntime } from "../infrastructure/templatesRuntime.js";
import {
  listValue,
  profileNamesFromOverview,
  recordValue,
  trimmedText,
  uniqueNames,
} from "../model/templateResources.js";
import type {
  TemplateApi,
  TextfsmMapping,
  UnknownRecord,
  WorkspaceResult,
} from "../model/types.js";

export async function loadProfileTemplateReferences(api: TemplateApi) {
  const [profilesPayload, templatesPayload] = await Promise.all([
    api.getDeviceProfilesOverview(),
    api.listTemplateResource("/api/textfsm/templates"),
  ]);
  const profiles = profileNamesFromOverview(profilesPayload);
  const templates = uniqueNames(
    listValue(templatesPayload).map((item) => recordValue(item).name),
  );
  templatesRuntime.setCachedDeviceProfiles(profiles);
  return { profiles, templates };
}

export function workspaceErrorMessage(error: unknown): string {
  return error && typeof error === "object" && "message" in error
    ? String(error.message ?? "")
    : String(error);
}

export function workspaceFailure(
  messageKey: string,
  fallback: string,
): WorkspaceResult {
  return { ok: false, message: tr(messageKey, fallback) };
}

export function setWorkspaceSearch<T extends { search: string }>(
  stateStore: Writable<T>,
  search: unknown,
): void {
  stateStore.update((state) => ({
    ...state,
    search: search == null ? "" : String(search),
  }));
}

export function filteredWorkspaceItemsStore<
  TItem extends UnknownRecord,
  TState extends { search: string },
>(
  stateStore: Readable<TState>,
  readItems: (state: TState) => TItem[],
  fields: string[],
): Readable<TItem[]> {
  return derived(stateStore, (state) => {
    const query = trimmedText(state.search).toLowerCase();
    const items = readItems(state);
    if (!query) return items;
    return items.filter((item) =>
      fields
        .map((field) => item[field])
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  });
}

export async function runWorkspaceAction<
  T extends { errorMessage: string; loadingAction: string },
>(
  stateStore: Writable<T>,
  action: string,
  operation: () => Promise<void>,
): Promise<WorkspaceResult> {
  stateStore.update((state) => ({
    ...state,
    loadingAction: action,
    errorMessage: "",
  }));
  try {
    await operation();
    return { ok: true };
  } catch (error) {
    const message = workspaceErrorMessage(error);
    stateStore.update((state) => ({
      ...state,
      loadingAction: "",
      errorMessage: message,
    }));
    return { ok: false, message };
  }
}

export function emptyMappingForm(
  profiles: string[] = [],
  templates: string[] = [],
): TextfsmMapping {
  return {
    deviceProfile: profiles[0] || "",
    command: "",
    templateName: templates[0] || "",
  };
}

export function mappingIdentity(mapping: unknown = {}): string {
  const fields = recordValue(mapping);
  return `${trimmedText(fields.device_profile ?? fields.deviceProfile)}\u0000${trimmedText(fields.command)}`;
}

export function normalizeMapping(mapping: unknown = {}): TextfsmMapping {
  const fields = recordValue(mapping);
  return {
    ...fields,
    deviceProfile: trimmedText(fields.device_profile ?? fields.deviceProfile),
    command: trimmedText(fields.command),
    templateName: trimmedText(fields.template_name ?? fields.templateName),
  };
}
