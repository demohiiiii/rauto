/**
 * connections.js — connections
 */

function getMultiSelectValuesById(selectId) {
  const select = byId(selectId);
  if (!select) return [];
  return Array.from(select.selectedOptions || [])
    .map((option) => safeString(option.value || "").trim())
    .filter(Boolean);
}

function renderConnectionGroupsForSelect(selectId, selectedValues = []) {
  const select = byId(selectId);
  if (!select) return;
  const selected = new Set((selectedValues || []).filter(Boolean));
  select.innerHTML = (cachedInventoryGroups || [])
    .map((item) => safeString(item.name).trim())
    .filter(Boolean)
    .map((name) => {
      const isSelected = selected.has(name) ? "selected" : "";
      return `<option value="${escapeHtml(name)}" ${isSelected}>${escapeHtml(name)}</option>`;
    })
    .join("");
}

function renderSavedConnectionOptions(selectedName = "") {
  populateSelectOptions(
    "saved-conn-name",
    cachedSavedConnections.map((item) => item.name),
    {
      placeholder: t("savedConnSelectPlaceholder"),
      selected: selectedName,
    },
  );
}

function renderConnectionProfileOptions() {
  const profileValues = (cachedDeviceProfiles || []).filter(Boolean);
  const mainSelected =
    safeString(byId("device_profile")?.value || "").trim() || "linux";
  const editSelected =
    safeString(byId("saved-conn-edit-device-profile")?.value || "").trim() ||
    "linux";
  populateSelectOptions("device_profile", profileValues, {
    placeholder: t("deviceProfilePlaceholder"),
    selected: mainSelected,
  });
  populateSelectOptions("saved-conn-edit-device-profile", profileValues, {
    placeholder: t("deviceProfilePlaceholder"),
    selected: editSelected,
  });
}

function renderSavedConnectionGroupOptions(selectedValues = []) {
  renderConnectionGroupsForSelect("saved-conn-groups", selectedValues);
  renderConnectionGroupsForSelect(
    "saved-conn-edit-groups",
    getMultiSelectValuesById("saved-conn-edit-groups"),
  );
}

async function ensureSavedConnectionDetail(name) {
  const normalized = safeString(name || "").trim();
  if (!normalized) return null;
  if (cachedSavedConnectionDetails.has(normalized)) {
    return cachedSavedConnectionDetails.get(normalized);
  }
  const data = await request(
    "GET",
    `/api/connections/${encodeURIComponent(normalized)}`,
  );
  cachedSavedConnectionDetails.set(normalized, data);
  return data;
}

function currentTemporaryConnectionLabel() {
  if (temporaryConnectionLabel) return temporaryConnectionLabel;
  const host = safeString(byId("host")?.value || "").trim();
  const username = safeString(byId("username")?.value || "").trim();
  if (!host && !username) return t("sidebarConnectionTemporaryLabel");
  if (!username) return `${t("sidebarConnectionTemporaryLabel")} · ${host}`;
  return `${t("sidebarConnectionTemporaryLabel")} · ${username}@${host}`;
}

function currentTemporaryConnectionDetails() {
  if (temporaryConnectionDetails) {
    return {
      ...temporaryConnectionDetails,
      note: t("sidebarConnectionTemporaryHint"),
      kind: "temporary",
    };
  }
  return {
    name: currentTemporaryConnectionLabel(),
    host: safeString(byId("host")?.value || "").trim() || "-",
    port: Number(byId("port")?.value || 22) || 22,
    username: safeString(byId("username")?.value || "").trim() || "-",
    profile:
      safeString(byId("device_profile")?.value || "linux").trim() || "linux",
    kind: "temporary",
    note: t("sidebarConnectionTemporaryHint"),
  };
}

function savedConnectionDetails(item) {
  return {
    name: safeString(item?.name || "-"),
    host: safeString(item?.host || "-"),
    port: Number(item?.port || 22) || 22,
    username: safeString(item?.username || "-"),
    profile: safeString(item?.device_profile || "linux") || "linux",
    ssh_security: safeString(item?.ssh_security || "").trim(),
    linux_shell_flavor: safeString(item?.linux_shell_flavor || "").trim(),
    kind: "saved",
    note: t("savedConnSubtitle"),
  };
}

