import { get, writable } from "svelte/store";
import { t } from "../../../lib/i18n.js";
import { configFetchApi } from "../infrastructure/configFetchApi.js";
import {
  configFetchRuntime,
  newConfigFetchRetryState,
} from "../infrastructure/configFetchRuntime.js";
import {
  CONFIG_FETCH_TARGET_MODE,
  configFetchCurrentPayload as buildCurrentPayload,
  configFetchKindAvailable,
  configFetchKindOptions,
  configFetchPayload as buildBatchPayload,
  normalizeConfigFetchTargetMode,
  singleConfigFetchResultPayload,
} from "../model/configFetch.js";
import type {
  ConfigFetchApi,
  ConfigFetchForm,
  ConfigFetchKindCatalog,
  ConfigFetchResultState as ConfigFetchResultStateValue,
  ConfigFetchRuntime,
  ConfigFetchTargetMode,
  ConfigFetchWorkspace,
  ConfigFetchWorkspaceOptions,
  SessionRetryState,
} from "../model/types.js";
import {
  CONFIG_FETCH_CONTENT_VIEW,
  configFetchContent as presentConfigFetchContent,
  configFetchDownloadDescriptor,
} from "../presentation/configFetchPresentation.js";
import type {
  ConfigFetchContentView,
  ConfigFetchResultRow,
} from "../model/types.js";

export const EMPTY_CONFIG_FETCH_RESULT = Object.freeze({
  kind: "empty" as const,
});

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message.trim() || t("requestFailed")
    : String(error ?? "").trim() || t("requestFailed");
}

