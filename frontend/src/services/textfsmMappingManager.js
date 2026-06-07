import {
  deleteTextfsmMapping,
  listTextfsmMappings,
  saveTextfsmMapping,
} from "../api/client.js";
import {
  ensureSelectValue,
  escapeHtml,
  populateSelect,
  safeString,
  setStatus,
  statusCard,
  tr,
  withLoading,
} from "./templateUi.js";

export function createTextfsmMappingManager(node, hooks = {}) {
  let cachedTextfsmMappings = [];

  const byId = (id) =>
    node.querySelector(`#${id}`) || document.getElementById(id);

  function getProfiles() {
    const profiles =
      typeof hooks.getDeviceProfiles === "function"
        ? hooks.getDeviceProfiles()
        : Array.isArray(window.cachedDeviceProfiles)
          ? window.cachedDeviceProfiles
          : [];
    return profiles.filter((name) => name && name !== "autodetect");
  }

  function renderProfileOptions() {
    populateSelect(byId("textfsm-mapping-profile"), getProfiles(), {
      placeholder: tr(
        "inventoryProfileSelectPlaceholder",
        "Select a device profile",
      ),
      selected: byId("textfsm-mapping-profile")?.value || "",
    });
  }

  function renderTextfsmMappingList(errorMessage = "") {
    const out = byId("textfsm-mapping-list");
    if (!out) return;
    if (errorMessage) {
      out.innerHTML = statusCard(errorMessage, "error");
      return;
    }
    if (!cachedTextfsmMappings.length) {
      out.innerHTML = statusCard(
        tr("textfsmMappingListEmpty", "No custom TextFSM mappings"),
        "info",
      );
      return;
    }
    const selectedProfile = byId("textfsm-mapping-profile")?.value.trim() || "";
    const selectedCommand = byId("textfsm-mapping-command")?.value.trim() || "";
    out.innerHTML = cachedTextfsmMappings
      .map((item) => {
        const active =
          selectedProfile === safeString(item.device_profile) &&
          selectedCommand === safeString(item.command);
        const cls = active
          ? "border-cyan-300 bg-cyan-50/70"
          : "border-slate-200 bg-white hover:border-slate-300";
        return `
          <button type="button" class="w-full rounded-xl border px-3 py-2 text-left transition js-textfsm-mapping-row ${cls}" data-profile="${escapeHtml(
            item.device_profile || "",
          )}" data-command="${escapeHtml(
            item.command || "",
          )}" data-template="${escapeHtml(item.template_name || "")}">
            <div class="grid gap-1">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <span class="text-sm font-semibold text-slate-800">${escapeHtml(
                  item.device_profile || "-",
                )}</span>
                <span class="inline-flex items-center rounded-full border border-cyan-200 bg-cyan-50 px-2 py-0.5 text-xs font-semibold text-cyan-700">${escapeHtml(
                  item.template_name || "-",
                )}</span>
              </div>
              <div class="break-all font-mono text-xs text-slate-600">${escapeHtml(
                item.command || "-",
              )}</div>
            </div>
          </button>`;
      })
      .join("");
  }

  async function loadTextfsmMappingsFromWeb(profileOverride = "") {
    const profile = safeString(
      profileOverride || byId("textfsm-mapping-profile")?.value || "",
    ).trim();
    try {
      const data = await listTextfsmMappings(profile);
      cachedTextfsmMappings = Array.isArray(data) ? data : [];
      renderTextfsmMappingList();
    } catch (error) {
      cachedTextfsmMappings = [];
      renderTextfsmMappingList(error.message);
    }
  }

  async function saveTextfsmMappingFromWeb() {
    const deviceProfile = byId("textfsm-mapping-profile")?.value.trim() || "";
    const command = byId("textfsm-mapping-command")?.value.trim() || "";
    const templateName = byId("textfsm-mapping-template")?.value.trim() || "";
    if (!deviceProfile || !command || !templateName) {
      setStatus(
        "textfsm-mapping-out",
        tr(
          "textfsmMappingRequired",
          "profile, command, and template are required",
        ),
        "error",
      );
      return;
    }
    setStatus("textfsm-mapping-out", tr("running", "running"), "running");
    try {
      const data = await saveTextfsmMapping({
        device_profile: deviceProfile,
        command,
        template_name: templateName,
      });
      await loadTextfsmMappingsFromWeb(deviceProfile);
      await hooks.onMappingsChanged?.(deviceProfile);
      ensureSelectValue(byId("textfsm-mapping-template"), data.template_name);
      renderTextfsmMappingList();
      setStatus(
        "textfsm-mapping-out",
        `${tr("saved", "Saved")}: ${data.device_profile} / ${data.command}`,
        "success",
      );
    } catch (error) {
      setStatus("textfsm-mapping-out", error.message, "error");
    }
  }

  async function deleteTextfsmMappingFromWeb() {
    const deviceProfile = byId("textfsm-mapping-profile")?.value.trim() || "";
    const command = byId("textfsm-mapping-command")?.value.trim() || "";
    if (!deviceProfile || !command) {
      setStatus(
        "textfsm-mapping-out",
        tr("textfsmMappingDeleteRequired", "profile and command are required"),
        "error",
      );
      return;
    }
    setStatus("textfsm-mapping-out", tr("running", "running"), "running");
    try {
      await deleteTextfsmMapping({
        device_profile: deviceProfile,
        command,
      });
      byId("textfsm-mapping-command").value = "";
      await loadTextfsmMappingsFromWeb(deviceProfile);
      await hooks.onMappingsChanged?.(deviceProfile);
      setStatus(
        "textfsm-mapping-out",
        `${tr("deleted", "Deleted")}: ${deviceProfile} / ${command}`,
        "success",
      );
    } catch (error) {
      setStatus("textfsm-mapping-out", error.message, "error");
    }
  }

  function selectTextfsmMapping(row) {
    if (!row) return;
    byId("textfsm-mapping-profile").value =
      row.getAttribute("data-profile") || "";
    byId("textfsm-mapping-command").value =
      row.getAttribute("data-command") || "";
    ensureSelectValue(
      byId("textfsm-mapping-template"),
      row.getAttribute("data-template") || "",
    );
    renderTextfsmMappingList();
  }

  function onTextfsmMappingListClick(event) {
    const row = event.target.closest(".js-textfsm-mapping-row");
    if (!row) return;
    selectTextfsmMapping(row);
  }

  const textfsmMappingList = byId("textfsm-mapping-list");
  const textfsmMappingProfile = byId("textfsm-mapping-profile");
  const textfsmMappingRefreshBtn = byId("textfsm-mapping-refresh-btn");
  const textfsmMappingSaveBtn = byId("textfsm-mapping-save-btn");
  const textfsmMappingDeleteBtn = byId("textfsm-mapping-delete-btn");

  const onTextfsmMappingRefreshClick = () =>
    withLoading("textfsm-mapping-refresh-btn", () =>
      loadTextfsmMappingsFromWeb(),
    );
  const onTextfsmMappingProfileChange = () => loadTextfsmMappingsFromWeb();
  const onTextfsmMappingSaveClick = () =>
    withLoading("textfsm-mapping-save-btn", saveTextfsmMappingFromWeb);
  const onTextfsmMappingDeleteClick = () =>
    withLoading("textfsm-mapping-delete-btn", deleteTextfsmMappingFromWeb);

  function init() {
    renderProfileOptions();
    textfsmMappingList?.addEventListener("click", onTextfsmMappingListClick);
    textfsmMappingProfile?.addEventListener(
      "change",
      onTextfsmMappingProfileChange,
    );
    textfsmMappingRefreshBtn?.addEventListener(
      "click",
      onTextfsmMappingRefreshClick,
    );
    textfsmMappingSaveBtn?.addEventListener("click", onTextfsmMappingSaveClick);
    textfsmMappingDeleteBtn?.addEventListener(
      "click",
      onTextfsmMappingDeleteClick,
    );

    window.loadTextfsmMappings = loadTextfsmMappingsFromWeb;
    renderTextfsmMappingList();
  }

  function destroy() {
    textfsmMappingList?.removeEventListener("click", onTextfsmMappingListClick);
    textfsmMappingProfile?.removeEventListener(
      "change",
      onTextfsmMappingProfileChange,
    );
    textfsmMappingRefreshBtn?.removeEventListener(
      "click",
      onTextfsmMappingRefreshClick,
    );
    textfsmMappingSaveBtn?.removeEventListener(
      "click",
      onTextfsmMappingSaveClick,
    );
    textfsmMappingDeleteBtn?.removeEventListener(
      "click",
      onTextfsmMappingDeleteClick,
    );
  }

  return {
    destroy,
    init,
    load: loadTextfsmMappingsFromWeb,
    render: renderTextfsmMappingList,
    renderProfileOptions,
  };
}
