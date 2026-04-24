/**
 * profiles.js — profiles
 */

async function fetchProfileModes(profileName) {
  const normalized = (profileName || "").trim() || "linux";
  if (cachedProfileModes.has(normalized)) {
    return cachedProfileModes.get(normalized);
  }
  try {
    const data = await request(
      "GET",
      `/api/device-profiles/${encodeURIComponent(normalized)}/modes`
    );
    const modes = Array.isArray(data.modes) ? data.modes.filter(Boolean) : [];
    const resolved = {
      name: data.name || normalized,
      default_mode: data.default_mode || modes[0] || "Root",
      modes: modes.length > 0 ? modes : [data.default_mode || "Root"],
    };
    cachedProfileModes.set(normalized, resolved);
    return resolved;
  } catch (_) {
    return {
      name: normalized,
      default_mode: "Root",
      modes: ["Root"],
    };
  }
}

function applyModeOptions(selectId, modes, preferredMode, defaultMode) {
  const select = byId(selectId);
  if (!select) return;
  const normalizedModes = (modes || []).filter(Boolean);
  const finalModes = normalizedModes.length > 0 ? normalizedModes : [defaultMode || "Enable"];
  const selected =
    (preferredMode || "").trim() && finalModes.includes((preferredMode || "").trim())
      ? (preferredMode || "").trim()
      : (defaultMode || finalModes[0] || "Enable");
  select.innerHTML = finalModes
    .map((mode) => `<option value="${escapeHtml(mode)}">${escapeHtml(mode)}</option>`)
    .join("");
  select.value = finalModes.includes(selected) ? selected : finalModes[0];
}

function safeSelectValue(selectId) {
  const el = byId(selectId);
  return el ? String(el.value || "").trim() : "";
}

async function refreshExecutionModeOptions(overrides = {}) {
  const profileName = safeSelectValue("device_profile") || "linux";
  const data = await fetchProfileModes(profileName);
  applyModeOptions(
    "mode",
    data.modes,
    overrides.execMode ?? safeSelectValue("mode"),
    data.default_mode
  );
  applyModeOptions(
    "template-mode",
    data.modes,
    overrides.templateMode ?? safeSelectValue("template-mode"),
    data.default_mode
  );
  applyModeOptions(
    "interactive-mode",
    data.modes,
    overrides.interactiveMode ?? safeSelectValue("interactive-mode"),
    data.default_mode
  );
  applyModeOptions(
    "tx-mode",
    data.modes,
    overrides.txMode ?? safeSelectValue("tx-mode"),
    data.default_mode
  );
  applyModeOptions(
    "tx-flow-mode",
    data.modes,
    overrides.txFlowMode ?? safeSelectValue("tx-flow-mode"),
    data.default_mode
  );
  if (typeof renderTxWorkflowBuilder === "function") {
    renderTxWorkflowBuilder();
  }
}

async function loadProfilesOverview() {
  const outBuiltin = byId("builtin-list");
  const builtinSelect = byId("builtin-profile-select");
  try {
    const data = await request("GET", "/api/device-profiles/all");
    cachedProfileModes = new Map();
    cachedDeviceProfiles = [
      ...(data.builtins || []).map((item) => item.name),
      ...(data.custom || []).map((item) => item.name),
    ].filter((name, idx, arr) => !!name && arr.indexOf(name) === idx);

    const lines = data.builtins.map((item) => {
      const aliases = item.aliases.length > 0 ? ` (aliases: ${item.aliases.join(",")})` : "";
      return `- ${item.name}${aliases}: ${item.summary}`;
    });
    outBuiltin.textContent = lines.join("\n") || "-";
    const selectedBuiltinName = safeString(builtinSelect?.value || "").trim();
    populateSelectOptions(
      "builtin-profile-select",
      data.builtins.map((item) => item.name),
      {
        placeholder: t("builtinProfileSelectPlaceholder"),
        selected: selectedBuiltinName,
      }
    );

    if (data.custom.length > 0) {
      cachedCustomProfiles = data.custom.map((item) => item.name);
      setStatusMessage("profile-out", "-", "info");
      renderCustomProfileOptions();
      renderDiagnoseProfileOptions();
    } else {
      cachedCustomProfiles = [];
      setStatusMessage("profile-out", "-", "info");
      renderCustomProfileOptions();
      renderDiagnoseProfileOptions();
    }
    if (typeof loadInventoryConnections === "function") {
      loadInventoryConnections();
    }
    if (typeof renderConnectionProfileOptions === "function") {
      renderConnectionProfileOptions();
    }
    if (byId("builtin-profile-select")?.value.trim()) {
      await loadBuiltinProfileDetail();
    } else {
      clearBuiltinProfileDetail();
    }
    await refreshExecutionModeOptions();
  } catch (e) {
    cachedProfileModes = new Map();
    cachedCustomProfiles = [];
    cachedDeviceProfiles = [];
    setStatusMessage("profile-out", e.message, "error");
    setStatusMessage("builtin-detail-status", e.message, "error");
    renderCustomProfileOptions();
    renderDiagnoseProfileOptions();
    if (typeof loadInventoryConnections === "function") {
      loadInventoryConnections();
    }
    if (typeof renderConnectionProfileOptions === "function") {
      renderConnectionProfileOptions();
    }
    clearBuiltinProfileDetail();
    await refreshExecutionModeOptions();
  }
}

