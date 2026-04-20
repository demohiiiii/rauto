/**
 * tx/editors.js — tx JSON editor helpers
 */

let txBlockJsonAceEditor = null;
let txBlockJsonEditorSyncing = false;
let txWorkflowJsonAceEditor = null;
let txWorkflowJsonEditorSyncing = false;
let orchestrationJsonAceEditor = null;
let orchestrationJsonEditorSyncing = false;

function txBlockJsonEditorTheme(theme) {
  return theme === "light" ? "ace/theme/github" : "ace/theme/tomorrow_night";
}

function txBlockJsonHiddenField() {
  return byId("tx-block-json");
}

function txBlockJsonEditorHost() {
  return byId("tx-block-json-editor");
}

function emitTxBlockJsonInput() {
  const field = txBlockJsonHiddenField();
  if (!field) return;
  field.dispatchEvent(new Event("input", { bubbles: true }));
}

function syncTxBlockJsonHiddenFromEditor({ notify = false } = {}) {
  const field = txBlockJsonHiddenField();
  if (!field || !txBlockJsonAceEditor) return;
  const next = txBlockJsonAceEditor.getValue();
  const changed = field.value !== next;
  field.value = next;
  if (notify && changed) {
    emitTxBlockJsonInput();
  }
}

function setTxBlockEditorText(text, { notify = false } = {}) {
  const next = safeString(text || "");
  const field = txBlockJsonHiddenField();
  if (txBlockJsonAceEditor) {
    if (txBlockJsonAceEditor.getValue() !== next) {
      txBlockJsonEditorSyncing = true;
      txBlockJsonAceEditor.setValue(next, -1);
      txBlockJsonEditorSyncing = false;
    }
    syncTxBlockJsonHiddenFromEditor({ notify });
    return;
  }
  if (!field) return;
  const changed = field.value !== next;
  field.value = next;
  if (notify && changed) {
    emitTxBlockJsonInput();
  }
}

function setupTxBlockJsonEditor() {
  if (txBlockJsonAceEditor || !window.ace) return;
  const host = txBlockJsonEditorHost();
  const field = txBlockJsonHiddenField();
  if (!host || !field) return;
  try {
    const editor = window.ace.edit(host, {
      mode: "ace/mode/json",
      theme: txBlockJsonEditorTheme(window.currentTheme || currentTheme),
      showPrintMargin: false,
      tabSize: 2,
      useSoftTabs: true,
      wrap: true,
      fontSize: "13px",
    });
    editor.session.setUseWrapMode(true);
    editor.session.setUseWorker(false);
    editor.session.on("change", () => {
      if (txBlockJsonEditorSyncing) return;
      syncTxBlockJsonHiddenFromEditor({ notify: true });
    });
    editor.commands.addCommand({
      name: "formatJson",
      bindKey: { win: "Ctrl-Shift-F", mac: "Command-Shift-F" },
      exec() {
        try {
          const parsed = JSON.parse(editor.getValue());
          setTxBlockEditorText(JSON.stringify(parsed, null, 2), { notify: true });
        } catch (_) {}
      },
    });
    txBlockJsonAceEditor = editor;
    host.classList.remove("hidden");
    field.classList.add("hidden");
    field.setAttribute("aria-hidden", "true");
    setTxBlockEditorText(field.value || "", { notify: false });
    resizeTxBlockJsonEditor();
  } catch (_) {
    txBlockJsonAceEditor = null;
    host.classList.add("hidden");
    field.classList.remove("hidden");
    field.removeAttribute("aria-hidden");
  }
}

function setTxBlockJsonEditorTheme(theme) {
  if (!txBlockJsonAceEditor) return;
  txBlockJsonAceEditor.setTheme(txBlockJsonEditorTheme(theme));
}

function resizeTxBlockJsonEditor() {
  if (!txBlockJsonAceEditor) return;
  txBlockJsonAceEditor.resize(true);
}

function setTxBlockEditorRawText(rawText) {
  setTxBlockEditorText(rawText, { notify: true });
}

function txWorkflowJsonHiddenField() {
  return byId("tx-workflow-json");
}

function txWorkflowJsonEditorHost() {
  return byId("tx-workflow-json-editor");
}

