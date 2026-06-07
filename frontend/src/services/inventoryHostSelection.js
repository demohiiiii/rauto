import {
  normalizeHostNames,
  renderHostChecklistView,
} from "./inventoryRender.js";
import { safeString } from "./templateUi.js";

export function inventoryHostOptions(savedConnections, selectedHosts = []) {
  const available = normalizeHostNames(
    savedConnections.map((item) => item.name),
  );
  return {
    availableSet: new Set(available),
    names: normalizeHostNames([...available, ...selectedHosts]),
  };
}

export function normalizeInventoryHostSelection(hosts = []) {
  return new Set(normalizeHostNames(Array.isArray(hosts) ? hosts : []));
}

export function renderInventoryHostChecklist({
  byId,
  checkboxAttr,
  emptyId,
  filterId,
  listId,
  savedConnections,
  selection,
}) {
  const { availableSet, names } = inventoryHostOptions(
    savedConnections,
    Array.from(selection),
  );
  renderHostChecklistView({
    availableSet,
    checkboxAttr,
    empty: byId(emptyId),
    filterValue: byId(filterId)?.value || "",
    list: byId(listId),
    names,
    selection,
  });
}

export function selectVisibleInventoryHosts({
  byId,
  filterId,
  savedConnections,
  selection,
}) {
  const filter = safeString(byId(filterId)?.value || "")
    .trim()
    .toLowerCase();
  inventoryHostOptions(savedConnections, Array.from(selection))
    .names.filter((name) => !filter || name.toLowerCase().includes(filter))
    .forEach((name) => selection.add(name));
}

export function updateInventoryHostSelection(event, selection, selector) {
  const input = event.target;
  if (!input?.matches(selector)) return;
  if (input.checked) selection.add(input.value);
  else selection.delete(input.value);
}

export function selectAllInventoryHosts({
  byId,
  filterId,
  renderHosts,
  savedConnections,
  selection,
}) {
  selectVisibleInventoryHosts({
    byId,
    filterId,
    savedConnections,
    selection,
  });
  renderHosts();
}

export function clearInventoryHosts(selection, renderHosts) {
  selection.clear();
  renderHosts();
}

export function onInventoryHostSelectionChange({ event, selection, selector }) {
  updateInventoryHostSelection(event, selection, selector);
}