function renderCustomProfileOptions(keyword = "") {
  populateSelectOptions("custom-profile-picker", cachedCustomProfiles, {
    placeholder: t("customProfileSelectPlaceholder"),
    selected: byId("custom-profile-picker").value || "",
  });
}

function renderDiagnoseProfileOptions(keyword = "") {
  populateSelectOptions("profile-diagnose-picker", cachedDeviceProfiles, {
    placeholder: t("profileDiagnoseSelectPlaceholder"),
    selected: byId("profile-diagnose-picker").value || "",
  });
}

async function loadBuiltinProfileDetail() {
  const name = byId("builtin-profile-select").value;
  if (!name) {
    clearBuiltinProfileDetail();
    return;
  }
  try {
    const data = await request(
      "GET",
      `/api/device-profiles/builtin/${encodeURIComponent(name)}`
    );
    const profile = await request(
      "GET",
      `/api/device-profiles/builtin/${encodeURIComponent(name)}/form`
    );
    lastBuiltinProfile = profile;
    byId("builtin-detail-name").value = data.name || "";
    byId("builtin-detail-aliases").value = (data.aliases || []).join(", ");
    byId("builtin-detail-summary").value = data.summary || "";
    byId("builtin-detail-source").value = data.source || "";
    byId("builtin-detail-notes").value = (data.notes || []).join("\n");
    setBuiltinForm(profile);
    setStatusMessage("builtin-detail-status", "-", "info");
  } catch (e) {
    clearBuiltinProfileDetail();
    setStatusMessage("builtin-detail-status", e.message, "error");
  }
}

function clearBuiltinProfileDetail() {
  lastBuiltinProfile = null;
  byId("builtin-detail-name").value = "";
  byId("builtin-detail-aliases").value = "";
  byId("builtin-detail-summary").value = "";
  byId("builtin-detail-source").value = "";
  byId("builtin-detail-notes").value = "";
  setBuiltinForm({
    command_execution: "prompt_driven",
    more_patterns: [],
    error_patterns: [],
    ignore_errors: [],
    prompt_prefix: [],
    prompts: [],
    sys_prompts: [],
    interactions: [],
    transitions: [],
  });
  setStatusMessage("builtin-detail-status", "-", "info");
}

function normalizeCommandExecutionConfig(config) {
  if (!config || config === "prompt_driven") {
    return { mode: "prompt_driven", marker: "" };
  }
  if (typeof config === "string") {
    return { mode: config, marker: "" };
  }
  if (config.shell_exit_status) {
    return {
      mode: "shell_exit_status",
      marker: config.shell_exit_status.marker || "",
    };
  }
  return { mode: "prompt_driven", marker: "" };
}

function commandExecutionPayload(mode, marker) {
  if (mode === "shell_exit_status") {
    return {
      shell_exit_status: {
        marker: (marker || "").trim() || "__RNETER_EXIT_CODE__:",
      },
    };
  }
  return "prompt_driven";
}

function updateProfileCommandExecutionVisibility() {
  const mode = byId("profile-command-execution-mode").value || "prompt_driven";
  const markerInput = byId("profile-command-execution-marker");
  const shellMode = mode === "shell_exit_status";
  markerInput.hidden = !shellMode;
  markerInput.disabled = !shellMode;
}