function syncProfileAndModesFromTarget(details, refreshModes = false) {
  if (!details) return;
  const profile = safeString(
    details.profile || details.device_profile || "",
  ).trim();
  if (!profile) return;
  if (typeof ensureSelectValue === "function") {
    ensureSelectValue("device_profile", profile, { fallbackToEmpty: false });
  } else if (byId("device_profile")) {
    byId("device_profile").value = profile;
  }
  if (refreshModes && typeof refreshExecutionModeOptions === "function") {
    refreshExecutionModeOptions();
  }
}

function persistConnectionTarget(details = null) {
  try {
    if (!details || !details.kind || details.kind === "none") {
      localStorage.removeItem(STORAGE_KEYS.connectionTarget);
      return;
    }
    if (details.kind === "saved") {
      const name = safeString(details.name || "").trim();
      if (!name) {
        localStorage.removeItem(STORAGE_KEYS.connectionTarget);
        return;
      }
      localStorage.setItem(
        STORAGE_KEYS.connectionTarget,
        JSON.stringify({
          kind: "saved",
          name,
        }),
      );
      return;
    }
    if (details.kind === "temporary") {
      localStorage.setItem(
        STORAGE_KEYS.connectionTarget,
        JSON.stringify({
          kind: "temporary",
          host: safeString(details.host || "").trim(),
          port: Number(details.port || 22) || 22,
          username: safeString(details.username || "").trim(),
          device_profile:
            safeString(details.profile || "linux").trim() || "linux",
          ssh_security: safeString(byId("ssh_security")?.value || "").trim(),
          linux_shell_flavor: safeString(
            byId("linux_shell_flavor")?.value || "",
          ).trim(),
          enabled: !!byId("saved-conn-enabled")?.checked,
          labels: safeString(byId("saved-conn-labels")?.value || ""),
          groups:
            typeof getMultiSelectValues === "function"
              ? getMultiSelectValues("saved-conn-groups")
              : [],
          vars_text: safeString(byId("saved-conn-vars")?.value || ""),
        }),
      );
      return;
    }
    localStorage.removeItem(STORAGE_KEYS.connectionTarget);
  } catch (_) {}
}

function setCurrentConnectionTarget(details = null) {
  if (!details) {
    currentConnectionTarget = { kind: "none", details: null };
    persistConnectionTarget(null);
    return;
  }
  currentConnectionTarget = {
    kind: details.kind || "saved",
    details: { ...details },
  };
  persistConnectionTarget(currentConnectionTarget.details);
}

function restorePersistedConnectionTarget() {
  if (currentConnectionTarget.kind !== "none") return;
  let parsed = null;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.connectionTarget);
    if (!raw) return;
    parsed = JSON.parse(raw);
  } catch (_) {
    localStorage.removeItem(STORAGE_KEYS.connectionTarget);
    return;
  }
  if (!parsed || typeof parsed !== "object") {
    localStorage.removeItem(STORAGE_KEYS.connectionTarget);
    return;
  }

  if (parsed.kind === "saved") {
    const targetName = safeString(parsed.name || "").trim();
    if (!targetName) {
      localStorage.removeItem(STORAGE_KEYS.connectionTarget);
      return;
    }
    const selected = cachedSavedConnections.find(
      (item) => item.name === targetName,
    );
    if (!selected) {
      localStorage.removeItem(STORAGE_KEYS.connectionTarget);
      return;
    }
    ensureSelectValue("saved-conn-name", targetName);
    clearTemporaryConnectionActive();
    if (typeof applyConnectionForm === "function") {
      applyConnectionForm(selected);
    }
    const details = savedConnectionDetails(selected);
    setCurrentConnectionTarget(details);
    syncProfileAndModesFromTarget(details, true);
    return;
  }

  if (parsed.kind === "temporary") {
    byId("saved-conn-name").value = "";
    const host = safeString(parsed.host || "").trim();
    const username = safeString(parsed.username || "").trim();
    byId("host").value = host;
    byId("port").value = safeString(parsed.port || 22);
    byId("username").value = username;
    byId("device_profile").value =
      safeString(parsed.device_profile || "linux").trim() || "linux";
    byId("ssh_security").value = safeString(parsed.ssh_security || "").trim();
    byId("linux_shell_flavor").value = safeString(
      parsed.linux_shell_flavor || "",
    ).trim();
    if (byId("saved-conn-enabled")) {
      byId("saved-conn-enabled").checked = parsed.enabled !== false;
    }
    if (byId("saved-conn-labels")) {
      byId("saved-conn-labels").value = safeString(parsed.labels || "");
    }
    if (byId("saved-conn-vars")) {
      byId("saved-conn-vars").value = safeString(parsed.vars_text || "");
    }
    if (typeof renderSavedConnectionGroupOptions === "function") {
      renderSavedConnectionGroupOptions(
        Array.isArray(parsed.groups) ? parsed.groups : [],
      );
    }
    temporaryConnectionActive = true;
    temporaryConnectionLabel = "";
    temporaryConnectionDetails = {
      name: currentTemporaryConnectionLabel(),
      host: host || "-",
      port: Number(parsed.port || 22) || 22,
      username: username || "-",
      profile: safeString(parsed.device_profile || "linux").trim() || "linux",
      kind: "temporary",
      note: t("sidebarConnectionTemporaryHint"),
    };
    setCurrentConnectionTarget(temporaryConnectionDetails);
    if (typeof refreshExecutionModeOptions === "function") {
      refreshExecutionModeOptions();
    }
    return;
  }
  localStorage.removeItem(STORAGE_KEYS.connectionTarget);
}

