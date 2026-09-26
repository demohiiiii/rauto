import type { BatchDeliveryWorkspace } from "./createBatchDeliveryWorkspace.js";
import { MODE_SELECT, modeSelection } from "$domains/profiles/index.js";
import { get, writable } from "svelte/store";
import {
  MANUAL_COMMAND_SOURCE,
  normalizeCommandTemplateNames,
} from "$domains/command/index.js";
import {
  executionHistory,
  downloadCommandOutput,
  exportParsedOutputSheetsExcel,
  parsedOutputSheetsFromParsedOutputItems,
} from "$domains/execution/index.js";
import type { SessionRetryState } from "$domains/execution/index.js";
import type { JsonObject } from "$lib/jsonValue.js";
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
} from "../model/types.js";

function errorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    return String(error.message ?? "");
  }
  return String(error ?? "");
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
  batch,
  api: apiOverrides = {},
  confirmReplace,
  inspectionDelay = 180,
  runtime: runtimeOverrides = {},
}: StandardCommandWorkspaceOptions & {
  batch?: BatchDeliveryWorkspace;
} = {}): StandardCommandExecutionWorkspace {
  const api: StandardCommandApi = {
    ...standardCommandApi,
    ...(batch ? { renderTemplate: batch.renderTemplate } : {}),
    ...apiOverrides,
  };
  const runtime: StandardCommandRuntime = {
    ...standardCommandRuntime,
    ...(batch
      ? {
          commandModePicker: () => modeSelection(MODE_SELECT.batchExec),
          connection: () => ({}),
          subscribeConnectionChange: batch.subscribeTargets,
        }
      : {}),
    ...runtimeOverrides,
  };
  const confirm = confirmReplace ?? runtime.confirm;
  const stateStore = writable(
    newStandardCommandWorkspaceState(runtime.createRetryState()),
  );
  const commandModePicker = runtime.commandModePicker();
  let loadVersion = 0;
  let inspectionVersion = 0;
  let inspectionTimer = 0;
  let previewVersion = 0;
  let previewTimer = 0;
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
  function setStatus(
    message = "",
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

  function invalidatePreview(): void {
    previewVersion += 1;
    runtime.clearTimer(previewTimer);
    previewTimer = 0;
    stateStore.update((state) => ({
      ...state,
      preview: { kind: "empty", text: "", message: "" },
      loadingActions: state.loadingActions.filter(
        (action) => action !== "preview",
      ),
    }));
  }

  function refreshTemplatePreview(): void {
    if (destroyed) return;
    invalidatePreview();
    const state = get(stateStore);
    if (
      state.sourceSelection === MANUAL_COMMAND_SOURCE ||
      state.loadingActions.includes("template")
    )
      return;
    stateStore.update((state) => ({
      ...state,
      preview: { kind: "running", text: "", message: "" },
    }));
    previewTimer = runtime.setTimer(() => {
      previewTimer = 0;
      void preview();
    }, inspectionDelay);
  }

  async function inspectContent(
    content: string,
    version = ++inspectionVersion,
  ): Promise<boolean> {
    try {
      const detail = await api.inspectCommandTemplate(content);
      if (destroyed || version !== inspectionVersion) return false;
      const varsSchema = detail.vars_schema;
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
    sourceValue = MANUAL_COMMAND_SOURCE,
  ): Promise<boolean> {
    const source = sourceValue.trim() || MANUAL_COMMAND_SOURCE;
    const current = get(stateStore);
    if (
      source === current.sourceSelection &&
      !current.loadingActions.includes("template")
    )
      return true;
    if (!(await allowReplacement())) return false;
    const version = ++loadVersion;
    runtime.clearTimer(inspectionTimer);
    inspectionVersion += 1;
    invalidatePreview();
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
      const content = detail.content;
      stateStore.update((state) => ({
        ...state,
        sourceSelection: source,
        content,
        baselineContent: content,
        varsSchema: [],
        dirty: false,
        preview: { kind: "empty", text: "", message: "" },
        status: { message: "", tone: "info" },
      }));
      const inspected = await inspectContent(content);
      if (destroyed || version !== loadVersion) return false;
      setLoading("template", false);
      if (inspected) await preview();
      if (destroyed || version !== loadVersion) return false;
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

  function changeContent(content = ""): Promise<boolean> {
    if (destroyed || get(stateStore).sourceSelection !== MANUAL_COMMAND_SOURCE)
      return Promise.resolve(false);
    loadVersion += 1;
    invalidatePreview();
    setLoading("template", false);
    const nextContent = content;
    stateStore.update((state) => ({
      ...state,
      content: nextContent,
      dirty: nextContent !== state.baselineContent,
      status: { message: "", tone: "info" },
    }));
    return scheduleInspection(nextContent);
  }

  function changeVars(vars: JsonObject = {}): void {
    if (destroyed) return;
    stateStore.update((state) => ({
      ...state,
      vars: { ...vars },
    }));
    refreshTemplatePreview();
  }

  function changeMode(mode = ""): void {
    commandModePicker.setValue(mode);
  }

  function changeMultilineMode(
    multilineMode: "split_lines" | "whole" = "split_lines",
  ): void {
    stateStore.update((state) => ({
      ...state,
      multilineMode: multilineMode === "whole" ? "whole" : "split_lines",
    }));
  }

  function changeTextfsm(
    patch: Partial<StandardCommandTextfsmState> = {},
  ): void {
    stateStore.update((state) => ({
      ...state,
      textfsm: { ...state.textfsm, ...patch },
    }));
  }

  function changeRetry(retry: Partial<SessionRetryState> = {}): void {
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
    if (destroyed) return false;
    invalidatePreview();
    if (!commandReady()) return false;
    const version = previewVersion;
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
      if (destroyed || version !== previewVersion) return false;
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
      if (!destroyed && version === previewVersion) {
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
      if (!destroyed && version === previewVersion)
        setLoading("preview", false);
    }
  }

  async function execute(): Promise<boolean> {
    if (!commandReady() || get(stateStore).loadingActions.includes("execute"))
      return false;
    if (batch) {
      setLoading("execute", true);
      try {
        return await batch.executeCommand(
          currentExecutionPayload(),
          get(stateStore).textfsm,
        );
      } finally {
        if (!destroyed) setLoading("execute", false);
      }
    }
    if (!runtime.ensureTarget()) return false;
    const autoDownloadExcel = get(stateStore).textfsm.autoDownloadExcel;
    const autoDownloadOutput = get(stateStore).textfsm.autoDownloadOutput;
    const historyId = executionHistory.start(
      "command",
      "single",
      get(stateStore).textfsm.enabled,
    );
    setLoading("execute", true);
    stateStore.update((state) => ({
      ...state,
      executionResult: { kind: "running" },
    }));
    try {
      const payload = currentExecutionPayload();
      const deviceName =
        payload.connection?.connection_name || payload.connection?.host || "";
      const response = await api.executeTemplate(payload);
      executionHistory.finish(
        historyId,
        response.executed.map((item) => ({ ...item, device: deviceName })),
        "",
        response.result_summary?.success === false,
      );
      if (destroyed) return false;
      stateStore.update((state) => ({
        ...state,
        executionResult: {
          kind: "result",
          resultPayload: response,
          deviceName,
        },
      }));
      if (autoDownloadOutput) {
        await downloadCommandOutput(
          response.executed.map((result) => ({
            ...result,
            device: deviceName,
          })),
        );
      }
      if (autoDownloadExcel && payload.parse_textfsm) {
        await exportParsedOutputSheetsExcel(
          parsedOutputSheetsFromParsedOutputItems(response.executed),
          {
            filename: "textfsm-command.xlsx",
          },
        );
      }
      return true;
    } catch (error) {
      executionHistory.fail(historyId, errorMessage(error));
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

  async function downloadOutput(): Promise<void> {
    const result = get(stateStore).executionResult;
    if (result.kind !== "result") return;
    await downloadCommandOutput(
      result.resultPayload.executed.map((item) => ({
        ...item,
        device: result.deviceName,
      })),
    );
  }

  function destroy(): void {
    destroyed = true;
    batch?.destroy();
    loadVersion += 1;
    inspectionVersion += 1;
    previewVersion += 1;
    runtime.clearTimer(inspectionTimer);
    runtime.clearTimer(previewTimer);
    unsubscribeMode();
    unsubscribeConnection();
  }

  const unsubscribeConnection = runtime.subscribeConnectionChange(
    refreshTemplatePreview,
  );

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
    downloadOutput,
    destroy,
  };
}