function updateBuiltinCommandExecutionVisibility() {
  const mode = byId("builtin-command-execution-mode").value || "prompt_driven";
  byId("builtin-command-execution-marker").hidden = mode !== "shell_exit_status";
}

function setBuiltinForm(profile) {
  const commandExecution = normalizeCommandExecutionConfig(profile.command_execution);
  byId("builtin-command-execution-mode").value = commandExecution.mode;
  byId("builtin-command-execution-marker").value = commandExecution.marker;
  updateBuiltinCommandExecutionVisibility();
  clearContainer("builtin-more-list");
  clearContainer("builtin-error-list");
  clearContainer("builtin-ignore-list");
  clearContainer("builtin-prompts-list");
  clearContainer("builtin-sys-prompts-list");
  clearContainer("builtin-prompt-prefix-list");
  clearContainer("builtin-interactions-list");
  clearContainer("builtin-transitions-list");

  (profile.more_patterns || []).forEach((v) =>
    addReadonlySimpleListRow("builtin-more-list", v)
  );
  (profile.error_patterns || []).forEach((v) =>
    addReadonlySimpleListRow("builtin-error-list", v)
  );
  (profile.ignore_errors || []).forEach((v) =>
    addReadonlySimpleListRow("builtin-ignore-list", v)
  );
  (profile.prompts || []).forEach((item) => addReadonlyPromptRow("builtin-prompts-list", item));
  (profile.sys_prompts || []).forEach((item) =>
    addReadonlySysPromptRow("builtin-sys-prompts-list", item)
  );
  (profile.prompt_prefix || []).forEach((v) =>
    addReadonlySimpleListRow("builtin-prompt-prefix-list", v)
  );
  (profile.interactions || []).forEach((item) =>
    addReadonlyInteractionRow("builtin-interactions-list", item)
  );
  (profile.transitions || []).forEach((item) =>
    addReadonlyTransitionRow("builtin-transitions-list", item)
  );
}

function addSimpleListRow(containerId, value = "") {
  const container = byId(containerId);
  const row = document.createElement("div");
  row.className = "field-card";
  row.innerHTML = `
    <div class="inline-input-delete">
      <input class="input js-value" />
      <button type="button" class="mini-btn delete">Delete</button>
    </div>
  `;
  row.querySelector(".js-value").value = value;
  const delBtn = row.querySelector("button");
  delBtn.textContent = t("deleteInlineBtn");
  delBtn.onclick = () => row.remove();
  container.appendChild(row);
}

function addReadonlySimpleListRow(containerId, value = "") {
  const container = byId(containerId);
  const row = document.createElement("div");
  row.className = "field-card";
  row.innerHTML = `<input class="input js-value" readonly />`;
  row.querySelector(".js-value").value = value;
  container.appendChild(row);
}

function collectSimpleList(containerId) {
  return Array.from(byId(containerId).querySelectorAll(".js-value"))
    .map((input) => input.value.trim())
    .filter((v) => v.length > 0);
}

function clearContainer(containerId) {
  byId(containerId).innerHTML = "";
}

function addPromptRow(item = { state: "", patterns: [] }) {
  const container = byId("prompts-list");
  const row = document.createElement("div");
  row.className = "field-card grid gap-2";
  row.innerHTML = `
    <div class="grid gap-2 md:grid-cols-[180px_1fr_auto]">
      <input class="input js-state" placeholder="${escapeHtml(t("fieldState"))}" />
      <div class="js-pattern-list grid gap-2"></div>
      <div class="flex items-start justify-end">
        <button type="button" class="mini-btn delete js-delete-row"></button>
      </div>
    </div>
    <div class="inline-flex items-center gap-2">
      <button type="button" class="mini-btn add js-add-pattern"></button>
    </div>
  `;
  row.querySelector(".js-state").value = item.state || "";
  row.querySelector(".js-delete-row").textContent = t("deleteInlineBtn");
  row.querySelector(".js-add-pattern").textContent = t("addPatternInlineBtn");
  row.querySelector(".js-delete-row").onclick = () => row.remove();
  row.querySelector(".js-add-pattern").onclick = () => {
    addPatternRow(row.querySelector(".js-pattern-list"));
  };
  const patternList = row.querySelector(".js-pattern-list");
  const patterns = Array.isArray(item.patterns) ? item.patterns : [];
  if (patterns.length === 0) {
    addPatternRow(patternList);
  } else {
    patterns.forEach((pattern) => addPatternRow(patternList, pattern));
  }
  container.appendChild(row);
}

