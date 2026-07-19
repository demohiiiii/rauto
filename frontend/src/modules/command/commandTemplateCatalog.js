import { get, writable } from "svelte/store";
import { listTemplates } from "../../api/client.js";
import { safeString } from "../../lib/ui.js";

export const MANUAL_COMMAND_SOURCE = "__manual__";

export function normalizeCommandTemplateNames(payload = []) {
  return (Array.isArray(payload) ? payload : [])
    .map((item) => safeString(item?.name).trim())
    .filter(Boolean);
}

export function createCommandTemplateCatalog({ load = listTemplates } = {}) {
  const state = writable({
    errorMessage: "",
    loaded: false,
    loading: false,
    names: [],
  });
  let pendingRequest = null;

  async function ensureLoaded() {
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
          errorMessage: error?.message || String(error),
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