export function createConfigFetchWorkspace(
  options: ConfigFetchWorkspaceOptions = {},
): ConfigFetchWorkspace {
  const api = Object.assign({}, configFetchApi, options.api) as ConfigFetchApi;
  const runtime = Object.assign(
    {},
    configFetchRuntime,
    options.runtime,
  ) as ConfigFetchRuntime;
  const formState = writable<ConfigFetchForm>({
    includeNormalized: false,
    kind: "running",
    maxParallel: "",
    retry: newConfigFetchRetryState(),
    targetMode: CONFIG_FETCH_TARGET_MODE.current,
  });
  const resultState = writable<ConfigFetchResultStateValue>(
    EMPTY_CONFIG_FETCH_RESULT,
  );
  const kindCatalogState = writable<ConfigFetchKindCatalog>({
    kind: "idle",
    options: [],
    profile: "",
  });
  let catalogRequestSequence = 0;

  function setField<K extends keyof ConfigFetchForm>(
    field: K,
    value: ConfigFetchForm[K],
  ): void {
    formState.update((form) => ({ ...form, [field]: value }));
  }

  function setRetry(retry: Partial<SessionRetryState> = {}): void {
    formState.update((form) => ({
      ...form,
      retry: { ...newConfigFetchRetryState(), ...retry },
    }));
  }

  async function loadKindOptions(profile = ""): Promise<void> {
    const requestSequence = ++catalogRequestSequence;
    const requestedProfile = profile.trim();
    const catalogProfile =
      requestedProfile === "autodetect" ? "" : requestedProfile;
    kindCatalogState.set({
      kind: "loading",
      options: [],
      profile: requestedProfile,
    });
    try {
      const options = configFetchKindOptions(
        await api.listConfigCommands(catalogProfile),
      );
      if (requestSequence !== catalogRequestSequence) return;
      kindCatalogState.set({
        kind: "ready",
        options,
        profile: requestedProfile,
      });
      const selectedKind = get(formState).kind.trim();
      if (!options.some((option) => option.value === selectedKind)) {
        setField(
          "kind",
          options.find((option) => option.value === "running")?.value ||
            options[0]?.value ||
            "",
        );
      }
    } catch (error) {
      if (requestSequence !== catalogRequestSequence) return;
      kindCatalogState.set({
        kind: "error",
        message: errorMessage(error),
        options: [],
        profile: requestedProfile,
      });
    }
  }

  function refreshKindOptions(
    targetMode: ConfigFetchTargetMode = get(formState).targetMode,
  ): Promise<void> {
    return loadKindOptions(
      targetMode === CONFIG_FETCH_TARGET_MODE.current
        ? runtime.currentConnectionProfile()
        : "",
    );
  }

  async function execute(): Promise<void> {
    const form = get(formState);
    const targetMode = normalizeConfigFetchTargetMode(form.targetMode);
    if (!configFetchKindAvailable(get(kindCatalogState), form.kind)) {
      resultState.set({
        kind: "error",
        message: t("configFetchKindRequired"),
      });
      return;
    }
    if (
      targetMode === CONFIG_FETCH_TARGET_MODE.current &&
      !runtime.ensureConnectionTargetSelected()
    ) {
      return;
    }

    let request:
      | {
          mode: "current";
          payload: ReturnType<typeof buildCurrentPayload>;
        }
      | { mode: "batch"; payload: ReturnType<typeof buildBatchPayload> };
    try {
      const retryFields = runtime.retryRequestFields(form.retry);
      request =
        targetMode === CONFIG_FETCH_TARGET_MODE.current
          ? {
              mode: "current",
              payload: buildCurrentPayload(
                form,
                runtime.connectionPayload(),
                runtime.recordLevelPayload(),
                retryFields,
              ),
            }
          : {
              mode: "batch",
              payload: buildBatchPayload(
                form,
                runtime.targetSelections(),
                runtime.recordLevelPayload(),
                retryFields,
              ),
            };
    } catch (error) {
      resultState.set({ kind: "error", message: errorMessage(error) });
      return;
    }
    if (!request.payload.kind) {
      resultState.set({
        kind: "error",
        message: t("configFetchKindRequired"),
      });
      return;
    }
    if (
      request.mode === "batch" &&
      !request.payload.targets.length &&
      !request.payload.groups.length &&
      !request.payload.labels.length
    ) {
      resultState.set({
        kind: "error",
        message: t("batchShowTargetRequired"),
      });
      return;
    }

    resultState.set({ kind: "running" });
    try {
      const resultPayload =
        request.mode === "current"
          ? singleConfigFetchResultPayload(
              await api.fetchConfig(request.payload),
            )
          : await api.fetchConfigBatch(request.payload);
      resultState.set({ kind: "result", resultPayload });
    } catch (error) {
      resultState.set({ kind: "error", message: errorMessage(error) });
    }
  }

  return {
    formState,
    kindCatalogState,
    resultState,
    execute,
    loadKindOptions,
    refreshKindOptions,
    setField,
    setRetry,
  };
}

const configFetchWorkspace = createConfigFetchWorkspace();

export const configFetchFormState = configFetchWorkspace.formState;
export const configFetchKindCatalogState =
  configFetchWorkspace.kindCatalogState;
export const configFetchResultState = configFetchWorkspace.resultState;

export const executeConfigFetch = configFetchWorkspace.execute;
export const loadConfigFetchKindOptions = configFetchWorkspace.loadKindOptions;
export const refreshConfigFetchKindOptions =
  configFetchWorkspace.refreshKindOptions;
export const setConfigFetchField = configFetchWorkspace.setField;
export const setConfigFetchRetry = configFetchWorkspace.setRetry;

export function configFetchContent(
  row: ConfigFetchResultRow,
  view: ConfigFetchContentView = CONFIG_FETCH_CONTENT_VIEW.raw,
): string {
  return presentConfigFetchContent(
    row,
    view,
    configFetchRuntime.executionResultOutputText,
  );
}

export function downloadConfigFetchResult(
  row: ConfigFetchResultRow,
  view: ConfigFetchContentView = CONFIG_FETCH_CONTENT_VIEW.raw,
): boolean {
  const descriptor = configFetchDownloadDescriptor(row, view);
  if (!descriptor) return false;
  configFetchRuntime.download(
    new Blob([descriptor.content], { type: "text/plain;charset=utf-8" }),
    descriptor.filename,
  );
  return true;
}
