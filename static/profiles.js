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

async function refreshExecutionModeOptions(overrides = {}) {
  const profileName = byId("device_profile").value.trim() || "linux";
  const data = await fetchProfileModes(profileName);
  applyModeOptions(
    "mode",
    data.modes,
    overrides.execMode ?? byId("mode").value,
    data.default_mode
  );
  applyModeOptions(
    "template-mode",
    data.modes,
    overrides.templateMode ?? byId("template-mode").value,
    data.default_mode
  );
  applyModeOptions(
    "interactive-mode",
    data.modes,
    overrides.interactiveMode ?? byId("interactive-mode").value,
    data.default_mode
  );
  applyModeOptions(
    "tx-mode",
    data.modes,
    overrides.txMode ?? byId("tx-mode").value,
    data.default_mode
  );
  applyModeOptions(
    "tx-flow-mode",
    data.modes,
    overrides.txFlowMode ?? byId("tx-flow-mode").value,
    data.default_mode
  );
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
    builtinSelect.innerHTML = data.builtins
      .map((item) => `<option value="${item.name}">${item.name}</option>`)
      .join("");
    setStatusMessage("builtin-detail-status", "-", "info");

    if (data.custom.length > 0) {
      cachedCustomProfiles = data.custom.map((item) => item.name);
      setStatusMessage("profile-out", `${t("loaded")}: ${data.custom.length}`, "info");
      renderCustomProfileOptions();
      renderDiagnoseProfileOptions();
    } else {
      cachedCustomProfiles = [];
      setStatusMessage("profile-out", "-", "info");
      renderCustomProfileOptions();
      renderDiagnoseProfileOptions();
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
    await refreshExecutionModeOptions();
  }
}

function renderCustomProfileOptions(keyword = "") {
  const datalist = byId("custom-profile-options");
  const q = keyword.trim().toLowerCase();
  const names = cachedCustomProfiles.filter((name) =>
    !q ? true : name.toLowerCase().includes(q)
  );
  const html = names.map((name) => `<option value="${name}"></option>`).join("");
  datalist.innerHTML = html;
}

function renderDiagnoseProfileOptions(keyword = "") {
  const datalist = byId("profile-diagnose-options");
  const q = keyword.trim().toLowerCase();
  const names = cachedDeviceProfiles.filter((name) =>
    !q ? true : name.toLowerCase().includes(q)
  );
  datalist.innerHTML = names.map((name) => `<option value="${name}"></option>`).join("");
}

async function loadBuiltinProfileDetail() {
  const name = byId("builtin-profile-select").value;
  if (!name) {
    setStatusMessage("builtin-detail-status", "-", "info");
    return;
  }
  setStatusMessage("builtin-detail-status", t("running"), "running");
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
    setStatusMessage("builtin-detail-status", `${data.name}: ${data.summary}`, "success");
  } catch (e) {
    lastBuiltinProfile = null;
    setStatusMessage("builtin-detail-status", e.message, "error");
  }
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
  clearContainer("prompts-list");
  clearContainer("sys-prompts-list");
  clearContainer("interactions-list");
  clearContainer("transitions-list");

  (profile.more_patterns || []).forEach((v) => addSimpleListRow("profile-more-list", v));
  (profile.error_patterns || []).forEach((v) => addSimpleListRow("profile-error-list", v));
  (profile.ignore_errors || []).forEach((v) => addSimpleListRow("profile-ignore-list", v));
  (profile.prompts || []).forEach((item) => addPromptRow(item));
  (profile.sys_prompts || []).forEach((item) => addSysPromptRow(item));
  (profile.interactions || []).forEach((item) => addInteractionRow(item));
  (profile.transitions || []).forEach((item) => addTransitionRow(item));

  if ((profile.more_patterns || []).length === 0) addSimpleListRow("profile-more-list");
  if ((profile.error_patterns || []).length === 0) addSimpleListRow("profile-error-list");
  if ((profile.ignore_errors || []).length === 0) addSimpleListRow("profile-ignore-list");
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
    byId("custom-profile-picker").value = name;
    setStatusMessage("profile-out", `${t("saved")}: ${data.name || name}`, "success");
    await loadProfilesOverview();
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

function issueCount(report) {
  return (
    (report.missing_edge_sources || []).length +
    (report.missing_edge_targets || []).length +
    (report.unreachable_states || []).length +
    (report.dead_end_states || []).length +
    (report.duplicate_prompt_patterns || []).length +
    (report.self_loop_only_states || []).length
  );
}

function renderDiagList(id, values) {
  const ul = byId(id);
  if (!ul) return;
  const list = Array.isArray(values) ? values : [];
  if (list.length === 0) {
    ul.innerHTML = "<li>-</li>";
    return;
  }
  ul.innerHTML = list.map((v) => `<li>${v}</li>`).join("");
}

