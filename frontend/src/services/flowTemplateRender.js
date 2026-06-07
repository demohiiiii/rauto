import {
  escapeHtml,
  populateSelect,
  safeString,
  statusCard,
  tr,
} from "./templateUi.js";

const FLOW_BUILTIN_PREFIX = "builtin:";

export function buildBuiltinFlowTemplateValue(name) {
  const normalized = safeString(name).trim();
  return normalized ? `${FLOW_BUILTIN_PREFIX}${normalized}` : "";
}

export function renderFlowTemplateListView({
  errorMessage = "",
  metas = [],
  out,
  selectedName = "",
}) {
  if (!out) return;
  if (errorMessage) {
    out.innerHTML = statusCard(errorMessage, "error");
    return;
  }
  if (!Array.isArray(metas) || metas.length === 0) {
    out.innerHTML = statusCard(
      tr("flowTemplateListEmpty", "No command flow templates"),
      "info",
    );
    return;
  }
  out.innerHTML = metas
    .map((item) => {
      const active = selectedName && item.name === selectedName;
      const cls = active
        ? "border-teal-300 bg-teal-50/70"
        : "border-slate-200 bg-white hover:border-slate-300";
      return `
          <button type="button" class="w-full rounded-xl border px-3 py-2 text-left transition js-flow-template-row ${cls}" data-name="${escapeHtml(
            item.name || "",
          )}">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <span class="text-sm font-semibold text-slate-800">${escapeHtml(
                item.name || "-",
              )}</span>
              <span class="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-600">${escapeHtml(
                tr("flowTemplateUseBtn", "Use"),
              )}</span>
            </div>
          </button>`;
    })
    .join("");
}

export function renderBuiltinFlowTemplateListView({
  errorMessage = "",
  metas = [],
  out,
  selectedName = "",
}) {
  if (!out) return;
  if (errorMessage) {
    out.innerHTML = statusCard(errorMessage, "error");
    return;
  }
  if (!Array.isArray(metas) || metas.length === 0) {
    out.innerHTML = statusCard(
      tr("flowBuiltinTemplateListEmpty", "No built-in command flow templates"),
      "info",
    );
    return;
  }
  out.innerHTML = metas
    .map((item) => {
      const active = selectedName && item.name === selectedName;
      const cls = active
        ? "border-cyan-300 bg-cyan-50/60"
        : "border-slate-200 bg-white hover:border-slate-300";
      return `
          <button type="button" class="w-full rounded-xl border px-3 py-2 text-left transition js-flow-builtin-template-row ${cls}" data-name="${escapeHtml(
            item.name || "",
          )}">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <span class="text-sm font-semibold text-slate-800">${escapeHtml(
                item.name || "-",
              )}</span>
              <span class="inline-flex items-center rounded-full border border-cyan-200 bg-cyan-50 px-2 py-0.5 text-xs font-semibold text-cyan-700">${escapeHtml(
                tr("builtinLabel", "Built-in"),
              )}</span>
            </div>
          </button>`;
    })
    .join("");
}

export function renderFlowTemplateSelects({
  builtinMetas = [],
  byId,
  names = [],
}) {
  const builtinRunValues = builtinMetas
    .map((item) => buildBuiltinFlowTemplateValue(item.name))
    .filter(Boolean);
  const runTemplateValues = [...names, ...builtinRunValues];

  populateSelect(byId("flow-template-picker"), names, {
    placeholder: tr(
      "flowTemplateSelectPlaceholder",
      "Select command flow template",
    ),
    selected: byId("flow-template-picker")?.value || "",
  });
  populateSelect(
    byId("flow-template-builtin-picker"),
    builtinMetas.map((item) => item.name).filter(Boolean),
    {
      placeholder: tr(
        "flowBuiltinTemplateSelectPlaceholder",
        "Select built-in command flow template",
      ),
      selected: byId("flow-template-builtin-picker")?.value || "",
    },
  );
  populateSelect(
    document.getElementById("flow-template-name"),
    runTemplateValues,
    {
      placeholder: tr(
        "flowTemplateRunPlaceholder",
        "Select command flow template",
      ),
      selected: document.getElementById("flow-template-name")?.value || "",
    },
  );
}