function addReadonlyPromptRow(containerId, item = { state: "", patterns: [] }) {
  const container = byId(containerId);
  const row = document.createElement("div");
  row.className = "field-card grid gap-2";
  row.innerHTML = `
    <input class="input js-state" readonly />
    <div class="js-pattern-list grid gap-2"></div>
  `;
  row.querySelector(".js-state").value = item.state || "";
  const patternList = row.querySelector(".js-pattern-list");
  (Array.isArray(item.patterns) ? item.patterns : []).forEach((pattern) =>
    addReadonlyPatternRow(patternList, pattern)
  );
  container.appendChild(row);
}

function collectPromptRows() {
  return Array.from(byId("prompts-list").children).map((row) => ({
    state: row.querySelector(".js-state").value.trim(),
    patterns: collectPatternRows(row.querySelector(".js-pattern-list")),
  })).filter((item) => item.state || item.patterns.length > 0);
}

function addSysPromptRow(item = { state: "", sys_name_group: "", pattern: "" }) {
  const container = byId("sys-prompts-list");
  const row = document.createElement("div");
  row.className = "field-card grid gap-2 md:grid-cols-[1fr_1fr_1.2fr_auto]";
  row.innerHTML = `
    <input class="input js-state" placeholder="${escapeHtml(t("fieldState"))}" />
    <input class="input js-group" placeholder="${escapeHtml(t("fieldSysNameGroup"))}" />
    <input class="input js-pattern" placeholder="${escapeHtml(t("fieldPattern"))}" />
    <div class="flex items-start justify-end">
      <button type="button" class="mini-btn delete js-delete-row"></button>
    </div>
  `;
  row.querySelector(".js-state").value = item.state || "";
  row.querySelector(".js-group").value = item.sys_name_group || "";
  row.querySelector(".js-pattern").value = item.pattern || "";
  row.querySelector(".js-delete-row").textContent = t("deleteInlineBtn");
  row.querySelector(".js-delete-row").onclick = () => row.remove();
  container.appendChild(row);
}

function addReadonlySysPromptRow(
  containerId,
  item = { state: "", sys_name_group: "", pattern: "" }
){
  const container = byId(containerId);
  const row = document.createElement("div");
  row.className = "field-card grid gap-2 md:grid-cols-3";
  row.innerHTML = `
    <input class="input js-state" readonly />
    <input class="input js-group" readonly />
    <input class="input js-pattern" readonly />
  `;
  row.querySelector(".js-state").value = item.state || "";
  row.querySelector(".js-group").value = item.sys_name_group || "";
  row.querySelector(".js-pattern").value = item.pattern || "";
  container.appendChild(row);
}

function collectSysPromptRows() {
  return Array.from(byId("sys-prompts-list").children).map((row) => ({
    state: row.querySelector(".js-state").value.trim(),
    sys_name_group: row.querySelector(".js-group").value.trim(),
    pattern: row.querySelector(".js-pattern").value.trim(),
  })).filter((item) => item.state || item.sys_name_group || item.pattern);
}

