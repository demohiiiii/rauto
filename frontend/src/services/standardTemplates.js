import { getTemplate } from "../api/client.js";
import { renderStatusMessage } from "./runtimeInterop.js";
import { byId } from "./standardPayloads.js";

export async function loadSelectedTemplateContent() {
  const name = byId("template")?.value.trim() || "";
  const preview = byId("template-selected-content");
  const out = byId("render-out");
  if (!preview) {
    return;
  }
  if (!name) {
    preview.value = "";
    return;
  }
  try {
    const data = await getTemplate(name);
    preview.value = data.content || "";
  } catch (error) {
    preview.value = "";
    if (out) {
      out.innerHTML = renderStatusMessage(error.message, "error");
    }
  }
}
