export { byId } from "./runtimeGlobals.js";
import { byId } from "./runtimeGlobals.js";

function value(id) {
  return byId(id)?.value.trim() || "";
}

function optionalFunction(name) {
  const fn = window[name];
  return typeof fn === "function" ? fn : null;
}

function splitCsvValues(rawValue) {
  return String(rawValue ?? "")
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function getMultiSelectValues(selectId) {
  const select = byId(selectId);
  if (!select) {
    return [];
  }
  return Array.from(select.selectedOptions || [])
    .map((option) => String(option.value || "").trim())
    .filter(Boolean);
}

function selectedShowObjects(selectId) {
  return getMultiSelectValues(selectId);
}

function parseJsonById(id) {
  const raw = value(id);
  if (!raw) {
    return {};
  }
  return JSON.parse(raw);
}

export function connectionPayload() {
  const rawPort = value("port");
  const parsedPort = rawPort ? Number(rawPort) : 22;
  const labelReader = optionalFunction("getConnectionLabelValues");
  const groupReader = optionalFunction("getConnectionGroupValues");
  const varsReader = optionalFunction("getConnectionVarsValue");

  return {
    connection_name: value("saved-conn-name") || null,
    host: value("host") || null,
    port: Number.isFinite(parsedPort) ? parsedPort : 22,
    username: value("username") || null,
    password: value("password") || null,
    enable_password: value("enable_password") || null,
    ssh_security: value("ssh_security") || null,
    linux_shell_flavor: value("linux_shell_flavor") || null,
    device_profile: value("device_profile") || null,
    enabled: !!byId("saved-conn-enabled")?.checked,
    labels: labelReader
      ? labelReader("saved-conn-labels")
      : splitCsvValues(byId("saved-conn-labels")?.value || ""),
    groups: groupReader
      ? groupReader("saved-conn-groups")
      : getMultiSelectValues("saved-conn-groups"),
    vars: varsReader
      ? varsReader("saved-conn-vars")
      : parseJsonById("saved-conn-vars"),
  };
}

export function recordLevelPayload() {
  const raw =
    value("record-level") ||
    byId("record-level-toggle-btn")?.dataset.level ||
    "";
  return String(raw || "").trim() === "full" ? "full" : "key-events-only";
}

export function selectedTemplateContent() {
  return (
    byId("template-selected-content")?.value.trim() ||
    byId("template")?.value.trim() ||
    ""
  );
}

export function parseVars() {
  const raw = byId("vars")?.value.trim() || "";
  if (!raw) {
    return {};
  }
  return JSON.parse(raw);
}

export function textfsmPayload() {
  return {
    textfsm_template: byId("textfsm-template")?.value.trim() || null,
    parse_textfsm: !!byId("parse-textfsm")?.checked,
    textfsm_platform: byId("textfsm-platform")?.value.trim() || null,
    textfsm_strict_errors: !!byId("textfsm-strict-errors")?.checked,
  };
}

export function directCommandPayload({ connection, recordLevel }) {
  return {
    command: byId("command").value.trim(),
    mode: byId("mode").value.trim() || null,
    ...textfsmPayload(),
    connection,
    record_level: recordLevel,
  };
}

export function showExecutionPayload({ connection, recordLevel }) {
  const objects = selectedShowObjects("show-object");
  return {
    object: objects[0] || "",
    objects,
    mode: byId("show-mode").value.trim() || null,
    textfsm_platform: byId("textfsm-platform")?.value.trim() || null,
    no_parse: !byId("parse-textfsm")?.checked,
    textfsm_strict_errors: !!byId("textfsm-strict-errors")?.checked,
    connection,
    record_level: recordLevel,
  };
}

export function batchShowExecutionPayload({ recordLevel }) {
  const pickerValues = optionalFunction("connectionPickerValues");
  const objects = selectedShowObjects("batch-show-object");
  return {
    object: objects[0] || "",
    objects,
    mode: byId("batch-show-mode")?.value.trim() || null,
    textfsm_platform: byId("batch-textfsm-platform")?.value.trim() || null,
    no_parse: !byId("batch-parse-textfsm")?.checked,
    textfsm_strict_errors: !!byId("batch-textfsm-strict-errors")?.checked,
    targets: pickerValues
      ? pickerValues("batch-show-targets")
      : splitCsvValues(byId("batch-show-targets")?.value || ""),
    groups: pickerValues
      ? pickerValues("batch-show-groups")
      : getMultiSelectValues("batch-show-groups"),
    labels: pickerValues
      ? pickerValues("batch-show-labels")
      : splitCsvValues(byId("batch-show-labels")?.value || ""),
    record_level: recordLevel,
  };
}

export function templateExecutionPayload({ connection, recordLevel }) {
  return {
    template: selectedTemplateContent(),
    vars: parseVars(),
    mode: byId("template-mode").value.trim() || null,
    ...textfsmPayload(),
    connection,
    record_level: recordLevel,
  };
}

export function commandFlowPayload({
  builtinTemplateName,
  connection,
  recordLevel,
  templateSelection,
  vars,
}) {
  return {
    template_name: builtinTemplateName ? null : templateSelection,
    builtin_template_name: builtinTemplateName,
    vars,
    ...textfsmPayload(),
    connection,
    record_level: recordLevel,
  };
}
