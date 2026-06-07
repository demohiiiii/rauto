import { ensureInventorySelectValue } from "./inventoryForms.js";
import { tr } from "./templateUi.js";

export function selectedInventoryName(byId, pickerId) {
  return byId(pickerId)?.value.trim() || "";
}

export function requireInventoryName({
  byId,
  message,
  pickerId,
  setStatus,
  statusId,
}) {
  const name = selectedInventoryName(byId, pickerId);
  if (name) return name;
  setStatus(statusId, message, "error");
  return "";
}

export async function loadInventoryDetail({
  applyForm,
  byId,
  getDetail,
  pickerId,
  renderList,
  resetForm,
  setStatus,
  statusId,
}) {
  const name = selectedInventoryName(byId, pickerId);
  if (!name) {
    resetForm("");
    setStatus(statusId, "-", "info");
    renderList();
    return;
  }
  setStatus(statusId, tr("running", "running"), "running");
  try {
    const data = await getDetail(name);
    applyForm(data);
    renderList();
    setStatus(
      statusId,
      `${tr("loaded", "loaded")}: ${data.name || name}`,
      "success",
    );
  } catch (error) {
    setStatus(statusId, error.message, "error");
  }
}

export async function loadInventoryCollection({
  applySelected,
  listItems,
  onLoaded,
  onReset,
  renderList,
  renderOptions,
  syncSnapshots,
  selectedName = "",
}) {
  try {
    const items = await listItems();
    onLoaded(items);
    syncSnapshots();
    renderOptions(selectedName);
    renderList();
    applySelected();
  } catch (error) {
    onReset();
    syncSnapshots();
    renderOptions("");
    renderList(error.message);
  }
}

export async function createInventoryDraft({
  byId,
  existsHint,
  items,
  loadDetail,
  pickerId,
  promptMessage,
  saveByName,
  setStatus,
  statusId,
}) {
  const name = window.prompt(promptMessage);
  const trimmedName = name?.trim();
  if (!trimmedName) return;
  if (items.some((item) => item.name === trimmedName)) {
    ensureInventorySelectValue(byId, pickerId, trimmedName);
    await loadDetail();
    setStatus(statusId, existsHint, "info");
    return;
  }
  await saveByName(trimmedName, tr("created", "created"));
}

export async function saveInventoryEntity({
  applyForm,
  buildPayload,
  name,
  saveEntity,
  setStatus,
  statusId,
  verb = tr("saved", "saved"),
  reload,
}) {
  setStatus(statusId, tr("running", "running"), "running");
  try {
    const data = await saveEntity(name, buildPayload(name));
    applyForm(data);
    setStatus(statusId, `${verb}: ${data.name || name}`, "success");
    await reload();
  } catch (error) {
    setStatus(statusId, error.message, "error");
  }
}

export async function deleteInventoryEntity({
  deleteEntity,
  name,
  reload,
  resetForm,
  setStatus,
  statusId,
}) {
  setStatus(statusId, tr("running", "running"), "running");
  try {
    await deleteEntity(name);
    resetForm("");
    setStatus(statusId, `${tr("deleted", "deleted")}: ${name}`, "success");
    await reload();
  } catch (error) {
    setStatus(statusId, error.message, "error");
  }
}