function addInteractionRow(item = { state: "", input: "", is_dynamic: false, record_input: true, patterns: [] }) {
  const container = byId("interactions-list");
  const row = document.createElement("div");
  row.className = "field-card grid gap-2";
  row.innerHTML = `
    <div class="grid gap-2 md:grid-cols-[180px_1fr_auto]">
      <input class="input js-state" placeholder="${escapeHtml(t("fieldState"))}" />
      <input class="input js-input" placeholder="${escapeHtml(t("fieldInput"))}" />
      <div class="flex items-start justify-end">
        <button type="button" class="mini-btn delete js-delete-row"></button>
      </div>
    </div>
    <div class="flex flex-wrap items-center gap-3">
      <label class="check-label">
        <input type="checkbox" class="check-input js-is-dynamic" />
        <span>${escapeHtml(t("fieldIsDynamic"))}</span>
      </label>
      <label class="check-label">
        <input type="checkbox" class="check-input js-record-input" />
        <span>${escapeHtml(t("fieldRecordInput"))}</span>
      </label>
      <button type="button" class="mini-btn add js-add-pattern"></button>
    </div>
    <div class="js-pattern-list grid gap-2"></div>
  `;
  row.querySelector(".js-state").value = item.state || "";
  row.querySelector(".js-input").value = item.input || "";
  row.querySelector(".js-is-dynamic").checked = !!item.is_dynamic;
  row.querySelector(".js-record-input").checked =
    item.record_input === undefined ? true : !!item.record_input;
  row.querySelector(".js-delete-row").textContent = t("deleteInlineBtn");
  row.querySelector(".js-add-pattern").textContent = t("addPatternInlineBtn");
  row.querySelector(".js-delete-row").onclick = () => row.remove();
  row.querySelector(".js-add-pattern").onclick = () => {
    addPatternRow(row.querySelector(".js-pattern-list"));
  };
  const patternList = row.querySelector(".js-pattern-list");
  const patterns = Array.isArray(item.patterns) ? item.patterns : [];
  if (patterns.length === 0) {
    addPatternRow(patternList);
  } else {
    patterns.forEach((pattern) => addPatternRow(patternList, pattern));
  }
  container.appendChild(row);
}

function addReadonlyInteractionRow(
  containerId,
  item = { state: "", input: "", is_dynamic: false, record_input: true, patterns: [] }
){
  const container = byId(containerId);
  const row = document.createElement("div");
  row.className = "field-card grid gap-2";
  row.innerHTML = `
    <div class="grid gap-2 md:grid-cols-2">
      <input class="input js-state" readonly />
      <input class="input js-input" readonly />
    </div>
    <div class="flex flex-wrap items-center gap-3">
      <label class="check-label">
        <input type="checkbox" class="check-input js-is-dynamic" disabled />
        <span>${escapeHtml(t("fieldIsDynamic"))}</span>
      </label>
      <label class="check-label">
        <input type="checkbox" class="check-input js-record-input" disabled />
        <span>${escapeHtml(t("fieldRecordInput"))}</span>
      </label>
    </div>
    <div class="js-pattern-list grid gap-2"></div>
  `;
  row.querySelector(".js-state").value = item.state || "";
  row.querySelector(".js-input").value = item.input || "";
  row.querySelector(".js-is-dynamic").checked = !!item.is_dynamic;
  row.querySelector(".js-record-input").checked =
    item.record_input === undefined ? true : !!item.record_input;
  const patternList = row.querySelector(".js-pattern-list");
  (Array.isArray(item.patterns) ? item.patterns : []).forEach((pattern) =>
    addReadonlyPatternRow(patternList, pattern)
  );
  container.appendChild(row);
}

function collectInteractionRows() {
  return Array.from(byId("interactions-list").children).map((row) => ({
    state: row.querySelector(".js-state").value.trim(),
    input: row.querySelector(".js-input").value.trim(),
    is_dynamic: row.querySelector(".js-is-dynamic").checked,
    record_input: row.querySelector(".js-record-input").checked,
    patterns: collectPatternRows(row.querySelector(".js-pattern-list")),
  })).filter((item) => item.state || item.input || item.patterns.length > 0);
}

function addPatternRow(container, value = "") {
  const row = document.createElement("div");
  row.className = "field-card";
  row.innerHTML = `
    <div class="inline-input-delete">
      <input class="input js-pattern-item" />
      <button type="button" class="mini-btn delete">Delete</button>
    </div>
  `;
  row.querySelector(".js-pattern-item").value = value;
  const delBtn = row.querySelector("button");
  delBtn.textContent = t("deleteInlineBtn");
  delBtn.onclick = () => row.remove();
  container.appendChild(row);
}

function addReadonlyPatternRow(container, value = "") {
  const row = document.createElement("div");
  row.className = "field-card";
  row.innerHTML = `<input class="input js-pattern-item" readonly />`;
  row.querySelector(".js-pattern-item").value = value;
  container.appendChild(row);
}

function collectPatternRows(container) {
  return Array.from(container.querySelectorAll(".js-pattern-item"))
    .map((input) => input.value.trim())
    .filter((v) => v.length > 0);
}

