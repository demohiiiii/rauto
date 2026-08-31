import { get, writable } from "svelte/store";
import { safeString } from "../../../lib/ui.js";
import { commandApi } from "../infrastructure/commandApi.js";
import type {
  CommandTemplateCatalog,
  CommandTemplateCatalogOptions,
  CommandTemplateCatalogState,
} from "../model/types.js";

export const MANUAL_COMMAND_SOURCE = "__manual__";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error ?? "");
}

export function normalizeCommandTemplateNames(payload: unknown = []): string[] {
  return (Array.isArray(payload) ? payload : [])
    .map((item) => {
      const name =
        item && typeof item === "object"
          ? (item as Record<string, unknown>).name
          : undefined;
      return safeString(name).trim();
    })
    .filter(Boolean);
}

export function createCommandTemplateCatalog({
  load = commandApi.listTemplates,
}: CommandTemplateCatalogOptions = {}): CommandTemplateCatalog {
  const state = writable<CommandTemplateCatalogState>({
    errorMessage: "",
    loaded: false,
    loading: false,
    names: [],
  });
  let pendingRequest: Promise<boolean> | null = null;

  async function ensureLoaded(): Promise<boolean> {
    if (get(state).loaded) return true;
    if (pendingRequest) return pendingRequest;
    state.update((current) => ({
      ...current,
      errorMessage: "",
      loading: true,
    }));
    pendingRequest = (async () => {
      try {
        const payload = await load();
        state.set({
          errorMessage: "",
          loaded: true,
          loading: false,
          names: normalizeCommandTemplateNames(payload),
        });
        return true;
      } catch (error) {
        state.update((current) => ({
          ...current,
          errorMessage: errorMessage(error),
          loading: false,
        }));
        return false;
      } finally {
        pendingRequest = null;
      }
    })();
    return pendingRequest;
  }

  return { ensureLoaded, state };
}

export const commandTemplateCatalog = createCommandTemplateCatalog();
