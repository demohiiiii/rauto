import { get, writable } from "svelte/store";
import {
  MANUAL_COMMAND_SOURCE,
  normalizeCommandTemplateNames,
} from "$domains/command/index.js";
import { t } from "../../../lib/i18n.js";
import { safeString } from "../../../lib/ui.js";
import { standardCommandApi } from "../infrastructure/standardCommandApi.js";
import { standardCommandRuntime } from "../infrastructure/standardCommandRuntime.js";
import {
  buildStandardCommandExecutionPayload,
  newStandardCommandWorkspaceState,
  reconcileCommandVars,
  standardCommandTextfsmPayload,
} from "../model/standardCommand.js";
import type {
  StandardCommandApi,
  StandardCommandExecutionInput,
  StandardCommandExecutionPayload,
  StandardCommandExecutionWorkspace,
  StandardCommandRuntime,
  StandardCommandStatusTone,
  StandardCommandTextfsmState,
  StandardCommandWorkspaceOptions,
  StandardSessionRetryState,
} from "../model/types.js";

function errorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    return String(error.message ?? "");
  }
  return String(error ?? "");
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function commandExecutionPayload(
  input: StandardCommandExecutionInput = {},
): StandardCommandExecutionPayload {
  const retry = input.retry ?? standardCommandRuntime.createRetryState();
  return buildStandardCommandExecutionPayload(
    input,
    standardCommandRuntime.retryRequestFields(retry),
  );
}

