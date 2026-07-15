import { get, writable } from "svelte/store";
import {
  executeTemplate,
  getTemplate,
  inspectCommandTemplate,
  listTemplates,
  renderTemplate,
} from "../api/client.js";
import {
  browserClearTimeout,
  browserConfirm,
  browserSetTimeout,
} from "../lib/browser.js";
import { t } from "../lib/i18n.js";
import { safeString } from "../lib/ui.js";
import {
  connectionPayload,
  ensureConnectionTargetSelected,
} from "./connections.js";
import { applyRecordDrawerRecording, recordLevelPayload } from "./overlays.js";
import {
  MODE_SELECT,
  TEXTFSM_PLATFORM_SELECT,
  modeSelection,
  textfsmPlatformSelection,
} from "./profiles.js";
import {
  MANUAL_COMMAND_SOURCE,
  normalizeCommandTemplateNames,
} from "./commandTemplateCatalog.js";

export { MANUAL_COMMAND_SOURCE } from "./commandTemplateCatalog.js";

export function reconcileCommandVars(schema = [], current = {}) {
  return Object.fromEntries(
    (Array.isArray(schema) ? schema : [])
      .map((field) => safeString(field?.name).trim())
      .filter(Boolean)
      .map((name) => [
        name,
        Object.hasOwn(current || {}, name) ? current[name] : "",
      ]),
  );
}

export function commandExecutionPayload({
  content = "",
  vars = {},
  mode = "",
  multilineMode = "split_lines",
  textfsm = {},
  connection,
  recordLevel,
} = {}) {
  return {
    template_content: safeString(content),
    vars: vars && typeof vars === "object" && !Array.isArray(vars) ? vars : {},
    mode: safeString(mode).trim() || null,
    multiline_mode: multilineMode === "whole" ? "whole" : "split_lines",
    ...textfsm,
    connection,
    record_level: recordLevel,
  };
}

function initialCommandWorkspaceState() {
  return {
    sourceSelection: MANUAL_COMMAND_SOURCE,
    sourceOptions: [],
    content: "",
    baselineContent: "",
    dirty: false,
    vars: {},
    varsSchema: [],
    mode: "",
    modeOptions: [],
    multilineMode: "split_lines",
    textfsm: {
      enabled: false,
      platform: "",
      platformOptions: [],
      strictErrors: false,
      template: "",
    },
    preview: { kind: "empty", text: "", message: "" },
    executionResult: { kind: "empty" },
    loadingActions: [],
    status: { message: "", tone: "info" },
  };
}

function textfsmPayload(textfsm = {}) {
  return {
    textfsm_template: safeString(textfsm.template).trim() || null,
    parse_textfsm: !!textfsm.enabled,
    textfsm_platform: safeString(textfsm.platform).trim() || null,
    textfsm_strict_errors: !!textfsm.strictErrors,
  };
}