function addTransitionRow(item = { from: "", command: "", to: "", is_exit: false, format_sys: false }) {
  const container = byId("transitions-list");
  const row = document.createElement("div");
  row.className = "field-card grid gap-2";
  row.innerHTML = `
    <div class="grid gap-2 md:grid-cols-[1fr_1.2fr_1fr_auto]">
      <input class="input js-from" placeholder="${escapeHtml(t("fieldFrom"))}" />
      <input class="input js-command" placeholder="${escapeHtml(t("fieldCommand"))}" />
      <input class="input js-to" placeholder="${escapeHtml(t("fieldTo"))}" />
      <div class="flex items-start justify-end">
        <button type="button" class="mini-btn delete js-delete-row"></button>
      </div>
    </div>
    <div class="flex flex-wrap items-center gap-3">
      <label class="check-label">
        <input type="checkbox" class="check-input js-is-exit" />
        <span>${escapeHtml(t("fieldIsExit"))}</span>
      </label>
      <label class="check-label">
        <input type="checkbox" class="check-input js-format-sys" />
        <span>${escapeHtml(t("fieldFormatSys"))}</span>
      </label>
    </div>
  `;
  row.querySelector(".js-from").value = item.from || "";
  row.querySelector(".js-command").value = item.command || "";
  row.querySelector(".js-to").value = item.to || "";
  row.querySelector(".js-is-exit").checked = !!item.is_exit;
  row.querySelector(".js-format-sys").checked = !!item.format_sys;
  row.querySelector(".js-delete-row").textContent = t("deleteInlineBtn");
  row.querySelector(".js-delete-row").onclick = () => row.remove();
  container.appendChild(row);
}

function addReadonlyTransitionRow(
  containerId,
  item = { from: "", command: "", to: "", is_exit: false, format_sys: false }
){
  const container = byId(containerId);
  const row = document.createElement("div");
  row.className = "field-card grid gap-2";
  row.innerHTML = `
    <div class="grid gap-2 md:grid-cols-3">
      <input class="input js-from" readonly />
      <input class="input js-command" readonly />
      <input class="input js-to" readonly />
    </div>
    <div class="flex flex-wrap items-center gap-3">
      <label class="check-label">
        <input type="checkbox" class="check-input js-is-exit" disabled />
        <span>${escapeHtml(t("fieldIsExit"))}</span>
      </label>
      <label class="check-label">
        <input type="checkbox" class="check-input js-format-sys" disabled />
        <span>${escapeHtml(t("fieldFormatSys"))}</span>
      </label>
    </div>
  `;
  row.querySelector(".js-from").value = item.from || "";
  row.querySelector(".js-command").value = item.command || "";
  row.querySelector(".js-to").value = item.to || "";
  row.querySelector(".js-is-exit").checked = !!item.is_exit;
  row.querySelector(".js-format-sys").checked = !!item.format_sys;
  container.appendChild(row);
}

function collectTransitionRows() {
  return Array.from(byId("transitions-list").children).map((row) => ({
    from: row.querySelector(".js-from").value.trim(),
    command: row.querySelector(".js-command").value.trim(),
    to: row.querySelector(".js-to").value.trim(),
    is_exit: row.querySelector(".js-is-exit").checked,
    format_sys: row.querySelector(".js-format-sys").checked,
  })).filter((item) => item.from || item.command || item.to);
}

function setProfileForm(profile) {
  byId("custom-profile-picker").value = profile.name || "";
  const commandExecution = normalizeCommandExecutionConfig(profile.command_execution);
  byId("profile-command-execution-mode").value = commandExecution.mode;
  byId("profile-command-execution-marker").value = commandExecution.marker;
  updateProfileCommandExecutionVisibility();
  clearContainer("profile-more-list");
  clearContainer("profile-error-list");
  clearContainer("profile-ignore-list");
  clearContainer("profile-prompt-prefix-list");
  clearContainer("prompts-list");
  clearContainer("sys-prompts-list");
  clearContainer("interactions-list");
  clearContainer("transitions-list");

  (profile.more_patterns || []).forEach((v) => addSimpleListRow("profile-more-list", v));
  (profile.error_patterns || []).forEach((v) => addSimpleListRow("profile-error-list", v));
  (profile.ignore_errors || []).forEach((v) => addSimpleListRow("profile-ignore-list", v));
  (profile.prompt_prefix || []).forEach((v) =>
    addSimpleListRow("profile-prompt-prefix-list", v)
  );
  (profile.prompts || []).forEach((item) => addPromptRow(item));
  (profile.sys_prompts || []).forEach((item) => addSysPromptRow(item));
  (profile.interactions || []).forEach((item) => addInteractionRow(item));
  (profile.transitions || []).forEach((item) => addTransitionRow(item));

  if ((profile.more_patterns || []).length === 0) addSimpleListRow("profile-more-list");
  if ((profile.error_patterns || []).length === 0) addSimpleListRow("profile-error-list");
  if ((profile.ignore_errors || []).length === 0) addSimpleListRow("profile-ignore-list");
  if ((profile.prompt_prefix || []).length === 0) {
    addSimpleListRow("profile-prompt-prefix-list");
  }
}

