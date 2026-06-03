import {
  byId,
  callRuntimeFunction,
  runtimeValue,
  setRuntimeValue,
} from "../services/runtimeGlobals.js";

const INLINE_STATUS_TARGETS = new Set([
  "connection-test-out",
  "tx-plan-out",
  "tx-exec-out",
  "tx-workflow-plan-out",
  "tx-workflow-exec-out",
  "orchestration-plan-out",
  "orchestration-exec-out",
  "flow-out",
  "upload-out",
  "profile-diagnose-out",
]);

let toastSequence = 0;

function safeString(value) {
  if (typeof window.safeString === "function") return window.safeString(value);
  if (value == null) return "-";
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

function escapeHtml(value) {
  if (typeof window.escapeHtml === "function") return window.escapeHtml(value);
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function t(key) {
  if (typeof window.t === "function") return window.t(key);
  return key;
}

function isPassiveLoadedStatus(message, tone) {
  if (tone !== "info" && tone !== "success") return false;
  const text = safeString(message || "").trim();
  const loadedPrefix = safeString(t("loaded")).trim();
  if (!text || !loadedPrefix) return false;
  return text === loadedPrefix || text.startsWith(`${loadedPrefix}:`);
}

function shouldToastStatus(message, tone) {
  const text = safeString(message || "").trim();
  if (!text || text === "-") return false;
  if (isPassiveLoadedStatus(text, tone)) return false;
  return tone === "success" || tone === "error" || tone === "warning";
}

function shouldRenderInlineStatus(id, message, tone) {
  const text = safeString(message || "").trim();
  if (!text || text === "-") return false;
  if (isPassiveLoadedStatus(text, tone)) return false;
  if (tone === "running") return true;
  return INLINE_STATUS_TARGETS.has(id);
}

function showToast(message, tone = "info") {
  const stack = byId("toast-stack");
  if (!stack) return;
  const toastId = `toast-${++toastSequence}`;
  const item = document.createElement("div");
  item.dataset.toastId = toastId;
  item.innerHTML = callRuntimeFunction(
    "renderStatusToast",
    () => "",
    message,
    tone,
  );
  const toastEl = item.firstElementChild;
  if (!toastEl) return;
  const isError = tone === "error";
  const duration = isError ? 7000 : tone === "warning" ? 5000 : 3600;
  const limit = 5;
  const closeBtn = toastEl.querySelector(".js-toast-close");
  const dismiss = () => {
    if (!toastEl.isConnected) return;
    toastEl.classList.add("is-leaving");
    window.setTimeout(() => {
      if (toastEl.isConnected) {
        toastEl.remove();
      }
    }, 180);
  };
  if (closeBtn) {
    closeBtn.onclick = dismiss;
  }
  if (stack.children.length >= limit) {
    const oldest = stack.firstElementChild;
    if (oldest) oldest.remove();
  }
  stack.appendChild(toastEl);
  window.requestAnimationFrame(() => {
    toastEl.classList.add("is-visible");
  });
  window.setTimeout(dismiss, duration);
}

function setStatusMessage(id, message, tone = "info") {
  const el = byId(id);
  if (!el) return;
  if (isPassiveLoadedStatus(message, tone)) {
    el.innerHTML = "";
    return;
  }
  if (shouldRenderInlineStatus(id, message, tone)) {
    el.innerHTML = callRuntimeFunction(
      "renderStatusMessageCard",
      () => "",
      message,
      tone,
    );
  } else {
    el.innerHTML = "";
  }
  if (shouldToastStatus(message, tone)) {
    showToast(message, tone);
  }
}

function flowVarTypeLabel(kind) {
  switch (safeString(kind).trim()) {
    case "secret":
      return t("flowVarTypeSecret");
    case "number":
      return t("flowVarTypeNumber");
    case "boolean":
      return t("flowVarTypeBoolean");
    case "json":
      return t("flowVarTypeJson");
    case "string":
    default:
      return t("flowVarTypeString");
  }
}

function normalizeFlowTemplateVarSchema(item) {
  if (!item || !safeString(item.name).trim()) return null;
  const kind = safeString(item.type || item.kind || "string")
    .trim()
    .toLowerCase();
  return {
    name: safeString(item.name).trim(),
    label:
      safeString(item.label || item.name).trim() ||
      safeString(item.name).trim(),
    description: safeString(item.description).trim() || "",
    kind: kind || "string",
    required: !!item.required,
    placeholder: safeString(item.placeholder).trim(),
    options: Array.isArray(item.options)
      ? item.options.map((value) => safeString(value)).filter(Boolean)
      : [],
    defaultValue:
      item.default !== undefined ? item.default : item.default_value,
  };
}

function getFlowRunVarsSchema(
  detail = runtimeValue("lastFlowRunTemplateDetail"),
) {
  if (!detail || !Array.isArray(detail.vars_schema)) return [];
  return detail.vars_schema.map(normalizeFlowTemplateVarSchema).filter(Boolean);
}

function defaultFlowVarDraft(field) {
  if (
    !field ||
    field.defaultValue === undefined ||
    field.defaultValue === null
  ) {
    return "";
  }
  if (field.kind === "boolean") {
    if (field.defaultValue === true) return "true";
    if (field.defaultValue === false) return "false";
    return "";
  }
  if (field.kind === "json") {
    try {
      return JSON.stringify(field.defaultValue, null, 2);
    } catch (_) {
      return "";
    }
  }
  return safeString(field.defaultValue);
}

function getCurrentFlowTemplateFieldDraft() {
  const container = byId("flow-vars-fields");
  if (!container) return {};
  const draft = {};
  container.querySelectorAll("[data-flow-var-name]").forEach((el) => {
    const name = safeString(el.getAttribute("data-flow-var-name")).trim();
    if (!name) return;
    draft[name] = el.value;
  });
  return draft;
}

async function ensureFlowRunTemplateDetail(templateName, options = {}) {
  const name = safeString(templateName).trim();
  if (!name) {
    callRuntimeFunction(
      "renderFlowTemplateVarFields",
      () => undefined,
      null,
      {},
    );
    return null;
  }
  const lastFlowRunTemplateDetail = runtimeValue("lastFlowRunTemplateDetail");
  if (
    lastFlowRunTemplateDetail &&
    safeString(lastFlowRunTemplateDetail.__selection_key || "").trim() === name
  ) {
    return lastFlowRunTemplateDetail;
  }
  try {
    const builtinName = callRuntimeFunction(
      "parseBuiltinFlowTemplateValue",
      () => null,
      name,
    );
    const endpoint = builtinName
      ? `/api/flow-templates/builtins/${encodeURIComponent(builtinName)}`
      : `/api/flow-templates/${encodeURIComponent(name)}`;
    const data = await callRuntimeFunction(
      "request",
      () => Promise.reject(new Error(t("requestFailed"))),
      "GET",
      endpoint,
    );
    if (data && typeof data === "object") {
      data.__selection_key = name;
    }
    setRuntimeValue("lastFlowRunTemplateDetail", data);
    callRuntimeFunction(
      "renderFlowTemplateVarFields",
      () => undefined,
      data,
      {},
    );
    return data;
  } catch (e) {
    if (!options.silent) {
      callRuntimeFunction(
        "renderFlowTemplateVarFieldsError",
        () => undefined,
        e.message,
      );
    } else {
      callRuntimeFunction(
        "renderFlowTemplateVarFields",
        () => undefined,
        null,
        {},
      );
    }
    throw e;
  }
}

function flowVarRequiredMessage(label) {
  return runtimeValue("currentLang") === "zh"
    ? `${label}${t("flowVarRequiredSuffix")}`
    : `${label} ${t("flowVarRequiredSuffix")}`;
}

function collectFlowTemplateFieldValues() {
  const values = {};
  for (const field of getFlowRunVarsSchema()) {
    const el = byId(`flow-var-${field.name}`);
    if (!el) continue;
    const raw = safeString(el.value);
    const isBlank = raw.trim() === "";
    const hasDefault =
      field.defaultValue !== undefined && field.defaultValue !== null;

    if (field.kind === "json") {
      if (isBlank) {
        if (field.required && !hasDefault) {
          throw new Error(flowVarRequiredMessage(field.label));
        }
        continue;
      }
      try {
        values[field.name] = JSON.parse(raw);
      } catch (_) {
        throw new Error(`${field.label} ${t("flowVarJsonInvalid")}`);
      }
      continue;
    }

    if (field.kind === "boolean") {
      if (isBlank) {
        if (field.required && !hasDefault) {
          throw new Error(flowVarRequiredMessage(field.label));
        }
        continue;
      }
      values[field.name] = raw === "true";
      continue;
    }

    if (isBlank) {
      if (field.required && !hasDefault) {
        throw new Error(flowVarRequiredMessage(field.label));
      }
      continue;
    }

    if (field.kind === "number") {
      const parsed = Number(raw);
      if (Number.isNaN(parsed)) {
        throw new Error(`${field.label} ${t("flowVarNumberInvalid")}`);
      }
      values[field.name] = parsed;
      continue;
    }

    values[field.name] = raw;
  }
  return values;
}

function parseFlowVarsJsonOverrides() {
  const rawVars = (byId("flow-vars-json").value || "").trim();
  if (!rawVars) {
    return {};
  }
  const parsed = JSON.parse(rawVars);
  if (parsed == null) {
    return {};
  }
  if (Array.isArray(parsed) || typeof parsed !== "object") {
    throw new Error(t("flowVarsObjectRequired"));
  }
  return parsed;
}

function buildFlowVarsPayload() {
  const overrideVars = parseFlowVarsJsonOverrides();
  const fieldVars = collectFlowTemplateFieldValues();
  const merged = { ...overrideVars, ...fieldVars };
  return Object.keys(merged).length ? merged : null;
}

function renderTemplateExecVisual() {
  const visualOut = byId("template-exec-visual");
  if (!visualOut) return;
  const lastTemplateExecResult = runtimeValue("lastTemplateExecResult");
  if (!lastTemplateExecResult) {
    visualOut.innerHTML = `<div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">${escapeHtml(
      t("templateExecVisualEmpty"),
    )}</div>`;
    return;
  }
  visualOut.innerHTML = callRuntimeFunction(
    "renderTemplateExecuteResult",
    () => "",
    lastTemplateExecResult,
  );
}

function renderTxBlockVisual() {
  const visualOut = byId("tx-block-visual");
  if (!visualOut) return;
  const lastTxBlockPreview = runtimeValue("lastTxBlockPreview") || {};
  visualOut.innerHTML = callRuntimeFunction(
    "renderTxBlockPreview",
    () => "",
    lastTxBlockPreview.txBlock,
    lastTxBlockPreview.txResult,
  );
}

function setTxBlockVisual(txBlock, txResult) {
  setRuntimeValue("lastTxBlockPreview", {
    txBlock: txBlock || null,
    txResult: txResult || null,
  });
  renderTxBlockVisual();
}

function setTxWorkflowPreview(workflow) {
  const visualOut = byId("tx-workflow-plan-visual");
  if (!visualOut) return;
  visualOut.innerHTML = callRuntimeFunction(
    "renderTxWorkflowPreview",
    () => "",
    workflow || {},
  );
}

function renderTxWorkflowPreviewFromEditor() {
  const visualOut = byId("tx-workflow-plan-visual");
  if (!visualOut) return;
  const raw =
    typeof window.txWorkflowEditorRaw === "function"
      ? window.txWorkflowEditorRaw().trim()
      : byId("tx-workflow-json").value.trim();
  if (!raw) {
    visualOut.innerHTML = `<div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">${escapeHtml(
      t("txWorkflowVisualEmpty"),
    )}</div>`;
    return;
  }
  try {
    const workflow = JSON.parse(raw);
    setTxWorkflowPreview(workflow);
  } catch (e) {
    visualOut.innerHTML = `<div class="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">${escapeHtml(
      `${t("txWorkflowVisualInvalid")}: ${e.message || t("requestFailed")}`,
    )}</div>`;
  }
}

function rememberOrchestrationDetail(detail) {
  const nextSeq = Number(runtimeValue("orchestrationDetailSeq") || 0) + 1;
  setRuntimeValue("orchestrationDetailSeq", nextSeq);
  const id = `orch-${nextSeq}`;
  runtimeValue("orchestrationDetailMap")?.set?.(id, detail);
  return id;
}

function setOrchestrationPreview(plan, inventory, result = null) {
  setRuntimeValue("lastOrchestrationPreview", {
    plan: plan || null,
    inventory: inventory || null,
    result: result || null,
  });
  renderOrchestrationPreview();
}

function renderOrchestrationPreview() {
  const visualOut = byId("orchestration-visual");
  if (!visualOut) return;
  const lastOrchestrationPreview =
    runtimeValue("lastOrchestrationPreview") || {};
  visualOut.innerHTML = callRuntimeFunction(
    "renderOrchestrationPreviewHtml",
    () => "",
    lastOrchestrationPreview.plan,
    lastOrchestrationPreview.inventory,
  );
}

function renderOrchestrationPreviewFromEditor() {
  const visualOut = byId("orchestration-visual");
  if (!visualOut) return;
  const raw =
    typeof window.orchestrationEditorRaw === "function"
      ? window.orchestrationEditorRaw().trim()
      : byId("orchestration-json").value.trim();
  if (!raw) {
    visualOut.innerHTML = `<div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">${escapeHtml(
      t("orchestrationVisualEmpty"),
    )}</div>`;
    return;
  }
  try {
    const plan = JSON.parse(raw);
    setOrchestrationPreview(plan, plan.inventory || null, null);
  } catch (e) {
    visualOut.innerHTML = `<div class="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">${escapeHtml(
      `${t("orchestrationVisualInvalid")}: ${e.message || t("requestFailed")}`,
    )}</div>`;
  }
}

function openOrchestrationDetail(detail) {
  if (!detail || typeof detail !== "object") return;
  const isStage = detail.kind === "stage";
  callRuntimeFunction(
    "openDetailModal",
    () => undefined,
    isStage
      ? callRuntimeFunction("renderOrchestrationStageDetail", () => "", detail)
      : callRuntimeFunction(
          "renderOrchestrationTargetDetail",
          () => "",
          detail,
        ),
    {
      title: isStage
        ? t("orchestrationStageDetailTitle")
        : t("orchestrationTargetDetailTitle"),
      html: true,
    },
  );
}

function renderOrchestrationResultPanel() {
  const out = byId("orchestration-exec-out");
  const lastOrchestrationPreview =
    runtimeValue("lastOrchestrationPreview") || {};
  if (!out || !lastOrchestrationPreview.result) return;
  out.innerHTML = callRuntimeFunction(
    "renderOrchestrationResult",
    () => "",
    lastOrchestrationPreview.result,
  );
}

function renderRecordingView() {
  const listOut = byId("record-list-out");
  const rawOut = byId("record-jsonl");
  const listBtn = byId("record-view-list");
  const rawBtn = byId("record-view-raw");
  const recordViewMode = runtimeValue("recordViewMode");
  const isList = recordViewMode === "list";
  listBtn.classList.toggle("tab-active", isList);
  rawBtn.classList.toggle("tab-active", !isList);
  callRuntimeFunction(
    "setPanelVisible",
    () => undefined,
    listOut,
    isList,
    "grid",
  );
  callRuntimeFunction(
    "setPanelVisible",
    () => undefined,
    rawOut,
    !isList,
    "block",
  );

  const parsed = callRuntimeFunction(
    "parseJsonl",
    () => ({ ok: true, rows: [] }),
    rawOut.value || "",
  );
  if (!parsed.ok) {
    listOut.innerHTML = `<div class="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">${escapeHtml(
      parsed.error,
    )}</div>`;
    callRuntimeFunction("updateRecordFabBadge", () => undefined, 0);
    return;
  }
  const recordEventKind = runtimeValue("recordEventKind");
  const recordFailedOnly = runtimeValue("recordFailedOnly");
  const recordSearchQuery = runtimeValue("recordSearchQuery");
  const entries = callRuntimeFunction(
    "filterEntries",
    () => [],
    parsed.rows,
    recordEventKind,
    recordFailedOnly,
    recordSearchQuery,
  );
  callRuntimeFunction("updateRecordFabBadge", () => undefined, entries.length);
  if (!isList) {
    return;
  }
  if (!entries.length) {
    listOut.innerHTML = `<div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">${escapeHtml(
      recordFailedOnly
        ? t("noFailedEntries")
        : recordEventKind !== "all"
          ? t("noMatchedEntries")
          : t("recordListEmpty"),
    )}</div>`;
    return;
  }
  const stats = callRuntimeFunction("buildEventStats", () => ({}), entries);
  listOut.innerHTML = `${callRuntimeFunction("renderStatsCards", () => "", stats)}${callRuntimeFunction(
    "renderEntriesTable",
    () => "",
    entries,
  )}`;
}

function applyRecordingFromResponse(data) {
  const jsonl =
    data && data.recording_jsonl ? String(data.recording_jsonl) : "";
  if (jsonl) {
    byId("record-jsonl").value = jsonl;
    renderRecordingView();
  }
}

export function installUiSharedRuntime() {
  Object.assign(window, {
    isPassiveLoadedStatus,
    shouldToastStatus,
    shouldRenderInlineStatus,
    showToast,
    setStatusMessage,
    flowVarTypeLabel,
    normalizeFlowTemplateVarSchema,
    getFlowRunVarsSchema,
    defaultFlowVarDraft,
    getCurrentFlowTemplateFieldDraft,
    ensureFlowRunTemplateDetail,
    flowVarRequiredMessage,
    collectFlowTemplateFieldValues,
    parseFlowVarsJsonOverrides,
    buildFlowVarsPayload,
    renderTemplateExecVisual,
    renderTxBlockVisual,
    setTxBlockVisual,
    setTxWorkflowPreview,
    renderTxWorkflowPreviewFromEditor,
    rememberOrchestrationDetail,
    setOrchestrationPreview,
    renderOrchestrationPreview,
    renderOrchestrationPreviewFromEditor,
    openOrchestrationDetail,
    renderOrchestrationResultPanel,
    renderRecordingView,
    applyRecordingFromResponse,
  });
}
