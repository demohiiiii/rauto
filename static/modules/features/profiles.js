/**
 * profiles.js — profiles
 */

async function fetchProfileModes(profileName) {
  const normalized = (profileName || "").trim() || "autodetect";
  if (cachedProfileModes.has(normalized)) {
    return cachedProfileModes.get(normalized);
  }
  try {
    const data = await request(
      "GET",
      `/api/device-profiles/${encodeURIComponent(normalized)}/modes`,
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
  const finalModes =
    normalizedModes.length > 0 ? normalizedModes : [defaultMode || "Enable"];
  const selected =
    (preferredMode || "").trim() &&
      finalModes.includes((preferredMode || "").trim())
      ? (preferredMode || "").trim()
      : defaultMode || finalModes[0] || "Enable";
  select.innerHTML = finalModes
    .map(
      (mode) =>
        `<option value="${escapeHtml(mode)}">${escapeHtml(mode)}</option>`,
    )
    .join("");
  select.value = finalModes.includes(selected) ? selected : finalModes[0];
}

function safeSelectValue(selectId) {
  const el = byId(selectId);
  return el ? String(el.value || "").trim() : "";
}

async function refreshExecutionModeOptions(overrides = {}) {
  const profileName = safeSelectValue("device_profile") || "autodetect";
  const data = await fetchProfileModes(profileName);
  applyModeOptions(
    "mode",
    data.modes,
    overrides.execMode ?? safeSelectValue("mode"),
    data.default_mode,
  );
  applyModeOptions(
    "template-mode",
    data.modes,
    overrides.templateMode ?? safeSelectValue("template-mode"),
    data.default_mode,
  );
  applyModeOptions(
    "tx-mode",
    data.modes,
    overrides.txMode ?? safeSelectValue("tx-mode"),
    data.default_mode,
  );
  applyModeOptions(
    "tx-flow-mode",
    data.modes,
    overrides.txFlowMode ?? safeSelectValue("tx-flow-mode"),
    data.default_mode,
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
      "autodetect",
      ...(data.builtins || []).map((item) => item.name),
      ...(data.custom || []).map((item) => item.name),
    ].filter((name, idx, arr) => !!name && arr.indexOf(name) === idx);

    const lines = data.builtins.map((item) => {
      const aliases =
        item.aliases.length > 0 ? ` (aliases: ${item.aliases.join(",")})` : "";
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
      },
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
  populateSelectOptions("profile-diagnose-picker", cachedDeviceProfiles.filter((name) => name !== "autodetect"), {
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
      `/api/device-profiles/builtin/${encodeURIComponent(name)}`,
    );
    const profile = await request(
      "GET",
      `/api/device-profiles/builtin/${encodeURIComponent(name)}/form`,
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
    hooks: {},
    detect_profile: null,
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
  byId("builtin-command-execution-marker").hidden =
    mode !== "shell_exit_status";
}

function setBuiltinForm(profile) {
  const commandExecution = normalizeCommandExecutionConfig(
    profile.command_execution,
  );
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
  clearContainer("builtin-hooks-list");
  clearContainer("builtin-detect-profile-list");

  (profile.more_patterns || []).forEach((v) =>
    addReadonlySimpleListRow("builtin-more-list", v),
  );
  (profile.error_patterns || []).forEach((v) =>
    addReadonlySimpleListRow("builtin-error-list", v),
  );
  (profile.ignore_errors || []).forEach((v) =>
    addReadonlySimpleListRow("builtin-ignore-list", v),
  );
  (profile.prompts || []).forEach((item) =>
    addReadonlyPromptRow("builtin-prompts-list", item),
  );
  (profile.sys_prompts || []).forEach((item) =>
    addReadonlySysPromptRow("builtin-sys-prompts-list", item),
  );
  (profile.prompt_prefix || []).forEach((v) =>
    addReadonlySimpleListRow("builtin-prompt-prefix-list", v),
  );
  (profile.interactions || []).forEach((item) =>
    addReadonlyInteractionRow("builtin-interactions-list", item),
  );
  (profile.transitions || []).forEach((item) =>
    addReadonlyTransitionRow("builtin-transitions-list", item),
  );
  renderReadonlyDetectProfile("builtin-detect-profile-list", profile.detect_profile);
  renderReadonlyHooks("builtin-hooks-list", profile.hooks);
}

function addReadonlyDetectRuleRow(container, item = {}) {
  const row = document.createElement("div");
  row.className = "field-card grid gap-2 md:grid-cols-[1fr_120px]";
  row.innerHTML = `
    <input class="input js-pattern" readonly />
    <input class="input js-weight" readonly />
  `;
  row.querySelector(".js-pattern").value = item.pattern || "";
  row.querySelector(".js-weight").value =
    item.weight == null ? "50" : String(item.weight);
  container.appendChild(row);
}

function renderReadonlyDetectRules(container, rules = []) {
  const normalized = Array.isArray(rules) ? rules : [];
  if (normalized.length === 0) {
    const empty = document.createElement("div");
    empty.className = "text-xs text-slate-500";
    empty.textContent = t("detectRulesEmpty");
    container.appendChild(empty);
    return;
  }
  normalized.forEach((rule) => addReadonlyDetectRuleRow(container, rule));
}

function renderReadonlyDetectProfile(containerId, detectProfile) {
  const container = byId(containerId);
  container.innerHTML = "";
  if (!detectProfile) {
    const empty = document.createElement("div");
    empty.className = "text-xs text-slate-500";
    empty.textContent = t("detectProfileEmpty");
    container.appendChild(empty);
    return;
  }

  const initial = document.createElement("div");
  initial.className = "grid gap-2";
  initial.innerHTML = `<span class="text-xs font-semibold text-slate-600">${escapeHtml(t("detectInitialRulesLabel"))}</span><div class="grid gap-2 js-readonly-detect-initial"></div>`;
  container.appendChild(initial);
  renderReadonlyDetectRules(
    initial.querySelector(".js-readonly-detect-initial"),
    detectProfile.initial_rules,
  );

  const probesWrap = document.createElement("div");
  probesWrap.className = "grid gap-2";
  probesWrap.innerHTML = `<span class="text-xs font-semibold text-slate-600">${escapeHtml(t("detectProbesLabel"))}</span><div class="grid gap-2 js-readonly-detect-probes"></div>`;
  container.appendChild(probesWrap);
  const probesContainer = probesWrap.querySelector(".js-readonly-detect-probes");
  const probes = Array.isArray(detectProfile.probes) ? detectProfile.probes : [];
  if (probes.length === 0) {
    const empty = document.createElement("div");
    empty.className = "text-xs text-slate-500";
    empty.textContent = t("detectProbesEmpty");
    probesContainer.appendChild(empty);
    return;
  }
  probes.forEach((probe) => {
    const row = document.createElement("div");
    row.className = "field-card grid gap-3";
    row.innerHTML = `
      <input class="input js-command" readonly />
      <div class="grid gap-2">
        <span class="text-xs font-semibold text-slate-600">${escapeHtml(t("detectRulesLabel"))}</span>
        <div class="grid gap-2 js-probe-rules"></div>
      </div>
      <div class="grid gap-2">
        <span class="text-xs font-semibold text-slate-600">${escapeHtml(t("detectErrorPatternsLabel"))}</span>
        <div class="grid gap-2 js-probe-errors"></div>
      </div>
    `;
    row.querySelector(".js-command").value = probe.command || "";
    renderReadonlyDetectRules(row.querySelector(".js-probe-rules"), probe.rules);
    const errors = Array.isArray(probe.error_patterns) ? probe.error_patterns : [];
    if (errors.length === 0) {
      const empty = document.createElement("div");
      empty.className = "text-xs text-slate-500";
      empty.textContent = t("detectErrorPatternsEmpty");
      row.querySelector(".js-probe-errors").appendChild(empty);
    } else {
      errors.forEach((pattern) =>
        addReadonlyPatternRow(row.querySelector(".js-probe-errors"), pattern),
      );
    }
    probesContainer.appendChild(row);
  });
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

function updateProfileDetectVisibility() {
  const enabled = byId("profile-detect-enabled").checked;
  const body = byId("profile-detect-body");
  body.hidden = !enabled;
  body.querySelectorAll("input, button").forEach((el) => {
    el.disabled = !enabled;
  });
  if (enabled) {
    if (byId("detect-initial-rules-list").children.length === 0) {
      addDetectRuleRow(byId("detect-initial-rules-list"));
    }
    if (byId("detect-probes-list").children.length === 0) {
      addDetectProbeRow();
    }
  }
}

function addDetectRuleRow(container, item = { pattern: "", weight: 50 }) {
  const row = document.createElement("div");
  row.className = "field-card grid gap-2 md:grid-cols-[1fr_120px_auto]";
  row.innerHTML = `
    <input class="input js-pattern" placeholder="${escapeHtml(t("fieldPattern"))}" />
    <input class="input js-weight" type="number" min="0" step="1" placeholder="${escapeHtml(t("fieldWeight"))}" />
    <div class="flex items-start justify-end">
      <button type="button" class="mini-btn delete js-delete-row"></button>
    </div>
  `;
  row.querySelector(".js-pattern").value = item.pattern || "";
  row.querySelector(".js-weight").value = item.weight == null ? "50" : String(item.weight);
  row.querySelector(".js-delete-row").textContent = t("deleteInlineBtn");
  row.querySelector(".js-delete-row").onclick = () => row.remove();
  container.appendChild(row);
}

function collectDetectRuleRows(container) {
  return Array.from(container.children)
    .map((row) => {
      const pattern = row.querySelector(".js-pattern").value.trim();
      const rawWeight = row.querySelector(".js-weight").value.trim();
      const weight = rawWeight ? Number(rawWeight) : 50;
      if (!pattern) return null;
      if (!Number.isFinite(weight) || weight < 0 || !Number.isInteger(weight)) {
        throw new Error(t("detectWeightInvalid"));
      }
      return { pattern, weight };
    })
    .filter(Boolean);
}

function addDetectProbeRow(
  item = { command: "", rules: [], error_patterns: [] },
) {
  const container = byId("detect-probes-list");
  const row = document.createElement("div");
  row.className = "field-card grid gap-3";
  row.innerHTML = `
    <div class="grid gap-2 md:grid-cols-[1fr_auto]">
      <input class="input js-command" placeholder="${escapeHtml(t("fieldCommand"))}" />
      <div class="flex items-start justify-end">
        <button type="button" class="mini-btn delete js-delete-row"></button>
      </div>
    </div>
    <div class="grid gap-2">
      <div class="flex items-center justify-between">
        <span class="text-xs font-semibold text-slate-600">${escapeHtml(t("detectRulesLabel"))}</span>
        <button type="button" class="mini-btn add js-add-rule"></button>
      </div>
      <div class="js-detect-probe-rules grid gap-2"></div>
    </div>
    <div class="grid gap-2">
      <div class="flex items-center justify-between">
        <span class="text-xs font-semibold text-slate-600">${escapeHtml(t("detectErrorPatternsLabel"))}</span>
        <button type="button" class="mini-btn add js-add-error-pattern"></button>
      </div>
      <div class="js-detect-error-patterns grid gap-2"></div>
    </div>
  `;
  row.querySelector(".js-command").value = item.command || "";
  row.querySelector(".js-delete-row").textContent = t("deleteInlineBtn");
  row.querySelector(".js-add-rule").textContent = t("addInlineBtn");
  row.querySelector(".js-add-error-pattern").textContent = t("addInlineBtn");
  row.querySelector(".js-delete-row").onclick = () => row.remove();
  row.querySelector(".js-add-rule").onclick = () =>
    addDetectRuleRow(row.querySelector(".js-detect-probe-rules"));
  row.querySelector(".js-add-error-pattern").onclick = () =>
    addPatternRow(row.querySelector(".js-detect-error-patterns"));
  const rules = Array.isArray(item.rules) ? item.rules : [];
  if (rules.length === 0) {
    addDetectRuleRow(row.querySelector(".js-detect-probe-rules"));
  } else {
    rules.forEach((rule) =>
      addDetectRuleRow(row.querySelector(".js-detect-probe-rules"), rule),
    );
  }
  (Array.isArray(item.error_patterns) ? item.error_patterns : []).forEach(
    (pattern) => addPatternRow(row.querySelector(".js-detect-error-patterns"), pattern),
  );
  container.appendChild(row);
}

function setDetectProfileForm(detectProfile) {
  clearContainer("detect-initial-rules-list");
  clearContainer("detect-probes-list");
  byId("profile-detect-enabled").checked = !!detectProfile;
  if (detectProfile) {
    (detectProfile.initial_rules || []).forEach((rule) =>
      addDetectRuleRow(byId("detect-initial-rules-list"), rule),
    );
    (detectProfile.probes || []).forEach((probe) => addDetectProbeRow(probe));
  }
  updateProfileDetectVisibility();
}

function collectDetectProfileForm() {
  if (!byId("profile-detect-enabled").checked) {
    return null;
  }
  const initialRules = collectDetectRuleRows(byId("detect-initial-rules-list"));
  const probes = Array.from(byId("detect-probes-list").children)
    .map((row) => {
      const command = row.querySelector(".js-command").value.trim();
      const rules = collectDetectRuleRows(row.querySelector(".js-detect-probe-rules"));
      const errorPatterns = collectPatternRows(row.querySelector(".js-detect-error-patterns"));
      if (!command && rules.length === 0 && errorPatterns.length === 0) return null;
      if (!command) {
        throw new Error(t("detectProbeCommandRequired"));
      }
      return {
        command,
        rules,
        error_patterns: errorPatterns,
      };
    })
    .filter(Boolean);
  return {
    initial_rules: initialRules,
    probes,
  };
}

function defaultHookOperation() {
  return {
    kind: "command",
    mode: "Enable",
    command: "terminal length 0",
    timeout: 60,
  };
}

function normalizeHooks(hooks) {
  return {
    after_connect: Array.isArray(hooks?.after_connect)
      ? hooks.after_connect
      : [],
    before_disconnect: Array.isArray(hooks?.before_disconnect)
      ? hooks.before_disconnect
      : [],
    after_enter_state:
      hooks?.after_enter_state && typeof hooks.after_enter_state === "object"
        ? hooks.after_enter_state
        : {},
    before_exit_state:
      hooks?.before_exit_state && typeof hooks.before_exit_state === "object"
        ? hooks.before_exit_state
        : {},
  };
}

function profilePromptModes() {
  const list = byId("prompts-list");
  if (!list) return ["Enable"];
  const modes = Array.from(list.querySelectorAll(".js-state"))
    .map((input) => input.value.trim())
    .filter(Boolean);
  return modes.filter((mode, idx, arr) => arr.indexOf(mode) === idx);
}

function applyHookModeOptions(select, preferredMode) {
  if (!select) return;
  const modes = profilePromptModes();
  const current = (preferredMode || select.value || "").trim();
  const finalModes = modes.length > 0 ? modes : [current || "Enable"];
  if (current && !finalModes.includes(current)) {
    finalModes.push(current);
  }
  select.innerHTML = finalModes
    .map((mode) => `<option value="${escapeHtml(mode)}">${escapeHtml(mode)}</option>`)
    .join("");
  select.value = finalModes.includes(current) ? current : finalModes[0] || "";
}

function updateHookModeOptions() {
  document
    .querySelectorAll(".js-hook-mode, .js-hook-flow-mode, .js-hook-state")
    .forEach((select) => applyHookModeOptions(select, select.value));
}

function normalizeHookCommand(operation) {
  if (!operation || typeof operation !== "object") {
    return defaultHookOperation();
  }
  return {
    kind: "command",
    mode: operation.mode || "Enable",
    command: operation.command || "",
    timeout: operation.timeout == null ? 60 : operation.timeout,
  };
}

function normalizeHookFlow(operation) {
  const flow = operation && operation.kind === "flow" ? operation : {};
  const steps = Array.isArray(flow.steps) ? flow.steps : [];
  return {
    kind: "flow",
    steps: steps.length > 0 ? steps : [defaultHookOperation()],
    stop_on_error: flow.stop_on_error === undefined ? true : !!flow.stop_on_error,
    max_steps: flow.max_steps == null ? "" : flow.max_steps,
  };
}

function hookOperationLabel(operation) {
  if (!operation || typeof operation !== "object") return "";
  if (typeof txOperationDescription === "function") {
    return txOperationDescription(operation);
  }
  return operation.command || operation.kind || "";
}

function hookOperationKindLabel(operation) {
  if (!operation || typeof operation !== "object") return "command";
  if (operation.kind === "flow") return "flow";
  if (operation.kind === "command" || operation.command != null) return "command";
  return operation.kind || "unsupported";
}

function setHookOperationPanels(row) {
  const kind = row.querySelector(".js-hook-operation-kind").value;
  row.querySelector(".js-hook-command-panel").hidden = kind !== "command";
  row.querySelector(".js-hook-flow-panel").hidden = kind !== "flow";
  row.querySelector(".js-hook-unsupported-panel").hidden = kind !== "unsupported";
}

function addHookFlowStep(container, command = {}) {
  const step = normalizeHookCommand(command);
  const row = document.createElement("div");
  row.className = "grid gap-2 md:grid-cols-[160px_1fr_120px_auto]";
  row.innerHTML = `
    <select class="select js-hook-flow-mode"></select>
    <textarea class="input min-h-16 font-mono js-hook-flow-command" placeholder="${escapeHtml(t("fieldHookCommand"))}"></textarea>
    <input class="input js-hook-flow-timeout" type="number" min="1" step="1" placeholder="${escapeHtml(t("fieldHookTimeout"))}" />
    <div class="flex items-start justify-end">
      <button type="button" class="mini-btn delete js-delete-row"></button>
    </div>
  `;
  applyHookModeOptions(row.querySelector(".js-hook-flow-mode"), step.mode);
  row.querySelector(".js-hook-flow-command").value = step.command || "";
  row.querySelector(".js-hook-flow-timeout").value =
    step.timeout == null ? "" : String(step.timeout);
  row.querySelector(".js-delete-row").textContent = t("deleteInlineBtn");
  row.querySelector(".js-delete-row").onclick = () => row.remove();
  container.appendChild(row);
}

function collectHookCommandFields(row, triggerName, name, selectors) {
  const command = row.querySelector(selectors.command).value.trim();
  const mode = row.querySelector(selectors.mode).value.trim();
  const timeoutRaw = row.querySelector(selectors.timeout).value.trim();
  if (!command) {
    throw new Error(`${t("hookCommandRequired")}: ${triggerName}/${name}`);
  }
  const operation = {
    mode: mode || "Enable",
    command,
  };
  if (timeoutRaw) {
    const timeout = Number(timeoutRaw);
    if (!Number.isFinite(timeout) || timeout <= 0) {
      throw new Error(`${t("hookTimeoutInvalid")}: ${triggerName}/${name}`);
    }
    operation.timeout = timeout;
  }
  return operation;
}

function setHookOperationFields(row, operation) {
  const kindSelect = row.querySelector(".js-hook-operation-kind");
  row.querySelector(".js-hook-flow-steps").innerHTML = "";
  if (!operation || operation.kind === "command" || operation.command != null) {
    const normalized = normalizeHookCommand(operation);
    row.dataset.unsupportedOperation = "";
    row.dataset.unsupportedOperationLabel = "";
    kindSelect.value = "command";
    applyHookModeOptions(row.querySelector(".js-hook-mode"), normalized.mode);
    row.querySelector(".js-hook-command").value = normalized.command || "";
    row.querySelector(".js-hook-timeout").value =
      normalized.timeout == null ? "" : String(normalized.timeout);
    setHookOperationPanels(row);
    return;
  }
  if (operation.kind === "flow") {
    const flow = normalizeHookFlow(operation);
    row.dataset.unsupportedOperation = "";
    row.dataset.unsupportedOperationLabel = "";
    kindSelect.value = "flow";
    row.querySelector(".js-hook-flow-stop-on-error").checked = flow.stop_on_error;
    row.querySelector(".js-hook-flow-max-steps").value =
      flow.max_steps == null ? "" : String(flow.max_steps);
    flow.steps.forEach((step) => addHookFlowStep(row.querySelector(".js-hook-flow-steps"), step));
    setHookOperationPanels(row);
    return;
  }
  const label = hookOperationLabel(operation);
  row.dataset.unsupportedOperation = JSON.stringify(operation);
  row.dataset.unsupportedOperationLabel = label;
  kindSelect.value = "unsupported";
  row.querySelector(".js-hook-unsupported-operation").value =
    JSON.stringify(operation, null, 2);
  setHookOperationPanels(row);
}

function hookRowHasOperationInput(row) {
  const kind = row.querySelector(".js-hook-operation-kind")?.value || "command";
  if (kind === "unsupported") {
    return !!(row.dataset.unsupportedOperation || "").trim();
  }
  if (kind === "flow") {
    return Array.from(row.querySelectorAll(".js-hook-flow-command")).some(
      (input) => input.value.trim(),
    );
  }
  return !!row.querySelector(".js-hook-command").value.trim();
}

function collectHookOperation(row, triggerName, name) {
  const unsupported = (row.dataset.unsupportedOperation || "").trim();
  const kind = row.querySelector(".js-hook-operation-kind").value;
  if (kind === "unsupported" && unsupported) {
    return JSON.parse(unsupported);
  }
  if (kind === "flow") {
    const steps = Array.from(row.querySelector(".js-hook-flow-steps").children).map(
      (step, idx) =>
        collectHookCommandFields(step, triggerName, `${name}[${idx + 1}]`, {
          mode: ".js-hook-flow-mode",
          command: ".js-hook-flow-command",
          timeout: ".js-hook-flow-timeout",
        }),
    );
    if (steps.length === 0) {
      throw new Error(`${t("hookFlowStepRequired")}: ${triggerName}/${name}`);
    }
    const flow = {
      kind: "flow",
      steps,
      stop_on_error: row.querySelector(".js-hook-flow-stop-on-error").checked,
    };
    const maxStepsRaw = row.querySelector(".js-hook-flow-max-steps").value.trim();
    if (maxStepsRaw) {
      const maxSteps = Number(maxStepsRaw);
      if (!Number.isFinite(maxSteps) || maxSteps <= 0) {
        throw new Error(`${t("hookMaxStepsInvalid")}: ${triggerName}/${name}`);
      }
      flow.max_steps = maxSteps;
    }
    return flow;
  }
  return {
    kind: "command",
    ...collectHookCommandFields(row, triggerName, name, {
      mode: ".js-hook-mode",
      command: ".js-hook-command",
      timeout: ".js-hook-timeout",
    }),
  };
}

function addHookRow(containerId, item = {}, state = "") {
  const container = byId(containerId);
  const withState = containerId.includes("-state-");
  const row = document.createElement("div");
  row.className = "field-card grid gap-2";
  row.innerHTML = `
    <div class="grid gap-2 md:grid-cols-4">
      ${withState
      ? `<select class="select js-hook-state" title="${escapeHtml(t("fieldHookState"))}" aria-label="${escapeHtml(t("fieldHookState"))}"></select>`
      : ""
    }
      <input class="input js-hook-name" placeholder="${escapeHtml(t("fieldHookName"))}" />
      <select class="select js-hook-failure-policy">
        <option value="best_effort">${escapeHtml(t("hookFailureBestEffort"))}</option>
        <option value="required">${escapeHtml(t("hookFailureRequired"))}</option>
      </select>
      <div class="flex items-start justify-end">
        <button type="button" class="mini-btn delete js-delete-row"></button>
      </div>
    </div>
    <label class="check-label">
      <input type="checkbox" class="check-input js-hook-record-output" />
      <span>${escapeHtml(t("fieldHookRecordOutput"))}</span>
    </label>
    <select class="select js-hook-operation-kind">
      <option value="command">${escapeHtml(t("hookOperationKindCommand"))}</option>
      <option value="flow">${escapeHtml(t("hookOperationKindFlow"))}</option>
      <option value="unsupported">${escapeHtml(t("hookOperationKindUnsupported"))}</option>
    </select>
    <div class="grid gap-2 md:grid-cols-[160px_1fr_120px] js-hook-command-panel">
      <select class="select js-hook-mode"></select>
      <textarea class="input min-h-20 font-mono js-hook-command" placeholder="${escapeHtml(t("fieldHookCommand"))}"></textarea>
      <input class="input js-hook-timeout" type="number" min="1" step="1" placeholder="${escapeHtml(t("fieldHookTimeout"))}" />
    </div>
    <div class="grid gap-2 js-hook-flow-panel" hidden>
      <div class="grid gap-2 md:grid-cols-[auto_auto_1fr] md:items-center">
        <label class="check-label">
          <input type="checkbox" class="check-input js-hook-flow-stop-on-error" checked />
          <span>${escapeHtml(t("fieldHookStopOnError"))}</span>
        </label>
        <input class="input js-hook-flow-max-steps" type="number" min="1" step="1" placeholder="${escapeHtml(t("fieldHookMaxSteps"))}" />
        <div class="flex justify-end">
          <button type="button" class="mini-btn add js-add-hook-flow-step"></button>
        </div>
      </div>
      <div class="grid gap-2 js-hook-flow-steps"></div>
    </div>
    <div class="grid gap-2 js-hook-unsupported-panel" hidden>
      <div class="text-xs text-slate-500">${escapeHtml(t("hookUnsupportedOperationHint"))}</div>
      <textarea class="input min-h-24 font-mono js-hook-unsupported-operation" readonly></textarea>
    </div>
  `;
  if (withState) {
    applyHookModeOptions(row.querySelector(".js-hook-state"), state || "");
  }
  row.querySelector(".js-hook-name").value = item.name || "";
  row.querySelector(".js-hook-failure-policy").value =
    item.failure_policy || "best_effort";
  row.querySelector(".js-hook-record-output").checked = !!item.record_output;
  setHookOperationFields(row, item.operation);
  row.querySelector(".js-delete-row").textContent = t("deleteInlineBtn");
  row.querySelector(".js-delete-row").onclick = () => row.remove();
  row.querySelector(".js-add-hook-flow-step").textContent = t("addInlineBtn");
  row.querySelector(".js-add-hook-flow-step").onclick = () => {
    addHookFlowStep(row.querySelector(".js-hook-flow-steps"), defaultHookOperation());
  };
  row.querySelector(".js-hook-operation-kind").onchange = () => {
    if (row.querySelector(".js-hook-operation-kind").value === "flow") {
      const steps = row.querySelector(".js-hook-flow-steps");
      if (steps.children.length === 0) {
        addHookFlowStep(steps, defaultHookOperation());
      }
    }
    setHookOperationPanels(row);
  };
  row.querySelector(".js-hook-command").addEventListener("input", () => {
    row.dataset.unsupportedOperation = "";
  });
  container.appendChild(row);
}

function collectHookRows(containerId, triggerName) {
  return Array.from(byId(containerId).children)
    .map((row) => {
      const name = row.querySelector(".js-hook-name").value.trim();
      if (!name && !hookRowHasOperationInput(row)) {
        return null;
      }
      if (!name) {
        throw new Error(t("hookNameRequired"));
      }
      const operation = collectHookOperation(row, triggerName, name);
      return {
        name,
        operation,
        failure_policy:
          row.querySelector(".js-hook-failure-policy").value || "best_effort",
        record_output: row.querySelector(".js-hook-record-output").checked,
      };
    })
    .filter(Boolean);
}

function collectStateHookRows(containerId, triggerName) {
  const grouped = {};
  Array.from(byId(containerId).children).forEach((row) => {
    const state = row.querySelector(".js-hook-state").value.trim();
    const name = row.querySelector(".js-hook-name").value.trim();
    if (!state && !name && !hookRowHasOperationInput(row)) {
      return;
    }
    if (!state) {
      throw new Error(t("hookStateRequired"));
    }
    if (!name) {
      throw new Error(t("hookNameRequired"));
    }
    const operation = collectHookOperation(row, `${triggerName}/${state}`, name);
    if (!grouped[state]) {
      grouped[state] = [];
    }
    grouped[state].push({
      name,
      operation,
      failure_policy:
        row.querySelector(".js-hook-failure-policy").value || "best_effort",
      record_output: row.querySelector(".js-hook-record-output").checked,
    });
  });
  return grouped;
}

function addReadonlyHookRow(container, trigger, item = {}, state = "") {
  const row = document.createElement("div");
  row.className = "field-card grid gap-2";
  const operation = item.operation || defaultHookOperation();
  row.innerHTML = `
    <div class="grid gap-2 md:grid-cols-4">
      <input class="input js-hook-trigger" readonly />
      <input class="input js-hook-state" readonly />
      <input class="input js-hook-name" readonly />
      <input class="input js-hook-failure-policy" readonly />
    </div>
    <label class="check-label">
      <input type="checkbox" class="check-input js-hook-record-output" disabled />
      <span>${escapeHtml(t("fieldHookRecordOutput"))}</span>
    </label>
    <input class="input js-hook-kind" readonly />
    ${operation.kind === "flow"
      ? `<div class="grid gap-2 js-hook-flow-readonly"></div>`
      : `<div class="grid gap-2 md:grid-cols-[160px_1fr_120px]">
             <input class="input js-hook-mode" readonly />
             <textarea class="input min-h-20 font-mono js-hook-command" readonly></textarea>
             <input class="input js-hook-timeout" readonly />
           </div>`
    }
  `;
  row.querySelector(".js-hook-trigger").value = trigger;
  row.querySelector(".js-hook-state").value = state || "-";
  row.querySelector(".js-hook-name").value = item.name || "";
  row.querySelector(".js-hook-failure-policy").value =
    item.failure_policy || "best_effort";
  row.querySelector(".js-hook-record-output").checked = !!item.record_output;
  row.querySelector(".js-hook-kind").value = hookOperationKindLabel(operation);
  if (operation.kind === "flow") {
    const flow = normalizeHookFlow(operation);
    flow.steps.forEach((step, idx) => {
      const normalizedStep = normalizeHookCommand(step);
      const stepRow = document.createElement("div");
      stepRow.className = "grid gap-2 md:grid-cols-[80px_160px_1fr_120px]";
      stepRow.innerHTML = `
        <input class="input js-step-index" readonly />
        <input class="input js-hook-mode" readonly />
        <textarea class="input min-h-16 font-mono js-hook-command" readonly></textarea>
        <input class="input js-hook-timeout" readonly />
      `;
      stepRow.querySelector(".js-step-index").value = `#${idx + 1}`;
      stepRow.querySelector(".js-hook-mode").value = normalizedStep.mode || "";
      stepRow.querySelector(".js-hook-command").value = normalizedStep.command || "";
      stepRow.querySelector(".js-hook-timeout").value =
        normalizedStep.timeout == null ? "" : String(normalizedStep.timeout);
      row.querySelector(".js-hook-flow-readonly").appendChild(stepRow);
    });
  } else {
    const command = normalizeHookCommand(operation);
    row.querySelector(".js-hook-mode").value = command.mode || "";
    row.querySelector(".js-hook-command").value =
      command.command || hookOperationLabel(operation);
    row.querySelector(".js-hook-timeout").value =
      command.timeout == null ? "" : String(command.timeout);
  }
  container.appendChild(row);
}

function renderReadonlyHooks(containerId, hooks) {
  const container = byId(containerId);
  container.innerHTML = "";
  const normalized = normalizeHooks(hooks);
  normalized.after_connect.forEach((item) =>
    addReadonlyHookRow(container, "after_connect", item),
  );
  normalized.before_disconnect.forEach((item) =>
    addReadonlyHookRow(container, "before_disconnect", item),
  );
  Object.entries(normalized.after_enter_state).forEach(([state, actions]) => {
    (Array.isArray(actions) ? actions : []).forEach((item) =>
      addReadonlyHookRow(container, "after_enter_state", item, state),
    );
  });
  Object.entries(normalized.before_exit_state).forEach(([state, actions]) => {
    (Array.isArray(actions) ? actions : []).forEach((item) =>
      addReadonlyHookRow(container, "before_exit_state", item, state),
    );
  });
  if (container.children.length === 0) {
    const row = document.createElement("div");
    row.className = "field-card text-xs text-slate-500";
    row.textContent = "-";
    container.appendChild(row);
  }
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
  row.querySelector(".js-delete-row").onclick = () => {
    row.remove();
    updateHookModeOptions();
  };
  row.querySelector(".js-state").addEventListener("input", updateHookModeOptions);
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
    addReadonlyPatternRow(patternList, pattern),
  );
  container.appendChild(row);
}

function collectPromptRows() {
  return Array.from(byId("prompts-list").children)
    .map((row) => ({
      state: row.querySelector(".js-state").value.trim(),
      patterns: collectPatternRows(row.querySelector(".js-pattern-list")),
    }))
    .filter((item) => item.state || item.patterns.length > 0);
}

function addSysPromptRow(
  item = { state: "", sys_name_group: "", pattern: "" },
) {
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
  item = { state: "", sys_name_group: "", pattern: "" },
) {
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
  return Array.from(byId("sys-prompts-list").children)
    .map((row) => ({
      state: row.querySelector(".js-state").value.trim(),
      sys_name_group: row.querySelector(".js-group").value.trim(),
      pattern: row.querySelector(".js-pattern").value.trim(),
    }))
    .filter((item) => item.state || item.sys_name_group || item.pattern);
}

function addInteractionRow(
  item = {
    state: "",
    input: "",
    is_dynamic: false,
    record_input: true,
    patterns: [],
  },
) {
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
  item = {
    state: "",
    input: "",
    is_dynamic: false,
    record_input: true,
    patterns: [],
  },
) {
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
    addReadonlyPatternRow(patternList, pattern),
  );
  container.appendChild(row);
}

function collectInteractionRows() {
  return Array.from(byId("interactions-list").children)
    .map((row) => ({
      state: row.querySelector(".js-state").value.trim(),
      input: row.querySelector(".js-input").value.trim(),
      is_dynamic: row.querySelector(".js-is-dynamic").checked,
      record_input: row.querySelector(".js-record-input").checked,
      patterns: collectPatternRows(row.querySelector(".js-pattern-list")),
    }))
    .filter((item) => item.state || item.input || item.patterns.length > 0);
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

function addTransitionRow(
  item = { from: "", command: "", to: "", is_exit: false, format_sys: false },
) {
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
  item = { from: "", command: "", to: "", is_exit: false, format_sys: false },
) {
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
  return Array.from(byId("transitions-list").children)
    .map((row) => ({
      from: row.querySelector(".js-from").value.trim(),
      command: row.querySelector(".js-command").value.trim(),
      to: row.querySelector(".js-to").value.trim(),
      is_exit: row.querySelector(".js-is-exit").checked,
      format_sys: row.querySelector(".js-format-sys").checked,
    }))
    .filter((item) => item.from || item.command || item.to);
}

function setProfileForm(profile) {
  byId("custom-profile-picker").value = profile.name || "";
  const commandExecution = normalizeCommandExecutionConfig(
    profile.command_execution,
  );
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
  clearContainer("detect-initial-rules-list");
  clearContainer("detect-probes-list");
  clearContainer("hooks-after-connect-list");
  clearContainer("hooks-before-disconnect-list");
  clearContainer("hooks-after-enter-state-list");
  clearContainer("hooks-before-exit-state-list");
  setDetectProfileForm(profile.detect_profile || null);

  (profile.more_patterns || []).forEach((v) =>
    addSimpleListRow("profile-more-list", v),
  );
  (profile.error_patterns || []).forEach((v) =>
    addSimpleListRow("profile-error-list", v),
  );
  (profile.ignore_errors || []).forEach((v) =>
    addSimpleListRow("profile-ignore-list", v),
  );
  (profile.prompt_prefix || []).forEach((v) =>
    addSimpleListRow("profile-prompt-prefix-list", v),
  );
  (profile.prompts || []).forEach((item) => addPromptRow(item));
  (profile.sys_prompts || []).forEach((item) => addSysPromptRow(item));
  (profile.interactions || []).forEach((item) => addInteractionRow(item));
  (profile.transitions || []).forEach((item) => addTransitionRow(item));
  const hooks = normalizeHooks(profile.hooks);
  hooks.after_connect.forEach((item) => addHookRow("hooks-after-connect-list", item));
  hooks.before_disconnect.forEach((item) =>
    addHookRow("hooks-before-disconnect-list", item)
  );
  Object.entries(hooks.after_enter_state).forEach(([state, actions]) => {
    (Array.isArray(actions) ? actions : []).forEach((item) =>
      addHookRow("hooks-after-enter-state-list", item, state)
    );
  });
  Object.entries(hooks.before_exit_state).forEach(([state, actions]) => {
    (Array.isArray(actions) ? actions : []).forEach((item) =>
      addHookRow("hooks-before-exit-state-list", item, state)
    );
  });

  if ((profile.more_patterns || []).length === 0)
    addSimpleListRow("profile-more-list");
  if ((profile.error_patterns || []).length === 0)
    addSimpleListRow("profile-error-list");
  if ((profile.ignore_errors || []).length === 0)
    addSimpleListRow("profile-ignore-list");
  if ((profile.prompt_prefix || []).length === 0) {
    addSimpleListRow("profile-prompt-prefix-list");
  }
}

function collectProfileForm() {
  const commandExecutionMode =
    byId("profile-command-execution-mode").value || "prompt_driven";
  const detectProfile = collectDetectProfileForm();
  const profile = {
    name: byId("custom-profile-picker").value.trim(),
    command_execution: commandExecutionPayload(
      commandExecutionMode,
      byId("profile-command-execution-marker").value,
    ),
    more_patterns: collectSimpleList("profile-more-list"),
    error_patterns: collectSimpleList("profile-error-list"),
    ignore_errors: collectSimpleList("profile-ignore-list"),
    prompt_prefix: collectSimpleList("profile-prompt-prefix-list"),
    prompts: collectPromptRows(),
    sys_prompts: collectSysPromptRows(),
    interactions: collectInteractionRows(),
    transitions: collectTransitionRows(),
    hooks: {
      after_connect: collectHookRows("hooks-after-connect-list", "after_connect"),
      before_disconnect: collectHookRows("hooks-before-disconnect-list", "before_disconnect"),
      after_enter_state: collectStateHookRows(
        "hooks-after-enter-state-list",
        "after_enter_state"
      ),
      before_exit_state: collectStateHookRows("hooks-before-exit-state-list", "before_exit_state"),
    },
  };
  if (detectProfile) {
    profile.detect_profile = detectProfile;
  }
  return profile;
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
      `/api/device-profiles/custom/${encodeURIComponent(name)}/form`,
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
      profile,
    );
    ensureSelectValue("custom-profile-picker", data.name || name);
    setStatusMessage(
      "profile-out",
      `${t("saved")}: ${data.name || name}`,
      "success",
    );
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
      profile,
    );
    ensureSelectValue("custom-profile-picker", data.name || name);
    setStatusMessage(
      "profile-out",
      `${t("saved")}: ${data.name || name}`,
      "success",
    );
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
    await request(
      "DELETE",
      `/api/device-profiles/custom/${encodeURIComponent(name)}`,
    );
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
      detect_profile: null,
      hooks: {},
    });
    setStatusMessage("profile-out", `${t("deleted")}: ${name}`, "success");
    await loadProfilesOverview();
  } catch (e) {
    setStatusMessage("profile-out", e.message, "error");
  }
}
