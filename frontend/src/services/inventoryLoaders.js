export function normalizeInventoryItems(data) {
  return Array.isArray(data) ? data : [];
}

export function applySelectedInventoryItem({
  applyForm,
  byId,
  items,
  pickerId,
}) {
  const selectedName = byId(pickerId)?.value.trim() || "";
  const selected = items.find((item) => item.name === selectedName);
  if (selected) applyForm(selected);
}