function emitTxWorkflowJsonInput() {
  const field = txWorkflowJsonHiddenField();
  if (!field) return;
  field.dispatchEvent(new Event("input", { bubbles: true }));
}

function syncTxWorkflowJsonHiddenFromEditor({ notify = false } = {}) {
  const field = txWorkflowJsonHiddenField();
  if (!field || !txWorkflowJsonAceEditor) return;
  const next = txWorkflowJsonAceEditor.getValue();
  const changed = field.value !== next;
  field.value = next;
  if (notify && changed) {
    emitTxWorkflowJsonInput();
  }
}

function setTxWorkflowEditorText(text, { notify = false } = {}) {
  const next = safeString(text || "");
  const field = txWorkflowJsonHiddenField();
  if (txWorkflowJsonAceEditor) {
    if (txWorkflowJsonAceEditor.getValue() !== next) {
      txWorkflowJsonEditorSyncing = true;
      txWorkflowJsonAceEditor.setValue(next, -1);
      txWorkflowJsonEditorSyncing = false;
    }
    syncTxWorkflowJsonHiddenFromEditor({ notify });
    return;
  }
  if (!field) return;
  const changed = field.value !== next;
  field.value = next;
  if (notify && changed) {
    emitTxWorkflowJsonInput();
  }
}

function setupTxWorkflowJsonEditor() {
  if (txWorkflowJsonAceEditor || !window.ace) return;
  const host = txWorkflowJsonEditorHost();
  const field = txWorkflowJsonHiddenField();
  if (!host || !field) return;
  try {
    const editor = window.ace.edit(host, {
      mode: "ace/mode/json",
      theme: txBlockJsonEditorTheme(window.currentTheme || currentTheme),
      showPrintMargin: false,
      tabSize: 2,
      useSoftTabs: true,
      wrap: true,
      fontSize: "13px",
    });
    editor.session.setUseWrapMode(true);
    editor.session.setUseWorker(false);
    editor.session.on("change", () => {
      if (txWorkflowJsonEditorSyncing) return;
      syncTxWorkflowJsonHiddenFromEditor({ notify: true });
    });
    editor.commands.addCommand({
      name: "formatJson",
      bindKey: { win: "Ctrl-Shift-F", mac: "Command-Shift-F" },
      exec() {
        try {
          const parsed = JSON.parse(editor.getValue());
          setTxWorkflowEditorText(JSON.stringify(parsed, null, 2), { notify: true });
        } catch (_) {}
      },
    });
    txWorkflowJsonAceEditor = editor;
    host.classList.remove("hidden");
    field.classList.add("hidden");
    field.setAttribute("aria-hidden", "true");
    setTxWorkflowEditorText(field.value || "", { notify: false });
    resizeTxWorkflowJsonEditor();
  } catch (_) {
    txWorkflowJsonAceEditor = null;
    host.classList.add("hidden");
    field.classList.remove("hidden");
    field.removeAttribute("aria-hidden");
  }
}

function setTxWorkflowJsonEditorTheme(theme) {
  if (!txWorkflowJsonAceEditor) return;
  txWorkflowJsonAceEditor.setTheme(txBlockJsonEditorTheme(theme));
}

function resizeTxWorkflowJsonEditor() {
  if (!txWorkflowJsonAceEditor) return;
  txWorkflowJsonAceEditor.resize(true);
}

function txWorkflowEditorRaw() {
  if (txWorkflowJsonAceEditor) {
    return safeString(txWorkflowJsonAceEditor.getValue() || "");
  }
  return safeString(txWorkflowJsonHiddenField()?.value || "");
}

function setTxWorkflowEditorJson(payload) {
  const next =
    payload && typeof payload === "object"
      ? JSON.stringify(payload, null, 2)
      : JSON.stringify(defaultTxWorkflowTemplatePayload(), null, 2);
  setTxWorkflowEditorText(next, { notify: true });
}

function orchestrationJsonHiddenField() {
  return byId("orchestration-json");
}

function orchestrationJsonEditorHost() {
  return byId("orchestration-json-editor");
}

function emitOrchestrationJsonInput() {
  const field = orchestrationJsonHiddenField();
  if (!field) return;
  field.dispatchEvent(new Event("input", { bubbles: true }));
}

