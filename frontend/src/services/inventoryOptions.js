import { populateSelect, tr } from "./templateUi.js";

export function renderInventoryEntityOptions({
  byId,
  items,
  pickerId,
  placeholder,
  selectedName = "",
}) {
  populateSelect(
    byId(pickerId),
    items.map((item) => item.name).filter(Boolean),
    {
      placeholder,
      selected: selectedName,
    },
  );
}

export function refreshSavedConnectionGroupOptions() {
  window.renderSavedConnectionGroupOptions?.(
    Array.from(
      document.getElementById("saved-conn-groups")?.selectedOptions || [],
    ).map((option) => option.value),
  );
}

export function refreshSavedConnectionLabelOptions() {
  window.renderSavedConnectionLabelOptions?.();
}

export function inventoryGroupPlaceholder() {
  return tr("inventoryGroupSelectPlaceholder", "select group");
}

export function inventoryLabelPlaceholder() {
  return tr("inventoryLabelSelectPlaceholder", "select label");
}
