import {
  deleteCustomShowObject,
  getProfileModes,
  listCustomShowObjects,
  listTextfsmMappings,
  saveCustomShowObject,
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

export function createCustomShowObjectManager(node, hooks = {}) {
  let cachedShowObjectTextfsmMappings = [];
  let cachedCustomShowObjects = [];
  let cachedShowObjectModes = [];
  let cachedShowObjectDefaultMode = "";

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
    populateSelect(byId("show-object-profile"), getProfiles(), {
      placeholder: tr(
        "inventoryProfileSelectPlaceholder",
        "Select a device profile",
      ),
      selected: byId("show-object-profile")?.value || "",
    });
  }

  function renderShowObjectModeOptions(selectedMode = "") {
    populateSelect(byId("show-object-mode"), cachedShowObjectModes, {
      selected:
        selectedMode ||
        byId("show-object-mode")?.value ||
        cachedShowObjectDefaultMode ||
        "",
      allowEmpty: false,
    });
  }

  async function loadShowObjectModeOptionsFromWeb(
    profileOverride = "",
    selectedMode = "",
  ) {
    const profile = safeString(
      profileOverride || byId("show-object-profile")?.value || "",
    ).trim();
    if (!profile) {
      cachedShowObjectModes = [];
      cachedShowObjectDefaultMode = "";
      renderShowObjectModeOptions(selectedMode);
      return;
    }
    try {
      const data = await getProfileModes(profile);
      cachedShowObjectModes = Array.isArray(data?.modes)
        ? data.modes.filter(Boolean)
        : [];
      cachedShowObjectDefaultMode = data?.default_mode || "";
    } catch (_) {
      cachedShowObjectModes = [];
      cachedShowObjectDefaultMode = "";
    }
    renderShowObjectModeOptions(selectedMode);
  }

  function renderShowObjectTextfsmMappingOptions() {
    const select = byId("show-object-textfsm-mapping");
    if (!select) return;
    const selected = select.value || "";
    const options = [
      `<option value="">${escapeHtml(
        tr(
          "showObjectMappingSelectPlaceholder",
          "Select profile command mapping",
        ),
      )}</option>`,
      ...cachedShowObjectTextfsmMappings.map((item) => {
        const command = safeString(item.command || "");
        const template = safeString(item.template_name || "");
        return `<option value="${escapeHtml(command)}" data-template="${escapeHtml(
          template,
        )}">${escapeHtml(command)} → ${escapeHtml(template || "-")}</option>`;
      }),
    ];
    select.innerHTML = options.join("");
    if (
      selected &&
      cachedShowObjectTextfsmMappings.some(
        (item) => safeString(item.command || "") === selected,
      )
    ) {
      select.value = selected;
    }
    if (byId("show-object-use-mapping")?.checked) {
      applyShowObjectTextfsmMappingSelection();
    }
  }

  function syncShowObjectMappingRefFromCommand() {
    if (byId("show-object-use-mapping")?.checked) return;
    const select = byId("show-object-textfsm-mapping");
    const command = byId("show-object-command")?.value.trim() || "";
    if (!select) return;
    const matched = cachedShowObjectTextfsmMappings.some(
      (item) => safeString(item.command || "") === command,
    );
    select.value = matched ? command : "";
  }

  function applyShowObjectTextfsmMappingSelection() {
    const select = byId("show-object-textfsm-mapping");
    if (!select) return;
    const command = select.value || "";
    if (!command) return;
    byId("show-object-command").value = command;
    ensureSelectValue(byId("show-object-textfsm-template"), "");
  }

  function syncShowObjectInputMode() {
    const useMapping = !!byId("show-object-use-mapping")?.checked;
    const manualFields = byId("show-object-manual-fields");
    const mappingFields = byId("show-object-mapping-fields");
    if (manualFields) manualFields.hidden = useMapping;
    if (mappingFields) mappingFields.hidden = !useMapping;

    if (useMapping) {
      ensureSelectValue(byId("show-object-textfsm-template"), "");
      applyShowObjectTextfsmMappingSelection();
    } else {
      ensureSelectValue(byId("show-object-textfsm-mapping"), "");
    }
  }

  function renderCustomShowObjectList(errorMessage = "") {
    const out = byId("show-object-list");
    if (!out) return;
    if (errorMessage) {
      out.innerHTML = statusCard(errorMessage, "error");
      return;
    }
    if (!cachedCustomShowObjects.length) {
      out.innerHTML = statusCard(
        tr("showObjectCustomListEmpty", "No custom show objects"),
        "info",
      );
      return;
    }
    const selectedProfile = byId("show-object-profile")?.value.trim() || "";
    const selectedObject = byId("show-object-name")?.value.trim() || "";
    out.innerHTML = cachedCustomShowObjects
      .map((item) => {
        const active =
          selectedProfile === safeString(item.device_profile) &&
          selectedObject === safeString(item.object);
        const cls = active
          ? "border-emerald-300 bg-emerald-50/70"
          : "border-slate-200 bg-white hover:border-slate-300";
        const enabledTone = item.enabled
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-slate-200 bg-slate-50 text-slate-500";
        return `
          <button type="button" class="w-full rounded-xl border px-3 py-2 text-left transition js-show-object-row ${cls}" data-profile="${escapeHtml(
            item.device_profile || "",
          )}" data-object="${escapeHtml(item.object || "")}" data-command="${escapeHtml(
            item.command || "",
          )}" data-textfsm-mapping-command="${escapeHtml(
            item.textfsm_mapping_command || "",
          )}" data-mode="${escapeHtml(item.mode || "")}" data-template="${escapeHtml(
            item.textfsm_template_name || "",
          )}" data-enabled="${item.enabled ? "true" : "false"}">
            <div class="grid gap-1">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <span class="text-sm font-semibold text-slate-800">${escapeHtml(
                  `${item.device_profile || "-"} / ${item.object || "-"}`,
                )}</span>
                <span class="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${enabledTone}">${escapeHtml(
                  item.enabled
                    ? tr("enabled", "Enabled")
                    : tr("disabled", "Disabled"),
                )}</span>
              </div>
              <div class="break-all font-mono text-xs text-slate-600">${escapeHtml(
                item.command || "-",
              )}</div>
              <div class="text-xs text-slate-500">mode=${escapeHtml(
                item.mode || "-",
              )} · mapping=${escapeHtml(
                item.textfsm_mapping_command || "-",
              )} · textfsm=${escapeHtml(item.textfsm_template_name || "-")}</div>
            </div>
          </button>`;
      })
      .join("");
  }

  async function loadShowObjectTextfsmMappingsFromWeb(profileOverride = "") {
    const profile = safeString(
      profileOverride || byId("show-object-profile")?.value || "",
    ).trim();
    try {
      const data = await listTextfsmMappings(profile);
      cachedShowObjectTextfsmMappings = Array.isArray(data) ? data : [];
      renderShowObjectTextfsmMappingOptions();
      syncShowObjectMappingRefFromCommand();
    } catch (_) {
      cachedShowObjectTextfsmMappings = [];
      renderShowObjectTextfsmMappingOptions();
    }
  }

  async function loadCustomShowObjectsFromWeb(profileOverride = "") {
    const profile = safeString(
      profileOverride || byId("show-object-profile")?.value || "",
    ).trim();
    try {
      const data = await listCustomShowObjects(profile);
      cachedCustomShowObjects = Array.isArray(data) ? data : [];
      renderCustomShowObjectList();
    } catch (error) {
      cachedCustomShowObjects = [];
      renderCustomShowObjectList(error.message);
    }
  }

  async function saveCustomShowObjectFromWeb() {
    const deviceProfile = byId("show-object-profile")?.value.trim() || "";
    const object = byId("show-object-name")?.value.trim() || "";
    const useMapping = !!byId("show-object-use-mapping")?.checked;
    const manualCommand = byId("show-object-command")?.value.trim() || "";
    const mode = byId("show-object-mode")?.value.trim() || "";
    const textfsmMappingCommand =
      byId("show-object-textfsm-mapping")?.value.trim() || "";
    const textfsmTemplateName =
      byId("show-object-textfsm-template")?.value.trim() || "";
    const enabled = !!byId("show-object-enabled")?.checked;
    const command = useMapping ? textfsmMappingCommand : manualCommand;
    if (!deviceProfile || !object) {
      setStatus(
        "show-object-out",
        tr(
          "showObjectCustomRequired",
          "profile, object, and command are required",
        ),
        "error",
      );
      return;
    }
    if (!mode) {
      setStatus(
        "show-object-out",
        tr("showObjectModeRequired", "mode is required"),
        "error",
      );
      return;
    }
    if (useMapping && !textfsmMappingCommand) {
      setStatus(
        "show-object-out",
        tr("showObjectMappingRequired", "profile command mapping is required"),
        "error",
      );
      return;
    }
    if (!command) {
      setStatus(
        "show-object-out",
        tr(
          "showObjectCustomRequired",
          "profile, object, and command are required",
        ),
        "error",
      );
      return;
    }
    setStatus("show-object-out", tr("running", "running"), "running");
    try {
      const data = await saveCustomShowObject({
        device_profile: deviceProfile,
        object,
        command,
        mode: mode || null,
        textfsm_mapping_command: useMapping ? textfsmMappingCommand : null,
        textfsm_template_name: useMapping ? null : textfsmTemplateName || null,
        enabled,
      });
      await loadCustomShowObjectsFromWeb(deviceProfile);
      await hooks.onCustomObjectsChanged?.();
      byId("show-object-name").value = data.object || object;
      byId("show-object-command").value = data.command || command;
      ensureSelectValue(byId("show-object-mode"), data.mode || "");
      ensureSelectValue(
        byId("show-object-textfsm-mapping"),
        data.textfsm_mapping_command || "",
      );
      byId("show-object-use-mapping").checked = !!data.textfsm_mapping_command;
      byId("show-object-enabled").checked = data.enabled !== false;
      ensureSelectValue(
        byId("show-object-textfsm-template"),
        data.textfsm_template_name || "",
      );
      syncShowObjectInputMode();
      renderCustomShowObjectList();
      setStatus(
        "show-object-out",
        `${tr("saved", "Saved")}: ${data.device_profile} / ${data.object}`,
        "success",
      );
    } catch (error) {
      setStatus("show-object-out", error.message, "error");
    }
  }

  async function deleteCustomShowObjectFromWeb() {
    const deviceProfile = byId("show-object-profile")?.value.trim() || "";
    const object = byId("show-object-name")?.value.trim() || "";
    if (!deviceProfile || !object) {
      setStatus(
        "show-object-out",
        tr("showObjectCustomDeleteRequired", "profile and object are required"),
        "error",
      );
      return;
    }
    setStatus("show-object-out", tr("running", "running"), "running");
    try {
      await deleteCustomShowObject({
        device_profile: deviceProfile,
        object,
      });
      byId("show-object-name").value = "";
      byId("show-object-command").value = "";
      byId("show-object-mode").value = "";
      ensureSelectValue(byId("show-object-textfsm-mapping"), "");
      ensureSelectValue(byId("show-object-textfsm-template"), "");
      byId("show-object-use-mapping").checked = false;
      byId("show-object-enabled").checked = true;
      syncShowObjectInputMode();
      await loadCustomShowObjectsFromWeb(deviceProfile);
      await hooks.onCustomObjectsChanged?.();
      setStatus(
        "show-object-out",
        `${tr("deleted", "Deleted")}: ${deviceProfile} / ${object}`,
        "success",
      );
    } catch (error) {
      setStatus("show-object-out", error.message, "error");
    }
  }

  async function selectCustomShowObject(row) {
    if (!row) return;
    const profile = row.getAttribute("data-profile") || "";
    const mappingCommand =
      row.getAttribute("data-textfsm-mapping-command") || "";
    const mode = row.getAttribute("data-mode") || "";
    byId("show-object-profile").value = profile;
    byId("show-object-name").value = row.getAttribute("data-object") || "";
    byId("show-object-command").value = row.getAttribute("data-command") || "";
    await loadShowObjectModeOptionsFromWeb(profile, mode);
    await loadShowObjectTextfsmMappingsFromWeb(profile);
    ensureSelectValue(byId("show-object-textfsm-mapping"), mappingCommand);
    ensureSelectValue(
      byId("show-object-textfsm-template"),
      row.getAttribute("data-template") || "",
    );
    byId("show-object-use-mapping").checked = !!mappingCommand;
    byId("show-object-enabled").checked =
      (row.getAttribute("data-enabled") || "true") !== "false";
    syncShowObjectInputMode();
    renderCustomShowObjectList();
  }

  function onCustomShowObjectListClick(event) {
    const row = event.target.closest(".js-show-object-row");
    if (!row) return;
    selectCustomShowObject(row);
  }

  const customShowObjectList = byId("show-object-list");
  const customShowObjectProfile = byId("show-object-profile");
  const customShowObjectUseMapping = byId("show-object-use-mapping");
  const customShowObjectTextfsmMapping = byId("show-object-textfsm-mapping");
  const customShowObjectCommand = byId("show-object-command");
  const customShowObjectRefreshBtn = byId("show-object-refresh-btn");
  const customShowObjectSaveBtn = byId("show-object-save-btn");
  const customShowObjectDeleteBtn = byId("show-object-delete-btn");

  const onCustomShowObjectRefreshClick = () =>
    withLoading("show-object-refresh-btn", () =>
      loadCustomShowObjectsFromWeb(),
    );
  const onCustomShowObjectProfileChange = () => {
    loadCustomShowObjectsFromWeb();
    loadShowObjectTextfsmMappingsFromWeb();
    loadShowObjectModeOptionsFromWeb();
  };
  const onCustomShowObjectTextfsmMappingChange = () =>
    applyShowObjectTextfsmMappingSelection();
  const onCustomShowObjectUseMappingChange = () => syncShowObjectInputMode();
  const onCustomShowObjectCommandInput = () =>
    syncShowObjectMappingRefFromCommand();
  const onCustomShowObjectSaveClick = () =>
    withLoading("show-object-save-btn", saveCustomShowObjectFromWeb);
  const onCustomShowObjectDeleteClick = () =>
    withLoading("show-object-delete-btn", deleteCustomShowObjectFromWeb);

  function init() {
    renderProfileOptions();
    customShowObjectList?.addEventListener(
      "click",
      onCustomShowObjectListClick,
    );
    customShowObjectProfile?.addEventListener(
      "change",
      onCustomShowObjectProfileChange,
    );
    customShowObjectUseMapping?.addEventListener(
      "change",
      onCustomShowObjectUseMappingChange,
    );
    customShowObjectTextfsmMapping?.addEventListener(
      "change",
      onCustomShowObjectTextfsmMappingChange,
    );
    customShowObjectCommand?.addEventListener(
      "input",
      onCustomShowObjectCommandInput,
    );
    customShowObjectRefreshBtn?.addEventListener(
      "click",
      onCustomShowObjectRefreshClick,
    );
    customShowObjectSaveBtn?.addEventListener(
      "click",
      onCustomShowObjectSaveClick,
    );
    customShowObjectDeleteBtn?.addEventListener(
      "click",
      onCustomShowObjectDeleteClick,
    );

    window.loadShowObjectTextfsmMappings = loadShowObjectTextfsmMappingsFromWeb;
    window.renderShowObjectTextfsmMappingOptions =
      renderShowObjectTextfsmMappingOptions;
    window.loadCustomShowObjects = loadCustomShowObjectsFromWeb;
    renderShowObjectTextfsmMappingOptions();
    renderShowObjectModeOptions();
    syncShowObjectInputMode();
    renderCustomShowObjectList();
  }

  function destroy() {
    customShowObjectList?.removeEventListener(
      "click",
      onCustomShowObjectListClick,
    );
    customShowObjectProfile?.removeEventListener(
      "change",
      onCustomShowObjectProfileChange,
    );
    customShowObjectUseMapping?.removeEventListener(
      "change",
      onCustomShowObjectUseMappingChange,
    );
    customShowObjectTextfsmMapping?.removeEventListener(
      "change",
      onCustomShowObjectTextfsmMappingChange,
    );
    customShowObjectCommand?.removeEventListener(
      "input",
      onCustomShowObjectCommandInput,
    );
    customShowObjectRefreshBtn?.removeEventListener(
      "click",
      onCustomShowObjectRefreshClick,
    );
    customShowObjectSaveBtn?.removeEventListener(
      "click",
      onCustomShowObjectSaveClick,
    );
    customShowObjectDeleteBtn?.removeEventListener(
      "click",
      onCustomShowObjectDeleteClick,
    );
  }

  return {
    destroy,
    init,
    load: loadCustomShowObjectsFromWeb,
    loadMappings: loadShowObjectTextfsmMappingsFromWeb,
    loadModes: loadShowObjectModeOptionsFromWeb,
    renderMappingOptions: renderShowObjectTextfsmMappingOptions,
    renderProfileOptions,
  };
}
