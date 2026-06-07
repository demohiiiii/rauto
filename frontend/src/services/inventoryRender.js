import { escapeHtml, safeString, statusCard, tr } from "./templateUi.js";

export function normalizeHostNames(values) {
  return Array.from(
    new Set(
      (values || []).map((item) => safeString(item).trim()).filter(Boolean),
    ),
  ).sort((a, b) => a.localeCompare(b));
}

export function renderHostChecklistView({
  availableSet,
  checkboxAttr,
  empty,
  filterValue = "",
  list,
  names = [],
  selection,
}) {
  if (!list || !empty) return;
  const filter = safeString(filterValue).trim().toLowerCase();
  const filtered = names.filter(
    (name) => !filter || name.toLowerCase().includes(filter),
  );
  if (!filtered.length) {
    list.innerHTML = "";
    empty.textContent = names.length
      ? tr("inventoryHostsNoMatch", "no matching saved connections")
      : tr("inventoryHostsEmpty", "no saved connections");
    empty.hidden = false;
    return;
  }
  empty.hidden = true;
  list.innerHTML = filtered
    .map((name) => {
      const missing = !availableSet.has(name);
      const missingTag = missing
        ? ` <span class="text-xs text-amber-600">${escapeHtml(
            tr("inventoryHostMissingSuffix", "(missing)"),
          )}</span>`
        : "";
      return `<label class="label cursor-pointer justify-start gap-2 rounded-lg px-2 py-1 hover:bg-base-200">
          <input type="checkbox" class="checkbox checkbox-sm" ${checkboxAttr} value="${escapeHtml(
            name,
          )}" ${selection.has(name) ? "checked" : ""} />
          <span class="label-text font-medium">${escapeHtml(name)}</span>${missingTag}
        </label>`;
    })
    .join("");
}

export function renderInventoryGroupListView({
  errorMessage = "",
  groups = [],
  out,
  selectedName = "",
}) {
  if (!out) return;
  if (errorMessage) {
    out.innerHTML = statusCard(errorMessage, "error");
    return;
  }
  if (!groups.length) {
    out.innerHTML = statusCard(tr("inventoryGroupsEmpty", "no groups"), "info");
    return;
  }
  out.innerHTML = groups
    .map((item) => {
      const active = selectedName && item.name === selectedName;
      const cls = active
        ? "border-teal-300 bg-teal-50/70"
        : "border-slate-200 bg-white hover:border-slate-300";
      const hostCount = Array.isArray(item.hosts) ? item.hosts.length : 0;
      return `
          <button type="button" class="w-full rounded-xl border px-3 py-2 text-left transition js-inventory-group-row ${cls}" data-name="${escapeHtml(
            item.name || "",
          )}">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <span class="text-sm font-semibold text-slate-800">${escapeHtml(item.name || "-")}</span>
              <span class="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-600">${escapeHtml(
                `${hostCount} ${tr("inventoryHostsCountSuffix", "hosts")}`,
              )}</span>
            </div>
            <div class="mt-1 text-xs text-slate-500">${escapeHtml(
              safeString(
                item.description ||
                  tr("inventoryNoDescription", "no description"),
              ),
            )}</div>
          </button>`;
    })
    .join("");
}

export function renderInventoryLabelListView({
  errorMessage = "",
  labels = [],
  out,
  selectedName = "",
}) {
  if (!out) return;
  if (errorMessage) {
    out.innerHTML = statusCard(errorMessage, "error");
    return;
  }
  if (!labels.length) {
    out.innerHTML = statusCard(tr("inventoryLabelsEmpty", "no labels"), "info");
    return;
  }
  out.innerHTML = labels
    .map((item) => {
      const active = selectedName && item.name === selectedName;
      const cls = active
        ? "border-teal-300 bg-teal-50/70"
        : "border-slate-200 bg-white hover:border-slate-300";
      const hostCount = Array.isArray(item.hosts) ? item.hosts.length : 0;
      return `
          <button type="button" class="w-full rounded-xl border px-3 py-2 text-left transition js-inventory-label-row ${cls}" data-name="${escapeHtml(
            item.name || "",
          )}">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <span class="text-sm font-semibold text-slate-800">${escapeHtml(item.name || "-")}</span>
              <span class="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-600">${escapeHtml(
                `${hostCount} ${tr("inventoryHostsCountSuffix", "hosts")}`,
              )}</span>
            </div>
          </button>`;
    })
    .join("");
}