function renderTargetCard(details) {
  const badgeClass =
    details.kind === "temporary"
      ? "dashboard-target-badge is-temporary"
      : "dashboard-target-badge is-saved";
  const badgeLabel =
    details.kind === "temporary"
      ? t("sidebarConnectionTemporaryBadge")
      : t("sidebarConnectionSavedBadge");
  const badgeIcon =
    details.kind === "temporary"
      ? `
        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" class="dashboard-target-badge-icon">
          <path d="M11.8 2.5 5.9 10h3l-.7 7.5 5.9-7.5h-3l.7-7.5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"></path>
        </svg>
      `
      : `
        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" class="dashboard-target-badge-icon">
          <path d="M6 3.5h8a1 1 0 0 1 1 1v12l-5-2.8-5 2.8v-12a1 1 0 0 1 1-1Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"></path>
        </svg>
      `;
  const summary =
    details.username && details.username !== "-"
      ? `${details.username}@${details.host}:${details.port}`
      : `${details.host}:${details.port}`;
  return `
    <div class="dashboard-target-card">
      <div class="dashboard-target-head">
        <div class="grid gap-1">
          <div class="dashboard-target-context">${escapeHtml(
            details.kind === "temporary"
              ? t("sidebarConnectionTemporaryLabel")
              : details.name,
          )}</div>
          <div class="dashboard-target-name">${escapeHtml(summary)}</div>
          <div class="dashboard-target-meta-line">${escapeHtml(details.profile)}</div>
        </div>
        <span class="${badgeClass}" title="${escapeHtml(badgeLabel)}" aria-label="${escapeHtml(badgeLabel)}">${badgeIcon}</span>
      </div>
    </div>
  `;
}

function renderSidebarConnectionSelector(errorMessage = "") {
  const meta = byId("sidebar-connection-meta");
  if (!meta) return;

  if (errorMessage) {
    meta.innerHTML = `<span class="text-rose-300">${escapeHtml(errorMessage)}</span>`;
    return;
  }

  if (
    currentConnectionTarget.kind === "temporary" &&
    currentConnectionTarget.details
  ) {
    meta.innerHTML = renderTargetCard({
      ...currentTemporaryConnectionDetails(),
      ...currentConnectionTarget.details,
      kind: "temporary",
    });
    return;
  }

  if (
    currentConnectionTarget.kind === "saved" &&
    currentConnectionTarget.details
  ) {
    const targetName = safeString(
      currentConnectionTarget.details.name || "",
    ).trim();
    const selected = cachedSavedConnections.find(
      (item) => item.name === targetName,
    );
    meta.innerHTML = renderTargetCard(
      selected
        ? {
            ...savedConnectionDetails(selected),
            ...currentConnectionTarget.details,
            kind: "saved",
          }
        : {
            ...currentConnectionTarget.details,
            kind: "saved",
          },
    );
    return;
  }

  meta.innerHTML = `
    <div class="dashboard-target-card is-empty">
      <div class="dashboard-target-head">
        <div class="grid gap-1">
          <div class="dashboard-target-context">${escapeHtml(t("sidebarConnectionOptionNone"))}</div>
          <div class="dashboard-target-name">${escapeHtml(t("sidebarConnectionNoneHint"))}</div>
        </div>
      </div>
    </div>
  `;
}