export function createStandardCommandExecutionWorkspace({
  api: apiOverrides = {},
  confirmReplace,
  inspectionDelay = 180,
  runtime: runtimeOverrides = {},
}: StandardCommandWorkspaceOptions = {}): StandardCommandExecutionWorkspace {
  const api: StandardCommandApi = { ...standardCommandApi, ...apiOverrides };
  const runtime: StandardCommandRuntime = {
    ...standardCommandRuntime,
    ...runtimeOverrides,
  };
  const confirm = confirmReplace ?? runtime.confirm;
  const stateStore = writable(
    newStandardCommandWorkspaceState(runtime.createRetryState()),
  );
  const commandModePicker = runtime.commandModePicker();
  const platformPicker = runtime.platformPicker();
  let loadVersion = 0;
  let inspectionVersion = 0;
  let inspectionTimer = 0;
  let destroyed = false;

  const unsubscribeMode = commandModePicker.state.subscribe((modeState) => {
    stateStore.update((state) => ({
      ...state,
      mode: safeString(modeState.selected),
      modeOptions: Array.isArray(modeState.modes)
        ? modeState.modes.map(safeString).filter(Boolean)
        : [],
    }));
  });
  const unsubscribePlatform = platformPicker.state.subscribe(
    (platformState) => {
      stateStore.update((state) => ({
        ...state,
        textfsm: {
          ...state.textfsm,
          platform: safeString(platformState.selected),
          platformOptions: Array.isArray(platformState.profiles)
            ? platformState.profiles.map(safeString).filter(Boolean)
            : [],
        },
      }));
    },
  );

  function setStatus(
    message: unknown = "",
    tone: StandardCommandStatusTone = "info",
  ): void {
    stateStore.update((state) => ({
      ...state,
      status: { message: safeString(message), tone },
    }));
  }

  function setLoading(action: string, loading: boolean): void {
    stateStore.update((state) => {
      const keys = new Set(state.loadingActions);
      if (loading) keys.add(action);
      else keys.delete(action);
      return { ...state, loadingActions: [...keys] };
    });
  }

  async function inspectContent(
    content: string,
    version = ++inspectionVersion,
  ): Promise<boolean> {
    try {
      const detail = await api.inspectCommandTemplate(content);
      if (destroyed || version !== inspectionVersion) return false;
      const varsSchema = Array.isArray(detail.vars_schema)
        ? detail.vars_schema
        : [];
      stateStore.update((state) => ({
        ...state,
        varsSchema,
        vars: reconcileCommandVars(varsSchema, state.vars),
      }));
      return true;
    } catch (error) {
      if (!destroyed && version === inspectionVersion) {
        setStatus(errorMessage(error), "error");
      }
      return false;
    }
  }

  function scheduleInspection(content: string): Promise<boolean> {
    runtime.clearTimer(inspectionTimer);
    const version = ++inspectionVersion;
    return new Promise((resolve) => {
      inspectionTimer = runtime.setTimer(() => {
        inspectionTimer = 0;
        void inspectContent(content, version).then(resolve);
      }, inspectionDelay);
    });
  }

  async function initialize(): Promise<boolean> {
    setLoading("templates", true);
    try {
      const templatePayload = await api.listTemplates();
      if (destroyed) return false;
      stateStore.update((state) => ({
        ...state,
        sourceOptions: normalizeCommandTemplateNames(templatePayload),
      }));
      return true;
    } catch (error) {
      if (!destroyed) {
        setStatus(
          errorMessage(error) || t("commandTemplateListFailed"),
          "error",
        );
      }
      return false;
    } finally {
      if (!destroyed) setLoading("templates", false);
    }
  }

  async function allowReplacement(): Promise<boolean> {
    if (!get(stateStore).dirty) return true;
    return !!(await confirm(t("commandReplaceConfirm")));
  }

  async function selectSource(
    sourceValue: unknown = MANUAL_COMMAND_SOURCE,
  ): Promise<boolean> {
    const source = safeString(sourceValue).trim() || MANUAL_COMMAND_SOURCE;
    const current = get(stateStore);
    if (source === current.sourceSelection) return true;
    if (!(await allowReplacement())) return false;
    const version = ++loadVersion;
    runtime.clearTimer(inspectionTimer);
    inspectionVersion += 1;
    if (source === MANUAL_COMMAND_SOURCE) {
      setLoading("template", false);
      stateStore.update((state) => ({
        ...state,
        sourceSelection: MANUAL_COMMAND_SOURCE,
        content: "",
        baselineContent: "",
        dirty: false,
        vars: {},
        varsSchema: [],
        preview: { kind: "empty", text: "", message: "" },
        status: { message: "", tone: "info" },
      }));
      return true;
    }

    setLoading("template", true);
    try {
      const detail = await api.getTemplate(source);
      if (destroyed || version !== loadVersion) return false;
      const content = safeString(detail.content);
      stateStore.update((state) => ({
        ...state,
        sourceSelection: source,
        content,
        baselineContent: content,
        dirty: false,
        preview: { kind: "empty", text: "", message: "" },
        status: { message: "", tone: "info" },
      }));
      await inspectContent(content);
      return true;
    } catch (error) {
      if (!destroyed && version === loadVersion) {
        setStatus(
          errorMessage(error) || t("commandTemplateLoadFailed"),
          "error",
        );
      }
      return false;
    } finally {
      if (!destroyed && version === loadVersion) setLoading("template", false);
    }
  }

  function changeContent(content: unknown = ""): Promise<boolean> {
    loadVersion += 1;
    setLoading("template", false);
    const nextContent = safeString(content);
    stateStore.update((state) => ({
      ...state,
      content: nextContent,
      dirty: nextContent !== state.baselineContent,
      status: { message: "", tone: "info" },
    }));
    return scheduleInspection(nextContent);
  }

  function changeVars(vars: unknown = {}): void {
    stateStore.update((state) => ({
      ...state,
      vars: { ...record(vars) },
    }));
  }

  function changeMode(mode: unknown = ""): void {
    commandModePicker.setValue(mode);
  }

  function changeMultilineMode(multilineMode: unknown = "split_lines"): void {
    stateStore.update((state) => ({
      ...state,
      multilineMode: multilineMode === "whole" ? "whole" : "split_lines",
    }));
  }

  function changeTextfsm(
    patch: Partial<StandardCommandTextfsmState> = {},
  ): void {
    if (Object.hasOwn(patch, "platform")) {
      platformPicker.setValue(patch.platform);
    }
    stateStore.update((state) => ({
      ...state,
      textfsm: { ...state.textfsm, ...patch },
    }));
  }

  function changeRetry(retry: StandardSessionRetryState = {}): void {
    stateStore.update((state) => ({
      ...state,
      retry: { ...state.retry, ...retry },
    }));
  }

  function currentExecutionPayload(): StandardCommandExecutionPayload {
    const state = get(stateStore);
    return buildStandardCommandExecutionPayload(
      {
        content: state.content,
        vars: state.vars,
        mode: state.mode,
        multilineMode: state.multilineMode,
        textfsm: standardCommandTextfsmPayload(state.textfsm),
        connection: runtime.connection(),
        recordLevel: runtime.recordLevel(),
      },
      runtime.retryRequestFields(state.retry),
    );
  }

  function commandReady(): boolean {
    if (get(stateStore).content.trim()) return true;
    setStatus(t("commandRequired"), "error");
    return false;
  }

  async function preview(): Promise<boolean> {
    if (!commandReady()) return false;
    setLoading("preview", true);
    stateStore.update((state) => ({
      ...state,
      preview: { kind: "running", text: "", message: "" },
    }));
    try {
      const payload = currentExecutionPayload();
      const response = await api.renderTemplate({
        template_content: payload.template_content,
        vars: payload.vars,
        connection: payload.connection,
      });
      if (destroyed) return false;
      stateStore.update((state) => ({
        ...state,
        preview: {
          kind: "result",
          text: safeString(response.rendered_commands),
          message: "",
        },
      }));
      return true;
    } catch (error) {
      if (!destroyed) {
        stateStore.update((state) => ({
          ...state,
          preview: {
            kind: "error",
            text: "",
            message: errorMessage(error),
          },
        }));
      }
      return false;
    } finally {
      if (!destroyed) setLoading("preview", false);
    }
  }

  async function execute(): Promise<boolean> {
    if (!commandReady() || !runtime.ensureTarget()) return false;
    setLoading("execute", true);
    stateStore.update((state) => ({
      ...state,
      executionResult: { kind: "running" },
    }));
    try {
      const response = await api.executeTemplate(currentExecutionPayload());
      if (destroyed) return false;
      stateStore.update((state) => ({
        ...state,
        executionResult: { kind: "result", resultPayload: response },
      }));
      runtime.applyRecording(response);
      return true;
    } catch (error) {
      if (!destroyed) {
        stateStore.update((state) => ({
          ...state,
          executionResult: {
            kind: "error",
            message: errorMessage(error),
          },
        }));
      }
      return false;
    } finally {
      if (!destroyed) setLoading("execute", false);
    }
  }

  function destroy(): void {
    destroyed = true;
    loadVersion += 1;
    inspectionVersion += 1;
    runtime.clearTimer(inspectionTimer);
    unsubscribeMode();
    unsubscribePlatform();
  }

  return {
    stateStore,
    initialize,
    selectSource,
    changeContent,
    changeVars,
    changeMode,
    changeMultilineMode,
    changeTextfsm,
    changeRetry,
    preview,
    execute,
    destroy,
  };
}
