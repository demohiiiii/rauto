import { safeCall } from "./runtimeGlobals.js";
import { escapeHtml as escapeHtmlValue, safeString } from "./htmlFormat.js";

export { safeCall };

export function runtimeFunction(name) {
  const value = window[name];
  if (typeof value !== "function") {
    throw new Error(`Dashboard runtime helper is not ready: ${name}`);
  }
  return value;
}

export function t(key) {
  return typeof window.t === "function" ? window.t(key) : key;
}

export function renderStatusMessage(message, tone = "info") {
  return runtimeFunction("renderStatusMessageCard")(message, tone);
}

export function withButtonLoading(id, handler) {
  return runtimeFunction("withButtonLoading")(id, handler);
}

export function ensureConnectionTargetSelected(statusId, renderTargetId) {
  return runtimeFunction("ensureConnectionTargetSelected")(
    statusId,
    renderTargetId,
  );
}

export function applyRecordingFromResponse(data) {
  return safeCall("applyRecordingFromResponse", data);
}

export function renderTemplateExecuteResult(data) {
  return runtimeFunction("renderTemplateExecuteResult")(data);
}

export function renderCommandFlowResult(data) {
  return runtimeFunction("renderCommandFlowResult")(data);
}

export function renderParsedOutputBlock(data) {
  return runtimeFunction("renderParsedOutputBlock")(data);
}

export function ensureFlowRunTemplateDetail(name, options) {
  return runtimeFunction("ensureFlowRunTemplateDetail")(name, options);
}

export function renderFlowTemplateVarFields(detail, draft) {
  return runtimeFunction("renderFlowTemplateVarFields")(detail, draft);
}

export function buildFlowVarsPayload() {
  return runtimeFunction("buildFlowVarsPayload")();
}

export function parseBuiltinFlowTemplateValue(value) {
  return runtimeFunction("parseBuiltinFlowTemplateValue")(value);
}

export function escapeHtml(value) {
  return escapeHtmlValue(value, "-");
}

export { safeString };