function markTemporaryConnectionActive() {
  temporaryConnectionActive = true;
  temporaryConnectionLabel = currentTemporaryConnectionLabel();
  temporaryConnectionDetails = {
    name: currentTemporaryConnectionLabel(),
    host: safeString(byId("host")?.value || "").trim() || "-",
    port: Number(byId("port")?.value || 22) || 22,
    username: safeString(byId("username")?.value || "").trim() || "-",
    profile:
      safeString(byId("device_profile")?.value || "linux").trim() || "linux",
    kind: "temporary",
    note: t("sidebarConnectionTemporaryHint"),
  };
  setCurrentConnectionTarget(temporaryConnectionDetails);
  renderSidebarConnectionSelector();
}

function clearTemporaryConnectionActive() {
  temporaryConnectionActive = false;
  temporaryConnectionLabel = "";
  temporaryConnectionDetails = null;
  if (currentConnectionTarget.kind === "temporary") {
    setCurrentConnectionTarget(null);
  }
  renderSidebarConnectionSelector();
}

async function loadSavedConnections() {
  try {
    const data = await request("GET", "/api/connections");
    cachedSavedConnections = Array.isArray(data) ? data : [];
    renderSavedConnectionOptions(byId("saved-conn-name").value || "");
    renderSavedConnectionGroupOptions(
      getMultiSelectValues("saved-conn-groups"),
    );
    if (
      currentConnectionTarget.kind === "saved" &&
      currentConnectionTarget.details
    ) {
      const targetName = safeString(
        currentConnectionTarget.details.name || "",
      ).trim();
      const selected = cachedSavedConnections.find(
        (item) => item.name === targetName,
      );
      if (selected) {
        if (typeof applyConnectionForm === "function") {
          applyConnectionForm(selected);
        }
        const details = savedConnectionDetails(selected);
        setCurrentConnectionTarget(details);
        syncProfileAndModesFromTarget(details, true);
      } else {
        if (byId("saved-conn-name")?.value === targetName) {
          byId("saved-conn-name").value = "";
        }
        setCurrentConnectionTarget(null);
      }
    }
    if (currentConnectionTarget.kind === "none") {
      restorePersistedConnectionTarget();
    }
    if (typeof loadInventoryConnections === "function") {
      loadInventoryConnections();
    }
    renderSidebarConnectionSelector();
  } catch (e) {
    cachedSavedConnections = [];
    cachedSavedConnectionDetails.clear();
    renderSavedConnectionOptions("");
    renderSavedConnectionGroupOptions([]);
    if (typeof loadInventoryConnections === "function") {
      loadInventoryConnections();
    }
    renderSidebarConnectionSelector(e.message);
  }
  updateRecordFabVisibility();
}

async function loadSavedConnectionByName() {
  const name = byId("saved-conn-name").value.trim();
  if (!name) {
    setStatusMessage("saved-conn-out", t("connectionNameRequired"), "error");
    return false;
  }
  setStatusMessage("saved-conn-out", t("running"), "running");
  try {
    const data = await ensureSavedConnectionDetail(name);
    applyConnectionForm(data.connection || {});
    await refreshExecutionModeOptions();
    byId("saved-conn-name").value = data.name || name;
    clearTemporaryConnectionActive();
    setCurrentConnectionTarget(
      savedConnectionDetails({
        ...(data.connection || {}),
        name: data.name || name,
      }),
    );
    renderSidebarConnectionSelector();
    setStatusMessage(
      "saved-conn-out",
      `${t("loaded")}: ${data.name}`,
      "success",
    );
    return true;
  } catch (e) {
    setStatusMessage("saved-conn-out", e.message, "error");
    return false;
  }
}

