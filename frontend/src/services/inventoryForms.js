import { normalizeInventoryHostSelection } from "./inventoryHostSelection.js";
import { safeString, tr } from "./templateUi.js";

export function ensureInventorySelectValue(byId, id, value) {
  const select = byId(id);
  if (!select) return;
  select.value = value || "";
}

export function resetInventoryGroupFormView({ byId, name = "" }) {
  ensureInventorySelectValue(byId, "inventory-group-picker", name);
  byId("inventory-group-name-value").textContent = name || "—";
  byId("inventory-group-description").value = "";
  byId("inventory-group-vars").value = "{\n  \n}";
  return new Set();
}

export function applyInventoryGroupFormView({ byId, group = {} }) {
  ensureInventorySelectValue(byId, "inventory-group-picker", group.name || "");
  byId("inventory-group-name-value").textContent = safeString(
    group.name || "—",
  );
  byId("inventory-group-description").value = safeString(
    group.description || "",
  );
  byId("inventory-group-vars").value = JSON.stringify(
    group.vars || {},
    null,
    2,
  );
  return normalizeInventoryHostSelection(group.hosts);
}

export function resetInventoryLabelFormView({ byId, name = "" }) {
  ensureInventorySelectValue(byId, "inventory-label-picker", name);
  byId("inventory-label-name-value").textContent = name || "—";
  return new Set();
}

export function applyInventoryLabelFormView({ byId, label = {} }) {
  ensureInventorySelectValue(byId, "inventory-label-picker", label.name || "");
  byId("inventory-label-name-value").textContent = safeString(
    label.name || "—",
  );
  return normalizeInventoryHostSelection(label.hosts);
}

export function parseInventoryJsonObject(byId, id) {
  const raw = byId(id)?.value.trim() || "";
  if (!raw) return {};
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(error.message || String(error));
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(
      tr("inventoryVarsMustBeObject", "vars must be a JSON object"),
    );
  }
  return parsed;
}

export function inventoryGroupFormPayload({ byId, hostSelection, name }) {
  return {
    name,
    description: byId("inventory-group-description")?.value.trim() || null,
    hosts: Array.from(hostSelection).sort((a, b) => a.localeCompare(b)),
    vars: parseInventoryJsonObject(byId, "inventory-group-vars"),
  };
}

export function sortedInventoryHosts(selection) {
  return Array.from(selection).sort((a, b) => a.localeCompare(b));
}