export function createStandardCommandExecutionWorkspace({
  api = {
    executeTemplate,
    getTemplate,
    inspectCommandTemplate,
    listTemplates,
    renderTemplate,
  },
  confirmReplace = browserConfirm,
  inspectionDelay = 180,
  runtime = {
    applyRecording: applyRecordDrawerRecording,
    connection: connectionPayload,
    ensureTarget: ensureConnectionTargetSelected,
    recordLevel: recordLevelPayload,
  },
} = {}) {
  const stateStore = writable(initialCommandWorkspaceState());
  const commandModePicker = modeSelection(MODE_SELECT.standardDirect);
  const platformPicker = textfsmPlatformSelection(
    TEXTFSM_PLATFORM_SELECT.standard,
  );
  let loadVersion = 0;
  let inspectionVersion = 0;
  let inspectionTimer = 0;
  let destroyed = false;

  const unsubscribeMode = commandModePicker.state.subscribe((modeState) => {
    stateStore.update((state) => ({
      ...state,
      mode: safeString(modeState?.selected),
      modeOptions: Array.isArray(modeState?.modes) ? modeState.modes : [],
    }));
  });
  const unsubscribePlatform = platformPicker.state.subscribe(
    (platformState) => {
      stateStore.update((state) => ({
        ...state,
        textfsm: {
          ...state.textfsm,
          platform: safeString(platformState?.selected),
          platformOptions: Array.isArray(platformState?.profiles)
            ? platformState.profiles
            : [],
        },
      }));
    },
  );

  function setStatus(message = "", tone = "info") {
    stateStore.update((state) => ({
      ...state,
      status: { message: safeString(message), tone },
    }));
  }

  function setLoading(action, loading) {
    stateStore.update((state) => {
      const keys = new Set(state.loadingActions);
      if (loading) keys.add(action);
      else keys.delete(action);
      return { ...state, loadingActions: [...keys] };
    });
  }

  async function inspectContent(content, version = ++inspectionVersion) {
    try {
      const detail = await api.inspectCommandTemplate(content);
      if (destroyed || version !== inspectionVersion) return false;
      const varsSchema = Array.isArray(detail?.vars_schema)
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
        setStatus(error?.message || String(error), "error");
      }
      return false;
    }
  }

  function scheduleInspection(content) {
    browserClearTimeout(inspectionTimer);
    const version = ++inspectionVersion;
    return new Promise((resolve) => {
      inspectionTimer = browserSetTimeout(() => {
        inspectionTimer = 0;
        void inspectContent(content, version).then(resolve);
      }, inspectionDelay);
    });
  }

  async function initialize() {
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
          error?.message ||
            t("commandTemplateListFailed", "Template list failed"),
          "error",
        );
      }
      return false;
    } finally {
      if (!destroyed) setLoading("templates", false);
    }
  }

  async function allowReplacement() {
    if (!get(stateStore).dirty) return true;
    return !!(await confirmReplace(t("commandReplaceConfirm")));
  }

  async function selectSource(sourceValue = MANUAL_COMMAND_SOURCE) {
    const source = safeString(sourceValue).trim() || MANUAL_COMMAND_SOURCE;
    const current = get(stateStore);
    if (source === current.sourceSelection) return true;
    if (!(await allowReplacement())) return false;
    const version = ++loadVersion;
    browserClearTimeout(inspectionTimer);
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
      const content = safeString(detail?.content);
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
          error?.message ||
            t("commandTemplateLoadFailed", "Template load failed"),
          "error",
        );
      }
      return false;
    } finally {
      if (!destroyed && version === loadVersion) setLoading("template", false);
    }
  }

  function changeContent(content = "") {
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

  function changeVars(vars = {}) {
    stateStore.update((state) => ({
      ...state,
      vars:
        vars && typeof vars === "object" && !Array.isArray(vars)
          ? { ...vars }
          : {},
    }));
  }

  function changeMode(mode = "") {
    commandModePicker.setValue(mode);
  }

  function changeMultilineMode(multilineMode = "split_lines") {
    stateStore.update((state) => ({
      ...state,
      multilineMode: multilineMode === "whole" ? "whole" : "split_lines",
    }));
  }

  function changeTextfsm(patch = {}) {
    if (Object.hasOwn(patch, "platform")) {
      platformPicker.setValue(patch.platform);
    }
    stateStore.update((state) => ({
      ...state,
      textfsm: { ...state.textfsm, ...patch },
    }));
  }

  function currentExecutionPayload() {
    const state = get(stateStore);
    return commandExecutionPayload({
      content: state.content,
      vars: state.vars,
      mode: state.mode,
      multilineMode: state.multilineMode,
      textfsm: textfsmPayload(state.textfsm),
      connection: runtime.connection(),
      recordLevel: runtime.recordLevel(),
    });
  }

  function commandReady() {
    if (get(stateStore).content.trim()) return true;
    setStatus(t("commandRequired"), "error");
    return false;
  }

  async function preview() {
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
          text: safeString(response?.rendered_commands),
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
            message: error?.message || String(error),
          },
        }));
      }
      return false;
    } finally {
      if (!destroyed) setLoading("preview", false);
    }
  }

  async function execute() {
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
            message: error?.message || String(error),
          },
        }));
      }
      return false;
    } finally {
      if (!destroyed) setLoading("execute", false);
    }
  }

  function destroy() {
    destroyed = true;
    loadVersion += 1;
    inspectionVersion += 1;
    browserClearTimeout(inspectionTimer);
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
    preview,
    execute,
    destroy,
  };
}