function syncOrchestrationJsonHiddenFromEditor({ notify = false } = {}) {
  const field = orchestrationJsonHiddenField();
  if (!field || !orchestrationJsonAceEditor) return;
  const next = orchestrationJsonAceEditor.getValue();
  const changed = field.value !== next;
  field.value = next;
  if (notify && changed) {
    emitOrchestrationJsonInput();
  }
}

function setOrchestrationEditorText(text, { notify = false } = {}) {
  const next = safeString(text || "");
  const field = orchestrationJsonHiddenField();
  if (orchestrationJsonAceEditor) {
    if (orchestrationJsonAceEditor.getValue() !== next) {
      orchestrationJsonEditorSyncing = true;
      orchestrationJsonAceEditor.setValue(next, -1);
      orchestrationJsonEditorSyncing = false;
    }
    syncOrchestrationJsonHiddenFromEditor({ notify });
    return;
  }
  if (!field) return;
  const changed = field.value !== next;
  field.value = next;
  if (notify && changed) {
    emitOrchestrationJsonInput();
  }
}

function setupOrchestrationJsonEditor() {
  if (orchestrationJsonAceEditor || !window.ace) return;
  const host = orchestrationJsonEditorHost();
  const field = orchestrationJsonHiddenField();
  if (!host || !field) return;
  try {
    const editor = window.ace.edit(host, {
      mode: "ace/mode/json",
      theme: txBlockJsonEditorTheme(window.currentTheme || currentTheme),
      showPrintMargin: false,
      tabSize: 2,
      useSoftTabs: true,
      wrap: true,
      fontSize: "13px",
    });
    editor.session.setUseWrapMode(true);
    editor.session.setUseWorker(false);
    editor.session.on("change", () => {
      if (orchestrationJsonEditorSyncing) return;
      syncOrchestrationJsonHiddenFromEditor({ notify: true });
    });
    editor.commands.addCommand({
      name: "formatJson",
      bindKey: { win: "Ctrl-Shift-F", mac: "Command-Shift-F" },
      exec() {
        try {
          const parsed = JSON.parse(editor.getValue());
          setOrchestrationEditorText(JSON.stringify(parsed, null, 2), {
            notify: true,
          });
        } catch (_) {}
      },
    });
    orchestrationJsonAceEditor = editor;
    host.classList.remove("hidden");
    field.classList.add("hidden");
    field.setAttribute("aria-hidden", "true");
    setOrchestrationEditorText(field.value || "", { notify: false });
    resizeOrchestrationJsonEditor();
  } catch (_) {
    orchestrationJsonAceEditor = null;
    host.classList.add("hidden");
    field.classList.remove("hidden");
    field.removeAttribute("aria-hidden");
  }
}

function setOrchestrationJsonEditorTheme(theme) {
  if (!orchestrationJsonAceEditor) return;
  orchestrationJsonAceEditor.setTheme(txBlockJsonEditorTheme(theme));
}

function resizeOrchestrationJsonEditor() {
  if (!orchestrationJsonAceEditor) return;
  orchestrationJsonAceEditor.resize(true);
}

function orchestrationEditorRaw() {
  if (orchestrationJsonAceEditor) {
    return safeString(orchestrationJsonAceEditor.getValue() || "");
  }
  return safeString(orchestrationJsonHiddenField()?.value || "");
}

function setOrchestrationEditorJson(payload) {
  const next =
    payload && typeof payload === "object"
      ? JSON.stringify(payload, null, 2)
      : JSON.stringify(defaultOrchestrationTemplatePayload(), null, 2);
  setOrchestrationEditorText(next, { notify: true });
}

function txBlockEditorRaw() {
  if (txBlockJsonAceEditor) {
    return safeString(txBlockJsonAceEditor.getValue() || "");
  }
  return safeString(txBlockJsonHiddenField()?.value || "");
}

function setTxBlockEditorJson(payload) {
  const next =
    payload && typeof payload === "object"
      ? JSON.stringify(payload, null, 2)
      : JSON.stringify(defaultTxBlockTemplatePayload(), null, 2);
  setTxBlockEditorText(next, { notify: true });
}

function parseTxBlockEditorJson() {
  const raw = txBlockEditorRaw().trim();
  if (!raw) {
    throw new Error(t("txBlockJsonRequired"));
  }
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(t("txBlockJsonInvalidShape"));
  }
  setTxBlockEditorJson(parsed);
  return parsed;
}
