import ace from "ace-builds/src-noconflict/ace";
import "ace-builds/src-noconflict/mode-json";
import "ace-builds/src-noconflict/theme-github";
import "ace-builds/src-noconflict/theme-tomorrow_night";
import { byId } from "./runtimeGlobals.js";

function safeString(value) {
  if (value == null) return "";
  return typeof value === "string" ? value : String(value);
}

function tr(key) {
  return typeof window.t === "function" ? window.t(key) : key;
}

function editorTheme(theme) {
  return theme === "light" ? "ace/theme/github" : "ace/theme/tomorrow_night";
}

function defaultPayload(name) {
  const fn = window[name];
  return typeof fn === "function" ? fn() : {};
}

function createJsonEditorController({ fieldId, hostId }) {
  let aceEditor = null;
  let syncing = false;

  const field = () => byId(fieldId);
  const host = () => byId(hostId);
  const emitInput = () =>
    field()?.dispatchEvent(new Event("input", { bubbles: true }));

  function syncHiddenFromEditor({ notify = false } = {}) {
    const currentField = field();
    if (!currentField || !aceEditor) return;
    const next = aceEditor.getValue();
    const changed = currentField.value !== next;
    currentField.value = next;
    if (notify && changed) emitInput();
  }

  function setText(text, { notify = false } = {}) {
    const next = safeString(text || "");
    const currentField = field();
    if (aceEditor) {
      if (aceEditor.getValue() !== next) {
        syncing = true;
        aceEditor.setValue(next, -1);
        syncing = false;
      }
      syncHiddenFromEditor({ notify });
      return;
    }
    if (!currentField) return;
    const changed = currentField.value !== next;
    currentField.value = next;
    if (notify && changed) emitInput();
  }

  function setup() {
    if (aceEditor || !ace) return;
    const currentHost = host();
    const currentField = field();
    if (!currentHost || !currentField) return;
    try {
      const editor = ace.edit(currentHost, {
        mode: "ace/mode/json",
        theme: editorTheme(window.currentTheme || "dark"),
        showPrintMargin: false,
        tabSize: 2,
        useSoftTabs: true,
        wrap: true,
        fontSize: "13px",
      });
      editor.session.setUseWrapMode(true);
      editor.session.setUseWorker(false);
      editor.session.on("change", () => {
        if (syncing) return;
        syncHiddenFromEditor({ notify: true });
      });
      editor.commands.addCommand({
        name: "formatJson",
        bindKey: { win: "Ctrl-Shift-F", mac: "Command-Shift-F" },
        exec() {
          try {
            const parsed = JSON.parse(editor.getValue());
            setText(JSON.stringify(parsed, null, 2), { notify: true });
          } catch (_) {}
        },
      });
      aceEditor = editor;
      currentHost.classList.remove("hidden");
      currentField.classList.add("hidden");
      currentField.setAttribute("aria-hidden", "true");
      setText(currentField.value || "", { notify: false });
      resize();
    } catch (_) {
      aceEditor = null;
      currentHost.classList.add("hidden");
      currentField.classList.remove("hidden");
      currentField.removeAttribute("aria-hidden");
    }
  }

  function setTheme(theme) {
    aceEditor?.setTheme(editorTheme(theme));
  }

  function resize() {
    aceEditor?.resize(true);
  }

  function raw() {
    if (aceEditor) return safeString(aceEditor.getValue() || "");
    return safeString(field()?.value || "");
  }

  return {
    raw,
    resize,
    setText,
    setTheme,
    setup,
  };
}

export function installTxJsonEditors() {
  const txBlock = createJsonEditorController({
    fieldId: "tx-block-json",
    hostId: "tx-block-json-editor",
  });
  const txWorkflow = createJsonEditorController({
    fieldId: "tx-workflow-json",
    hostId: "tx-workflow-json-editor",
  });
  const orchestration = createJsonEditorController({
    fieldId: "orchestration-json",
    hostId: "orchestration-json-editor",
  });

  window.setupTxBlockJsonEditor = txBlock.setup;
  window.setTxBlockJsonEditorTheme = txBlock.setTheme;
  window.resizeTxBlockJsonEditor = txBlock.resize;
  window.setTxBlockEditorText = txBlock.setText;
  window.setTxBlockEditorRawText = (rawText) =>
    txBlock.setText(rawText, { notify: true });
  window.txBlockEditorRaw = txBlock.raw;
  window.setTxBlockEditorJson = function setTxBlockEditorJson(payload) {
    const next =
      payload && typeof payload === "object"
        ? JSON.stringify(payload, null, 2)
        : JSON.stringify(
            defaultPayload("defaultTxBlockTemplatePayload"),
            null,
            2,
          );
    txBlock.setText(next, { notify: true });
  };
  window.parseTxBlockEditorJson = function parseTxBlockEditorJson() {
    const raw = txBlock.raw().trim();
    if (!raw) throw new Error(tr("txBlockJsonRequired"));
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error(tr("txBlockJsonInvalidShape"));
    }
    window.setTxBlockEditorJson(parsed);
    return parsed;
  };

  window.setupTxWorkflowJsonEditor = txWorkflow.setup;
  window.setTxWorkflowJsonEditorTheme = txWorkflow.setTheme;
  window.resizeTxWorkflowJsonEditor = txWorkflow.resize;
  window.setTxWorkflowEditorText = txWorkflow.setText;
  window.txWorkflowEditorRaw = txWorkflow.raw;
  window.setTxWorkflowEditorJson = function setTxWorkflowEditorJson(payload) {
    const next =
      payload && typeof payload === "object"
        ? JSON.stringify(payload, null, 2)
        : JSON.stringify(
            defaultPayload("defaultTxWorkflowTemplatePayload"),
            null,
            2,
          );
    txWorkflow.setText(next, { notify: true });
  };

  window.setupOrchestrationJsonEditor = orchestration.setup;
  window.setOrchestrationJsonEditorTheme = orchestration.setTheme;
  window.resizeOrchestrationJsonEditor = orchestration.resize;
  window.setOrchestrationEditorText = orchestration.setText;
  window.orchestrationEditorRaw = orchestration.raw;
  window.setOrchestrationEditorJson = function setOrchestrationEditorJson(
    payload,
  ) {
    const next =
      payload && typeof payload === "object"
        ? JSON.stringify(payload, null, 2)
        : JSON.stringify(
            defaultPayload("defaultOrchestrationTemplatePayload"),
            null,
            2,
          );
    orchestration.setText(next, { notify: true });
  };
}
