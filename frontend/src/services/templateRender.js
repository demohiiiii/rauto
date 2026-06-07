import { escapeHtml, populateSelect, statusCard, tr } from "./templateUi.js";

export function renderTemplateListView({
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
    out.innerHTML = statusCard(tr("templateListEmpty", "No templates"), "info");
    return;
  }
  out.innerHTML = metas
    .map((item) => {
      const active = selectedName && item.name === selectedName;
      const cls = active
        ? "border-teal-300 bg-teal-50/70"
        : "border-slate-200 bg-white hover:border-slate-300";
      return `
          <button type="button" class="w-full rounded-xl border px-3 py-2 text-left transition js-template-row ${cls}" data-name="${escapeHtml(
            item.name || "",
          )}">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <span class="text-sm font-semibold text-slate-800">${escapeHtml(
                item.name || "-",
              )}</span>
              <span class="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-600">${escapeHtml(
                tr("templateUseBtn", "Use"),
              )}</span>
            </div>
          </button>`;
    })
    .join("");
}

export function renderTemplateSelects({ byId, names = [], selectedName = "" }) {
  populateSelect(byId("template-pick-name"), names, {
    placeholder: tr("templateSelectPlaceholder", "Select template"),
    selected: selectedName,
  });
  populateSelect(document.getElementById("template"), names, {
    placeholder: tr("templateSelectPlaceholder", "Select template"),
    selected: document.getElementById("template")?.value || "",
  });
}