function collectProfileForm() {
  const commandExecutionMode =
    byId("profile-command-execution-mode").value || "prompt_driven";
  return {
    name: byId("custom-profile-picker").value.trim(),
    command_execution: commandExecutionPayload(
      commandExecutionMode,
      byId("profile-command-execution-marker").value
    ),
    more_patterns: collectSimpleList("profile-more-list"),
    error_patterns: collectSimpleList("profile-error-list"),
    ignore_errors: collectSimpleList("profile-ignore-list"),
    prompt_prefix: collectSimpleList("profile-prompt-prefix-list"),
    prompts: collectPromptRows(),
    sys_prompts: collectSysPromptRows(),
    interactions: collectInteractionRows(),
    transitions: collectTransitionRows(),
  };
}

async function loadCustomProfile() {
  const name = byId("custom-profile-picker").value.trim();
  if (!name) {
    setStatusMessage("profile-out", t("profileNameRequired"), "error");
    return;
  }
  setStatusMessage("profile-out", t("running"), "running");
  try {
    const data = await request(
      "GET",
      `/api/device-profiles/custom/${encodeURIComponent(name)}/form`
    );
    setProfileForm(data);
    setStatusMessage("profile-out", `${t("loaded")}: ${name}`, "success");
  } catch (e) {
    setStatusMessage("profile-out", e.message, "error");
  }
}

async function saveCustomProfile() {
  setStatusMessage("profile-out", t("running"), "running");
  try {
    const profile = collectProfileForm();
    const name = (profile.name || "").trim();
    if (!name) {
      setStatusMessage("profile-out", t("profileNameRequired"), "error");
      return;
    }
    const data = await request(
      "PUT",
      `/api/device-profiles/custom/${encodeURIComponent(name)}/form`,
      profile
    );
    ensureSelectValue("custom-profile-picker", data.name || name);
    setStatusMessage("profile-out", `${t("saved")}: ${data.name || name}`, "success");
    await loadProfilesOverview();
  } catch (e) {
    setStatusMessage("profile-out", e.message, "error");
  }
}

async function createCustomProfileDraft() {
  const name = promptForResourceName(t("profileNewPrompt"));
  if (!name) return;
  setStatusMessage("profile-out", t("running"), "running");
  try {
    const profile = collectProfileForm();
    profile.name = name;
    const data = await request(
      "PUT",
      `/api/device-profiles/custom/${encodeURIComponent(name)}/form`,
      profile
    );
    ensureSelectValue("custom-profile-picker", data.name || name);
    setStatusMessage("profile-out", `${t("saved")}: ${data.name || name}`, "success");
    await loadProfilesOverview();
    if (byId("custom-profile-picker").value.trim()) {
      await loadCustomProfile();
    }
  } catch (e) {
    setStatusMessage("profile-out", e.message, "error");
  }
}

async function deleteCustomProfile() {
  const name = byId("custom-profile-picker").value.trim();
  if (!name) {
    setStatusMessage("profile-out", t("profileNameRequired"), "error");
    return;
  }
  setStatusMessage("profile-out", t("running"), "running");
  try {
    await request("DELETE", `/api/device-profiles/custom/${encodeURIComponent(name)}`);
    byId("custom-profile-picker").value = "";
    setProfileForm({
      name: "",
      more_patterns: [],
      error_patterns: [],
      ignore_errors: [],
      prompt_prefix: [],
      prompts: [],
      sys_prompts: [],
      interactions: [],
      transitions: [],
    });
    setStatusMessage("profile-out", `${t("deleted")}: ${name}`, "success");
    await loadProfilesOverview();
  } catch (e) {
    setStatusMessage("profile-out", e.message, "error");
  }
}