async function openSavedConnectionEditor() {
  const name = byId("saved-conn-name").value.trim();
  if (!name) {
    setStatusMessage("saved-conn-out", t("connectionNameRequired"), "error");
    return;
  }
  setStatusMessage("saved-conn-out", t("running"), "running");
  try {
    const data = await ensureSavedConnectionDetail(name);
    applySavedConnectionEditorForm(data.name || name, data.connection || {});
    showSavedConnectionEditorModal();
    setStatusMessage(
      "saved-conn-out",
      `${t("loaded")}: ${data.name || name}`,
      "success",
    );
  } catch (e) {
    setStatusMessage("saved-conn-out", e.message, "error");
  }
}

function showSavedConnectionEditorModal() {
  const modal = byId("saved-conn-edit-modal");
  if (!modal) return;
  modal.classList.remove("hidden");
  modal.classList.add("flex");
}

function hideSavedConnectionEditorModal() {
  const modal = byId("saved-conn-edit-modal");
  if (!modal) return;
  modal.classList.add("hidden");
  modal.classList.remove("flex");
}

function splitEditorCsv(raw) {
  return String(raw || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseSavedConnectionEditorVars() {
  const raw = byId("saved-conn-edit-vars")?.value.trim() || "";
  if (!raw) return {};
  let parsed = null;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(err.message || String(err));
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(t("inventoryVarsMustBeObject"));
  }
  return parsed;
}

function applySavedConnectionEditorForm(name, connection = {}) {
  byId("saved-conn-edit-name").value = name || "";
  byId("saved-conn-edit-host").value = safeString(connection.host || "");
  byId("saved-conn-edit-port").value = safeString(connection.port || 22);
  byId("saved-conn-edit-username").value = safeString(
    connection.username || "",
  );
  byId("saved-conn-edit-password").value = "";
  byId("saved-conn-edit-enable-password").value = "";
  byId("saved-conn-edit-ssh-security").value = safeString(
    connection.ssh_security || "",
  );
  byId("saved-conn-edit-linux-shell-flavor").value = safeString(
    connection.linux_shell_flavor || "",
  );
  byId("saved-conn-edit-device-profile").value = safeString(
    connection.device_profile || "",
  );
  byId("saved-conn-edit-enabled").checked = connection.enabled !== false;
  byId("saved-conn-edit-labels").value = Array.isArray(connection.labels)
    ? connection.labels.join(", ")
    : "";
  renderConnectionGroupsForSelect(
    "saved-conn-edit-groups",
    Array.isArray(connection.groups) ? connection.groups : [],
  );
  byId("saved-conn-edit-vars").value = JSON.stringify(
    connection.vars || {},
    null,
    2,
  );
  byId("saved-conn-edit-save-password").checked = !!(
    connection.has_password === false &&
    connection.has_enable_password === false
  );
  setStatusMessage("saved-conn-edit-out", "-", "info");
}

function savedConnectionEditorPayload() {
  return {
    host: byId("saved-conn-edit-host")?.value.trim() || "",
    port: Number(byId("saved-conn-edit-port")?.value.trim() || 22),
    username: byId("saved-conn-edit-username")?.value.trim() || "",
    password: byId("saved-conn-edit-password")?.value || null,
    enable_password: byId("saved-conn-edit-enable-password")?.value || null,
    ssh_security: byId("saved-conn-edit-ssh-security")?.value.trim() || null,
    linux_shell_flavor:
      byId("saved-conn-edit-linux-shell-flavor")?.value.trim() || null,
    device_profile:
      byId("saved-conn-edit-device-profile")?.value.trim() || null,
    enabled: !!byId("saved-conn-edit-enabled")?.checked,
    labels: splitEditorCsv(byId("saved-conn-edit-labels")?.value || ""),
    groups: getMultiSelectValuesById("saved-conn-edit-groups"),
    vars: parseSavedConnectionEditorVars(),
  };
}

async function saveSavedConnectionEditor() {
  const name = byId("saved-conn-edit-name")?.value.trim() || "";
  if (!name) {
    setStatusMessage(
      "saved-conn-edit-out",
      t("connectionNameRequired"),
      "error",
    );
    return;
  }
  setStatusMessage("saved-conn-edit-out", t("running"), "running");
  try {
    const dontSavePassword = !!byId("saved-conn-edit-save-password")?.checked;
    const payload = savedConnectionEditorPayload();
    if (!payload.device_profile) {
      payload.device_profile = "linux";
    }
    if (dontSavePassword) {
      payload.password = null;
      payload.enable_password = null;
    }
    const data = await request(
      "PUT",
      `/api/connections/${encodeURIComponent(name)}`,
      {
        connection: payload,
        save_password: !dontSavePassword,
      },
    );
    cachedSavedConnectionDetails.set(data.name || name, data);
    await loadSavedConnections();
    ensureSelectValue("saved-conn-name", data.name || name);
    if (
      currentConnectionTarget.kind === "saved" &&
      safeString(currentConnectionTarget.details?.name || "").trim() ===
        (data.name || name)
    ) {
      setCurrentConnectionTarget(
        savedConnectionDetails({
          ...((data && data.connection) || payload),
          name: data.name || name,
        }),
      );
      renderSidebarConnectionSelector();
    }
    setStatusMessage(
      "saved-conn-out",
      `${t("saved")}: ${data.name || name}`,
      "success",
    );
    setStatusMessage(
      "saved-conn-edit-out",
      `${t("saved")}: ${data.name || name}`,
      "success",
    );
    hideSavedConnectionEditorModal();
  } catch (e) {
    setStatusMessage("saved-conn-edit-out", e.message, "error");
  }
}

async function deleteConnectionByName() {
  const name = byId("saved-conn-name").value.trim();
  if (!name) {
    setStatusMessage("saved-conn-out", t("connectionNameRequired"), "error");
    return;
  }
  setStatusMessage("saved-conn-out", t("running"), "running");
  try {
    await request("DELETE", `/api/connections/${encodeURIComponent(name)}`);
    cachedSavedConnectionDetails.delete(name);
    setStatusMessage("saved-conn-out", `${t("deleted")}: ${name}`, "success");
    byId("saved-conn-name").value = "";
    if (
      currentConnectionTarget.kind === "saved" &&
      safeString(currentConnectionTarget.details?.name || "").trim() === name
    ) {
      setCurrentConnectionTarget(null);
    }
    clearTemporaryConnectionActive();
    await loadSavedConnections();
  } catch (e) {
    setStatusMessage("saved-conn-out", e.message, "error");
  }
}

async function createSavedConnectionDraft() {
  const name = promptForResourceName(t("savedConnNewPrompt"));
  if (!name) return;
  const exists = (cachedSavedConnections || []).some(
    (item) => item.name === name,
  );
  if (exists) {
    setStatusMessage(
      "saved-conn-out",
      `${name} already exists, use ${t("savedConnEditBtn")} to update`,
      "error",
    );
    ensureSelectValue("saved-conn-name", name);
    return;
  }

  ensureSelectValue("saved-conn-name", name);
  const dontSavePassword = byId("saved-conn-save-password").checked;
  const payload = connectionPayload();
  if (!payload.device_profile) {
    payload.device_profile = "linux";
  }
  if (dontSavePassword) {
    payload.password = null;
    payload.enable_password = null;
  }

  setStatusMessage("saved-conn-out", t("running"), "running");
  try {
    const data = await request(
      "PUT",
      `/api/connections/${encodeURIComponent(name)}`,
      {
        connection: payload,
        save_password: !dontSavePassword,
      },
    );
    cachedSavedConnectionDetails.set(data.name || name, data);
    await loadSavedConnections();
    ensureSelectValue("saved-conn-name", data.name || name);
    applyConnectionForm((data && data.connection) || payload);
    clearTemporaryConnectionActive();
    setCurrentConnectionTarget(
      savedConnectionDetails({
        ...((data && data.connection) || payload),
        name: data.name || name,
      }),
    );
    setStatusMessage(
      "saved-conn-out",
      `${t("created")}: ${data.name || name}`,
      "success",
    );
  } catch (e) {
    setStatusMessage("saved-conn-out", e.message, "error");
  }
}

function formatConnectionImportSummary(report) {
  return `${t("savedConnImportDone")}: ${t("savedConnImportSummaryTotal")}=${safeString(
    report.total_rows,
  )}, ${t("savedConnImportSummaryImported")}=${safeString(
    report.imported,
  )}, ${t("savedConnImportSummaryCreated")}=${safeString(
    report.created,
  )}, ${t("savedConnImportSummaryUpdated")}=${safeString(
    report.updated,
  )}, ${t("savedConnImportSummaryFailed")}=${safeString(report.failed)}`;
}

function formatConnectionImportDetail(report) {
  const failures = Array.isArray(report && report.failures)
    ? report.failures
    : [];
  const items = failures.length
    ? failures
        .map((item) => {
          const nameSuffix =
            item && item.name ? ` [${escapeHtml(item.name)}]` : "";
          return `<li class="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"><span class="font-semibold">${escapeHtml(
            `${t("savedConnImportFailureRow")} ${safeString(item.row)}`,
          )}</span>${nameSuffix}: ${escapeHtml(safeString(item.message))}</li>`;
        })
        .join("")
    : `<div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">${escapeHtml(
        "-",
      )}</div>`;

  return `
    <div class="grid gap-3">
      <section class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
        <div class="grid gap-1 sm:grid-cols-2">
          <div>${escapeHtml(t("savedConnImportSummaryTotal"))}: ${escapeHtml(
            safeString(report.total_rows),
          )}</div>
          <div>${escapeHtml(t("savedConnImportSummaryImported"))}: ${escapeHtml(
            safeString(report.imported),
          )}</div>
          <div>${escapeHtml(t("savedConnImportSummaryCreated"))}: ${escapeHtml(
            safeString(report.created),
          )}</div>
          <div>${escapeHtml(t("savedConnImportSummaryUpdated"))}: ${escapeHtml(
            safeString(report.updated),
          )}</div>
          <div>${escapeHtml(t("savedConnImportSummaryFailed"))}: ${escapeHtml(
            safeString(report.failed),
          )}</div>
        </div>
      </section>
      <section>
        <div class="mb-2 text-xs font-semibold text-slate-500">${escapeHtml(
          t("savedConnImportFailuresTitle"),
        )}</div>
        <ul class="grid gap-2">${items}</ul>
      </section>
    </div>
  `;
}

async function importConnectionsFromFile() {
  const input = byId("saved-conn-import-file-input");
  const file = input && input.files && input.files[0];
  if (!file) {
    setStatusMessage("saved-conn-out", t("savedConnImportInvalid"), "error");
    return;
  }
  setStatusMessage("saved-conn-out", t("running"), "running");
  try {
    const formData = new FormData();
    formData.append("file", file, file.name);
    const data = await requestForm("POST", "/api/connections/import", formData);
    await loadSavedConnections();
    setStatusMessage(
      "saved-conn-out",
      formatConnectionImportSummary(data),
      data.failed > 0 ? "error" : "success",
    );
    if ((data.failed || 0) > 0) {
      openDetailModal(formatConnectionImportDetail(data), {
        title: t("savedConnImportTitle"),
        html: true,
      });
    }
  } catch (e) {
    setStatusMessage("saved-conn-out", e.message, "error");
  } finally {
    input.value = "";
  }
}

async function downloadConnectionImportTemplate() {
  const lang = currentLang === "zh" ? "zh" : "en";
  const url = `/api/connections/import-template?lang=${encodeURIComponent(lang)}`;
  try {
    const res = await fetch(url, { headers: buildRequestHeaders(false) });
    if (!res.ok) {
      const raw = await res.text();
      throw new Error(
        res.status === 401
          ? getStoredAgentApiToken()
            ? t("agentAuthInvalid")
            : t("agentAuthRequired")
          : raw || t("requestFailed"),
      );
    }
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download =
      currentLang === "zh"
        ? "rauto-connection-import-template-zh.csv"
        : "rauto-connection-import-template-en.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objectUrl);
    setStatusMessage("saved-conn-out", t("savedConnTemplateDone"), "success");
  } catch (e) {
    setStatusMessage("saved-conn-out", e.message, "error");
  }
}