function renderDiagnoseSummaryPanel(name, report, issues) {
  const healthy = issues === 0;
  const statusText = healthy ? t("diagnoseOk") : t("diagnoseBad");
  const statusCls = healthy
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : "border-rose-200 bg-rose-50 text-rose-700";
  const breakdown = [
    [t("diagUnreachableStates"), (report.unreachable_states || []).length],
    [t("diagDeadEndStates"), (report.dead_end_states || []).length],
    [t("diagMissingEdgeSources"), (report.missing_edge_sources || []).length],
    [t("diagMissingEdgeTargets"), (report.missing_edge_targets || []).length],
    [
      t("diagAmbiguousPromptStates"),
      (report.potentially_ambiguous_prompt_states || []).length,
    ],
  ];
  const hasIssue = breakdown.some(([, count]) => count > 0);
  const breakdownCards = hasIssue
    ? breakdown
        .filter(([, count]) => count > 0)
        .map(
          ([label, count]) => `
            <div class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
              <div class="text-[11px] font-semibold text-amber-700">${escapeHtml(
                label
              )}</div>
              <div class="mt-1 text-base font-semibold text-amber-900">${escapeHtml(
                count
              )}</div>
            </div>
          `
        )
        .join("")
    : `<div class="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">${escapeHtml(
        t("diagSummaryNone")
      )}</div>`;
  return `
    <div class="grid gap-3">
      <div class="grid gap-2 md:grid-cols-3">
        <div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
          <div class="text-xs text-slate-500">${escapeHtml(t("diagSummaryProfile"))}</div>
          <div class="mt-1 text-sm font-semibold text-slate-900">${escapeHtml(name)}</div>
        </div>
        <div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
          <div class="text-xs text-slate-500">${escapeHtml(
            t("diagSummaryIssueCount")
          )}</div>
          <div class="mt-1 text-sm font-semibold text-slate-900">${escapeHtml(issues)}</div>
        </div>
        <div class="rounded-xl border px-3 py-2 ${statusCls}">
          <div class="text-xs">${escapeHtml(t("diagSummaryHealth"))}</div>
          <div class="mt-1 text-sm font-semibold">${escapeHtml(statusText)}</div>
        </div>
      </div>
      <section class="rounded-xl border border-slate-200 bg-white px-3 py-3">
        <div class="text-xs font-semibold text-slate-500">${escapeHtml(
          t("diagSummaryBreakdown")
        )}</div>
        <div class="mt-2 grid gap-2 md:grid-cols-2 lg:grid-cols-3">
          ${breakdownCards}
        </div>
      </section>
    </div>
  `;
}

function resetDiagnoseView() {
  lastDiagnoseSnapshot = null;
  byId("profile-diagnose-badge").textContent = "-";
  byId("profile-diagnose-badge").className = "diag-badge";
  byId("diag-total-states").textContent = "-";
  byId("diag-graph-states").textContent = "-";
  byId("diag-entry-states").textContent = "-";
  byId("diag-issues-count").textContent = "-";
  [
    "diag-unreachable-states",
    "diag-dead-end-states",
    "diag-missing-sources",
    "diag-missing-targets",
    "diag-ambiguous-states",
  ].forEach((id) => renderDiagList(id, []));
  setStatusMessage("profile-diagnose-out", "-", "info");
}

function renderDiagnoseResult(name, report) {
  lastDiagnoseSnapshot = {
    name,
    report: report || {},
  };
  const issues = issueCount(report);
  const healthy = issues === 0;
  const badge = byId("profile-diagnose-badge");
  badge.className = `diag-badge ${healthy ? "ok" : "bad"}`;
  badge.textContent = `${healthy ? t("diagnoseOk") : t("diagnoseBad")} · ${name}`;

  byId("diag-total-states").textContent = String(report.total_states ?? 0);
  byId("diag-graph-states").textContent = String((report.graph_states || []).length);
  byId("diag-entry-states").textContent = String((report.entry_states || []).length);
  byId("diag-issues-count").textContent = String(issues);

  renderDiagList("diag-unreachable-states", report.unreachable_states || []);
  renderDiagList("diag-dead-end-states", report.dead_end_states || []);
  renderDiagList("diag-missing-sources", report.missing_edge_sources || []);
  renderDiagList("diag-missing-targets", report.missing_edge_targets || []);
  renderDiagList(
    "diag-ambiguous-states",
    report.potentially_ambiguous_prompt_states || []
  );

  byId("profile-diagnose-out").innerHTML = renderDiagnoseSummaryPanel(
    name,
    report,
    issues
  );
}

async function diagnoseCustomProfile() {
  const name = byId("profile-diagnose-picker").value.trim();
  if (!name) {
    setStatusMessage("profile-diagnose-out", t("profileNameRequired"), "error");
    return;
  }
  resetDiagnoseView();
  setStatusMessage("profile-diagnose-out", t("running"), "running");
  try {
    const data = await request("POST", "/api/device-profiles/diagnose", {
      name,
    });
    const report = data.diagnostics || {};
    renderDiagnoseResult(data.name || name, report);
  } catch (e) {
    resetDiagnoseView();
    setStatusMessage("profile-diagnose-out", e.message, "error");
  }
}
