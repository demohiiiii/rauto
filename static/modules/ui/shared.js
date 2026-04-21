/**
 * ui_shared.js - shared status, flow-vars, and preview helpers
 */

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
  item.innerHTML = renderStatusToast(message, tone);
  const toastEl = item.firstElementChild;
  if (!toastEl) return;
  const closeBtn = toastEl.querySelector(".js-toast-close");
  const dismiss = () => {
    toastEl.remove();
  };
  if (closeBtn) {
    closeBtn.onclick = dismiss;
  }
  stack.appendChild(toastEl);
  window.setTimeout(dismiss, tone === "error" ? 6500 : 3200);
}

function setStatusMessage(id, message, tone = "info") {
  const el = byId(id);
  if (!el) return;
  if (isPassiveLoadedStatus(message, tone)) {
    el.innerHTML = "";
    return;
  }
  if (shouldRenderInlineStatus(id, message, tone)) {
    el.innerHTML = renderStatusMessageCard(message, tone);
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
    label: safeString(item.label || item.name).trim() || safeString(item.name).trim(),
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

function getFlowRunVarsSchema(detail = lastFlowRunTemplateDetail) {
  if (!detail || !Array.isArray(detail.vars_schema)) return [];
  return detail.vars_schema
    .map(normalizeFlowTemplateVarSchema)
    .filter(Boolean);
}

function defaultFlowVarDraft(field) {
  if (!field || field.defaultValue === undefined || field.defaultValue === null) {
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
    renderFlowTemplateVarFields(null, {});
    return null;
  }
  if (
    lastFlowRunTemplateDetail &&
    safeString(lastFlowRunTemplateDetail.__selection_key || "").trim() === name
  ) {
    return lastFlowRunTemplateDetail;
  }
  try {
    const builtinName = parseBuiltinFlowTemplateValue(name);
    const endpoint = builtinName
      ? `/api/flow-templates/builtins/${encodeURIComponent(builtinName)}`
      : `/api/flow-templates/${encodeURIComponent(name)}`;
    const data = await request("GET", endpoint);
    if (data && typeof data === "object") {
      data.__selection_key = name;
    }
    lastFlowRunTemplateDetail = data;
    renderFlowTemplateVarFields(data, {});
    return data;
  } catch (e) {
    if (!options.silent) {
      renderFlowTemplateVarFieldsError(e.message);
    } else {
      renderFlowTemplateVarFields(null, {});
    }
    throw e;
  }
}

function flowVarRequiredMessage(label) {
  return currentLang === "zh"
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
  if (!lastTemplateExecResult) {
    visualOut.innerHTML = `<div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">${escapeHtml(
      t("templateExecVisualEmpty")
    )}</div>`;
    return;
  }
  visualOut.innerHTML = renderTemplateExecuteResult(lastTemplateExecResult);
}

function renderTxBlockVisual() {
  const visualOut = byId("tx-block-visual");
  if (!visualOut) return;
  visualOut.innerHTML = renderTxBlockPreview(
    lastTxBlockPreview.txBlock,
    lastTxBlockPreview.txResult
  );
}

function setTxBlockVisual(txBlock, txResult) {
  lastTxBlockPreview = {
    txBlock: txBlock || null,
    txResult: txResult || null,
  };
  renderTxBlockVisual();
}

function setTxWorkflowPreview(workflow) {
  const visualOut = byId("tx-workflow-plan-visual");
  if (!visualOut) return;
  visualOut.innerHTML = renderTxWorkflowPreview(workflow || {});
}

function renderTxWorkflowPreviewFromEditor() {
  const visualOut = byId("tx-workflow-plan-visual");
  if (!visualOut) return;
  const raw =
    typeof txWorkflowEditorRaw === "function"
      ? txWorkflowEditorRaw().trim()
      : byId("tx-workflow-json").value.trim();
  if (!raw) {
    visualOut.innerHTML = `<div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">${escapeHtml(
      t("txWorkflowVisualEmpty")
    )}</div>`;
    return;
  }
  try {
    const workflow = JSON.parse(raw);
    setTxWorkflowPreview(workflow);
  } catch (e) {
    visualOut.innerHTML = `<div class="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">${escapeHtml(
      `${t("txWorkflowVisualInvalid")}: ${e.message || t("requestFailed")}`
    )}</div>`;
  }
}

function rememberOrchestrationDetail(detail) {
  orchestrationDetailSeq += 1;
  const id = `orch-${orchestrationDetailSeq}`;
  orchestrationDetailMap.set(id, detail);
  return id;
}

function setOrchestrationPreview(plan, inventory, result = null) {
  lastOrchestrationPreview = {
    plan: plan || null,
    inventory: inventory || null,
    result: result || null,
  };
  renderOrchestrationPreview();
}

function renderOrchestrationPreview() {
  const visualOut = byId("orchestration-visual");
  if (!visualOut) return;
  visualOut.innerHTML = renderOrchestrationPreviewHtml(
    lastOrchestrationPreview.plan,
    lastOrchestrationPreview.inventory
  );
}

function renderOrchestrationPreviewFromEditor() {
  const visualOut = byId("orchestration-visual");
  if (!visualOut) return;
  const raw =
    typeof orchestrationEditorRaw === "function"
      ? orchestrationEditorRaw().trim()
      : byId("orchestration-json").value.trim();
  if (!raw) {
    visualOut.innerHTML = `<div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">${escapeHtml(
      t("orchestrationVisualEmpty")
    )}</div>`;
    return;
  }
  try {
    const plan = JSON.parse(raw);
    setOrchestrationPreview(plan, plan.inventory || null, null);
  } catch (e) {
    visualOut.innerHTML = `<div class="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">${escapeHtml(
      `${t("orchestrationVisualInvalid")}: ${e.message || t("requestFailed")}`
    )}</div>`;
  }
}

function openOrchestrationDetail(detail) {
  if (!detail || typeof detail !== "object") return;
  const isStage = detail.kind === "stage";
  openDetailModal(
    isStage
      ? renderOrchestrationStageDetail(detail)
      : renderOrchestrationTargetDetail(detail),
    {
      title: isStage
        ? t("orchestrationStageDetailTitle")
        : t("orchestrationTargetDetailTitle"),
      html: true,
    }
  );
}

function renderOrchestrationResultPanel() {
  const out = byId("orchestration-exec-out");
  if (!out || !lastOrchestrationPreview.result) return;
  out.innerHTML = renderOrchestrationResult(lastOrchestrationPreview.result);
}

function renderRecordingView() {
  const listOut = byId("record-list-out");
  const rawOut = byId("record-jsonl");
  const listBtn = byId("record-view-list");
  const rawBtn = byId("record-view-raw");
  const isList = recordViewMode === "list";
  listBtn.classList.toggle("tab-active", isList);
  rawBtn.classList.toggle("tab-active", !isList);
  setPanelVisible(listOut, isList, "grid");
  setPanelVisible(rawOut, !isList, "block");

  const parsed = parseJsonl(rawOut.value || "");
  if (!parsed.ok) {
    listOut.innerHTML = `<div class="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">${escapeHtml(
      parsed.error
    )}</div>`;
    updateRecordFabBadge(0);
    return;
  }
  const entries = filterEntries(parsed.rows, recordEventKind, recordFailedOnly, recordSearchQuery);
  updateRecordFabBadge(entries.length);
  if (!isList) {
    return;
  }
  if (!entries.length) {
    listOut.innerHTML = `<div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">${escapeHtml(
      recordFailedOnly
        ? t("noFailedEntries")
        : recordEventKind !== "all"
          ? t("noMatchedEntries")
          : t("recordListEmpty")
    )}</div>`;
    return;
  }
  const stats = buildEventStats(entries);
  listOut.innerHTML = `${renderStatsCards(stats)}${renderEntriesTable(entries)}`;
}

function applyRecordingFromResponse(data) {
  const jsonl = data && data.recording_jsonl ? String(data.recording_jsonl) : "";
  if (jsonl) {
    byId("record-jsonl").value = jsonl;
    renderRecordingView();
  }
}
