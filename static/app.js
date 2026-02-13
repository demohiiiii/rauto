function byId(id) {
  return document.getElementById(id);
}

const i18n = {
  en: {
    title: "rauto Web Console",
    subtitle: "Operate existing CLI capabilities from browser UI powered by axum APIs.",
    langFabTitle: "Switch language",
    connectionTitle: "Connection Defaults",
    connectionTestBtn: "Test Connection",
    connectionHelp: "Leave empty to fallback to CLI defaults used at server startup.",
    tabOps: "Operations",
    tabPrompts: "Prompt Profiles",
    tabTemplates: "Template Manager",
    opsTitle: "Operations",
    opCardTitle: "Execution",
    opKindExec: "Direct Execute",
    opKindTemplate: "Template Render + Execute",
    templateSelectedContentTitle: "Selected Template Content",
    templateSelectedContentPlaceholder: "template content preview",
    promptMgrTitle: "Device Prompt Profiles",
    builtinTitle: "Built-in Profiles",
    customTitle: "Custom Profiles",
    templateMgrTitle: "Template Manager",
    templateListTitle: "Templates",
    templateEditorTitle: "Editor",
    templateManagePathPlaceholder: "template path (auto)",
    templateViewContentLabel: "Template Content",
    templateCopyContentBtn: "Copy Content",
    renderBtn: "Preview Render",
    execBtn: "Execute",
    templateExecBtn: "Run Template",
    profileLoadBtn: "Load",
    profileRefreshBtn: "Refresh",
    profileSaveBtn: "Save",
    profileDeleteBtn: "Delete",
    builtinDetailBtn: "View Detail",
    builtinCopyBtn: "Copy To Custom Form",
    templateLoadBtn: "Load",
    templateRefreshBtn: "Refresh",
    templateCreateBtn: "Create",
    templateUpdateBtn: "Update",
    templateDeleteBtn: "Delete",
    deleteInlineBtn: "Delete",
    addInlineBtn: "+ Add",
    addPatternInlineBtn: "+ Add Pattern",
    fieldState: "state",
    fieldInput: "input",
    fieldFrom: "from",
    fieldCommand: "command",
    fieldTo: "to",
    fieldPattern: "pattern",
    fieldPatterns: "patterns",
    fieldSysNameGroup: "sys_name_group",
    fieldIsDynamic: "is_dynamic",
    fieldRecordInput: "record_input",
    fieldIsExit: "is_exit",
    fieldFormatSys: "format_sys",
    labelMorePatterns: "more_patterns",
    labelErrorPatterns: "error_patterns",
    labelIgnoreErrors: "ignore_errors",
    labelPrompts: "prompts",
    labelSysPrompts: "sys_prompts",
    labelInteractions: "interactions",
    labelTransitions: "transitions",
    collapse: "Collapse",
    expand: "Expand",
    hostPlaceholder: "host",
    portPlaceholder: "port (default 22)",
    usernamePlaceholder: "username",
    passwordPlaceholder: "password",
    enablePasswordPlaceholder: "enable password (optional)",
    deviceProfilePlaceholder: "device profile (default cisco)",
    templatePlaceholder: "template file name or path",
    varsPlaceholder: 'JSON vars, e.g. {"vlan_id": 10}',
    commandPlaceholder: "show version",
    modePlaceholder: "mode (optional, default Enable)",
    templateModePlaceholder: "mode (optional, default Enable)",
    customProfilePickerPlaceholder: "search/select custom profile name",
    templateViewPickerPlaceholder: "search/select template name",
    profileFormNamePlaceholder: "profile name",
    profileMorePatternsPlaceholder: "more_patterns: one per line",
    profileErrorPatternsPlaceholder: "error_patterns: one per line",
    profileIgnoreErrorsPlaceholder: "ignore_errors: one per line",
    profilePromptsPlaceholder: 'prompts JSON array, e.g. [{"state":"Enable","patterns":["^...$"]}]',
    profileSysPromptsPlaceholder: "sys_prompts JSON array",
    profileInteractionsPlaceholder: "interactions JSON array",
    profileTransitionsPlaceholder: "transitions JSON array",
    templateManageNamePlaceholder: "template name, e.g. show_version.j2",
    templateContentPlaceholder: "Template content",
    running: "running...",
    requestFailed: "Request failed",
    saved: "Saved",
    deleted: "Deleted",
    created: "Created",
    connectionOk: "Connection successful",
    needLoadBuiltinFirst: "Load builtin detail first",
    copiedToCustom: "Copied to custom form",
    templateNeedLoadFirst: "Load template detail first",
    templateCopiedToEdit: "Copied to create/update editor",
    templateContentCopied: "Template content copied",
  },
  zh: {
    title: "rauto Web 控制台",
    subtitle: "通过 axum API 在浏览器中操作现有 CLI 功能。",
    langFabTitle: "切换语言",
    connectionTitle: "连接默认参数",
    connectionTestBtn: "测试连接",
    connectionHelp: "留空时会回退到服务启动时的 CLI 默认参数。",
    tabOps: "常用操作",
    tabPrompts: "Prompt 管理",
    tabTemplates: "Template 管理",
    opsTitle: "常用操作",
    opCardTitle: "执行模式",
    opKindExec: "直接执行命令",
    opKindTemplate: "模板渲染并执行",
    templateSelectedContentTitle: "已选模板内容",
    templateSelectedContentPlaceholder: "模板内容预览",
    promptMgrTitle: "设备 Prompt 配置",
    builtinTitle: "内置 Profile",
    customTitle: "自定义 Profile",
    templateMgrTitle: "Template 管理",
    templateListTitle: "Template 列表",
    templateEditorTitle: "编辑器",
    templateManagePathPlaceholder: "template 路径（自动）",
    templateViewContentLabel: "模板内容",
    templateCopyContentBtn: "复制内容",
    renderBtn: "预览渲染",
    execBtn: "执行",
    templateExecBtn: "运行模板",
    profileLoadBtn: "加载",
    profileRefreshBtn: "刷新",
    profileSaveBtn: "保存",
    profileDeleteBtn: "删除",
    builtinDetailBtn: "查看详情",
    builtinCopyBtn: "复制到新增/修改",
    templateLoadBtn: "加载",
    templateRefreshBtn: "刷新",
    templateCreateBtn: "创建",
    templateUpdateBtn: "更新",
    templateDeleteBtn: "删除",
    deleteInlineBtn: "删除",
    addInlineBtn: "+ 添加",
    addPatternInlineBtn: "+ 添加 Pattern",
    fieldState: "状态(state)",
    fieldInput: "输入(input)",
    fieldFrom: "来源(from)",
    fieldCommand: "命令(command)",
    fieldTo: "目标(to)",
    fieldPattern: "匹配(pattern)",
    fieldPatterns: "匹配列表(patterns)",
    fieldSysNameGroup: "系统名分组(sys_name_group)",
    fieldIsDynamic: "动态输入(is_dynamic)",
    fieldRecordInput: "记录输入(record_input)",
    fieldIsExit: "退出态(is_exit)",
    fieldFormatSys: "格式化系统名(format_sys)",
    labelMorePatterns: "分页匹配(more_patterns)",
    labelErrorPatterns: "错误匹配(error_patterns)",
    labelIgnoreErrors: "忽略错误(ignore_errors)",
    labelPrompts: "提示符(prompts)",
    labelSysPrompts: "系统提示符(sys_prompts)",
    labelInteractions: "交互项(interactions)",
    labelTransitions: "状态迁移(transitions)",
    collapse: "收起",
    expand: "展开",
    hostPlaceholder: "设备地址",
    portPlaceholder: "端口（默认 22）",
    usernamePlaceholder: "用户名",
    passwordPlaceholder: "密码",
    enablePasswordPlaceholder: "enable 密码（可选）",
    deviceProfilePlaceholder: "设备 profile（默认 cisco）",
    templatePlaceholder: "模板文件名或路径",
    varsPlaceholder: 'JSON 变量，例如 {"vlan_id": 10}',
    commandPlaceholder: "show version",
    modePlaceholder: "模式（可选，默认 Enable）",
    templateModePlaceholder: "模式（可选，默认 Enable）",
    customProfilePickerPlaceholder: "搜索/选择自定义 profile 名称",
    templateViewPickerPlaceholder: "搜索/选择 template 名称",
    profileFormNamePlaceholder: "profile 名称",
    profileMorePatternsPlaceholder: "more_patterns：每行一个",
    profileErrorPatternsPlaceholder: "error_patterns：每行一个",
    profileIgnoreErrorsPlaceholder: "ignore_errors：每行一个",
    profilePromptsPlaceholder: 'prompts JSON 数组，例如 [{"state":"Enable","patterns":["^...$"]}]',
    profileSysPromptsPlaceholder: "sys_prompts JSON 数组",
    profileInteractionsPlaceholder: "interactions JSON 数组",
    profileTransitionsPlaceholder: "transitions JSON 数组",
    templateManageNamePlaceholder: "template 名称，例如 show_version.j2",
    templateContentPlaceholder: "Template 内容",
    running: "执行中...",
    requestFailed: "请求失败",
    saved: "已保存",
    deleted: "已删除",
    created: "已创建",
    connectionOk: "连接成功",
    needLoadBuiltinFirst: "请先加载内置详情",
    copiedToCustom: "已复制到新增/修改表单",
    templateNeedLoadFirst: "请先加载模板详情",
    templateCopiedToEdit: "已复制到新增/修改编辑区",
    templateContentCopied: "模板内容已复制",
  },
};

let currentLang = localStorage.getItem("rauto_lang") || "zh";
let currentTab = "ops";
let currentOpKind = "exec";
let cachedCustomProfiles = [];
let cachedDeviceProfiles = [];
let cachedTemplates = [];
let lastBuiltinProfile = null;
let lastTemplateDetail = null;
const autocompleteMenus = [];

function t(key) {
  return i18n[currentLang][key] || i18n.en[key] || key;
}

function applyI18n() {
  byId("title").textContent = t("title");
  byId("subtitle").textContent = t("subtitle");
  byId("lang-fab").title = t("langFabTitle");
  byId("lang-fab").setAttribute("aria-label", t("langFabTitle"));
  byId("connection-title").textContent = t("connectionTitle");
  byId("connection-test-btn").textContent = t("connectionTestBtn");
  byId("connection-help").textContent = t("connectionHelp");

  byId("tab-ops").textContent = t("tabOps");
  byId("tab-prompts").textContent = t("tabPrompts");
  byId("tab-templates").textContent = t("tabTemplates");

  byId("ops-title").textContent = t("opsTitle");
  byId("op-card-title").textContent = t("opCardTitle");
  byId("op-kind-exec").textContent = t("opKindExec");
  byId("op-kind-template").textContent = t("opKindTemplate");
  byId("template-selected-content-title").textContent = t("templateSelectedContentTitle");
  byId("prompt-mgr-title").textContent = t("promptMgrTitle");
  byId("builtin-title").textContent = t("builtinTitle");
  byId("custom-title").textContent = t("customTitle");
  byId("template-mgr-title").textContent = t("templateMgrTitle");
  byId("template-list-title").textContent = t("templateListTitle");
  byId("template-editor-title").textContent = t("templateEditorTitle");

  byId("render-btn").textContent = t("renderBtn");
  byId("exec-btn").textContent = t("execBtn");
  byId("template-exec-btn").textContent = t("templateExecBtn");
  byId("profile-load-btn").textContent = t("profileLoadBtn");
  byId("profile-refresh-btn").textContent = t("profileRefreshBtn");
  byId("profile-save-btn").textContent = t("profileSaveBtn");
  byId("profile-delete-btn").textContent = t("profileDeleteBtn");
  byId("builtin-detail-btn").textContent = t("builtinDetailBtn");
  byId("builtin-copy-btn").textContent = t("builtinCopyBtn");
  byId("template-load-btn").textContent = t("templateLoadBtn");
  byId("template-refresh-btn").textContent = t("templateRefreshBtn");
  byId("template-create-btn").textContent = t("templateCreateBtn");
  byId("template-update-btn").textContent = t("templateUpdateBtn");
  byId("template-delete-btn").textContent = t("templateDeleteBtn");
  byId("template-copy-content-btn").textContent = t("templateCopyContentBtn");
  byId("add-more-pattern-btn").textContent = t("addInlineBtn");
  byId("add-error-pattern-btn").textContent = t("addInlineBtn");
  byId("add-ignore-error-btn").textContent = t("addInlineBtn");
  byId("add-prompt-row-btn").textContent = t("addInlineBtn");
  byId("add-sys-prompt-row-btn").textContent = t("addInlineBtn");
  byId("add-interaction-row-btn").textContent = t("addInlineBtn");
  byId("add-transition-row-btn").textContent = t("addInlineBtn");
  byId("label-more-patterns").textContent = t("labelMorePatterns");
  byId("label-error-patterns").textContent = t("labelErrorPatterns");
  byId("label-ignore-errors").textContent = t("labelIgnoreErrors");
  byId("label-prompts").textContent = t("labelPrompts");
  byId("label-sys-prompts").textContent = t("labelSysPrompts");
  byId("label-interactions").textContent = t("labelInteractions");
  byId("label-transitions").textContent = t("labelTransitions");

  byId("host").placeholder = t("hostPlaceholder");
  byId("port").placeholder = t("portPlaceholder");
  byId("username").placeholder = t("usernamePlaceholder");
  byId("password").placeholder = t("passwordPlaceholder");
  byId("enable_password").placeholder = t("enablePasswordPlaceholder");
  byId("device_profile").placeholder = t("deviceProfilePlaceholder");
  byId("template").placeholder = t("templatePlaceholder");
  byId("template-selected-content").placeholder = t("templateSelectedContentPlaceholder");
  byId("vars").placeholder = t("varsPlaceholder");
  byId("command").placeholder = t("commandPlaceholder");
  byId("mode").placeholder = t("modePlaceholder");
  byId("template-mode").placeholder = t("templateModePlaceholder");
  byId("custom-profile-picker").placeholder = t("customProfilePickerPlaceholder");
  byId("template-pick-name").placeholder = t("templateViewPickerPlaceholder");
  renderCustomProfileOptions();
  renderTemplateOptions();
  byId("profile-form-name").placeholder = t("profileFormNamePlaceholder");
  byId("template-manage-name").placeholder = t("templateManageNamePlaceholder");
  byId("template-manage-path").placeholder = t("templateManagePathPlaceholder");
  byId("template-content").placeholder = t("templateContentPlaceholder");
  localizeDynamicFields();

  document.documentElement.lang = currentLang === "zh" ? "zh-CN" : "en";
}

function localizeDynamicFields() {
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (key) el.textContent = t(key);
  });
  document.querySelectorAll("[data-i18n-ph]").forEach((el) => {
    const key = el.getAttribute("data-i18n-ph");
    if (key) el.setAttribute("placeholder", t(key));
  });
  document.querySelectorAll(".collapse-btn").forEach((btn) => {
    const bodyId = btn.getAttribute("data-target");
    const body = bodyId ? byId(bodyId) : null;
    if (!body) return;
    btn.textContent = body.hidden ? t("expand") : t("collapse");
  });
}

function applyTabs() {
  const tabs = ["ops", "prompts", "templates"];
  for (const tab of tabs) {
    const button = byId(`tab-${tab}`);
    const panel = byId(`panel-${tab}`);
    const active = tab === currentTab;

    if (active) {
      button.classList.add("is-active");
      panel.hidden = false;
      panel.style.display = "";
      button.setAttribute("aria-selected", "true");
    } else {
      button.classList.remove("is-active");
      panel.hidden = true;
      panel.style.display = "none";
      button.setAttribute("aria-selected", "false");
    }
  }
}

function applyOperationKind() {
  const isExec = currentOpKind === "exec";
  byId("op-direct-fields").hidden = !isExec;
  byId("op-direct-fields").style.display = isExec ? "" : "none";
  byId("op-template-fields").hidden = isExec;
  byId("op-template-fields").style.display = isExec ? "none" : "";
  byId("op-kind-exec").classList.toggle("is-active", isExec);
  byId("op-kind-template").classList.toggle("is-active", !isExec);
  byId("op-kind-exec").setAttribute("aria-selected", isExec ? "true" : "false");
  byId("op-kind-template").setAttribute("aria-selected", isExec ? "false" : "true");
}

async function loadSelectedTemplateContent() {
  const name = byId("template").value.trim();
  const preview = byId("template-selected-content");
  const out = byId("render-out");
  if (!name) {
    preview.value = "";
    return;
  }
  try {
    const data = await request("GET", `/api/templates/${encodeURIComponent(name)}`);
    preview.value = data.content || "";
  } catch (e) {
    preview.value = "";
    out.textContent = e.message;
  }
}

function connectionPayload() {
  const value = (id) => byId(id).value.trim();
  const rawPort = value("port");
  const parsedPort = rawPort ? Number(rawPort) : 22;
  return {
    host: value("host") || null,
    port: Number.isFinite(parsedPort) ? parsedPort : 22,
    username: value("username") || null,
    password: value("password") || null,
    enable_password: value("enable_password") || null,
    device_profile: value("device_profile") || null,
  };
}

function parseVars() {
  const raw = byId("vars").value.trim();
  if (!raw) return {};
  return JSON.parse(raw);
}

async function request(method, url, body) {
  const options = {
    method,
    headers: { "content-type": "application/json" },
  };
  if (body !== undefined) {
    options.body = JSON.stringify(body);
  }
  const res = await fetch(url, options);
  const raw = await res.text();
  let data = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch (_) {
    data = null;
  }
  if (!res.ok) {
    const msg = (data && data.error) || raw || t("requestFailed");
    throw new Error(msg);
  }
  return data ?? {};
}

async function loadProfilesOverview() {
  const outBuiltin = byId("builtin-list");
  const outBuiltinDetail = byId("builtin-detail-status");
  const builtinSelect = byId("builtin-profile-select");
  const outProfile = byId("profile-out");
  try {
    const data = await request("GET", "/api/device-profiles/all");
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
    outBuiltinDetail.textContent = "-";

    if (data.custom.length > 0) {
      cachedCustomProfiles = data.custom.map((item) => item.name);
      outProfile.textContent = data.custom
        .map((item) => `- ${item.name} -> ${item.path}`)
        .join("\n");
      renderCustomProfileOptions();
    } else {
      cachedCustomProfiles = [];
      outProfile.textContent = "-";
      renderCustomProfileOptions();
    }
  } catch (e) {
    cachedCustomProfiles = [];
    cachedDeviceProfiles = [];
    outProfile.textContent = e.message;
    outBuiltinDetail.textContent = e.message;
    renderCustomProfileOptions();
  }
}

function renderCustomProfileOptions(keyword = "") {
  const datalist = byId("custom-profile-options");
  const q = keyword.trim().toLowerCase();
  const names = cachedCustomProfiles.filter((name) =>
    !q ? true : name.toLowerCase().includes(q)
  );
  datalist.innerHTML = names
    .map((name) => `<option value="${name}"></option>`)
    .join("");
}

function initAutocomplete(inputId, sourceFn) {
  const input = byId(inputId);
  if (!input) return;

  const menu = document.createElement("div");
  menu.className = "autocomplete-menu";
  menu.hidden = true;
  document.body.appendChild(menu);
  autocompleteMenus.push(menu);

  let items = [];
  let activeIndex = -1;

  const hide = () => {
    menu.hidden = true;
    menu.style.display = "none";
    activeIndex = -1;
  };

  const position = () => {
    const rect = input.getBoundingClientRect();
    menu.style.left = `${rect.left + window.scrollX}px`;
    menu.style.top = `${rect.bottom + window.scrollY + 6}px`;
    menu.style.width = `${rect.width}px`;
  };

  const render = () => {
    const all = Array.from(new Set((sourceFn() || []).filter(Boolean)));
    const q = input.value.trim().toLowerCase();
    items = all.filter((name) => (!q ? true : name.toLowerCase().includes(q))).slice(0, 24);
    if (items.length === 0) {
      hide();
      return;
    }
    menu.innerHTML = "";
    items.forEach((name, idx) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = idx === activeIndex ? "autocomplete-item is-active" : "autocomplete-item";
      btn.setAttribute("data-idx", String(idx));
      btn.textContent = name;
      menu.appendChild(btn);
    });
    position();
    menu.hidden = false;
    menu.style.display = "";
  };

  const applyActive = () => {
    menu.querySelectorAll(".autocomplete-item").forEach((node, idx) => {
      if (idx === activeIndex) node.classList.add("is-active");
      else node.classList.remove("is-active");
    });
  };

  const selectByIndex = (idx) => {
    if (idx < 0 || idx >= items.length) return;
    input.value = items[idx];
    hide();
    input.dispatchEvent(new Event("change"));
  };

  input.addEventListener("focus", () => {
    activeIndex = -1;
    render();
  });
  input.addEventListener("input", () => {
    activeIndex = -1;
    render();
  });
  input.addEventListener("keydown", (e) => {
    if (menu.hidden && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      activeIndex = 0;
      render();
      e.preventDefault();
      return;
    }
    if (menu.hidden) return;

    if (e.key === "ArrowDown") {
      activeIndex = Math.min(activeIndex + 1, items.length - 1);
      applyActive();
      e.preventDefault();
      return;
    }
    if (e.key === "ArrowUp") {
      activeIndex = Math.max(activeIndex - 1, 0);
      applyActive();
      e.preventDefault();
      return;
    }
    if (e.key === "Enter" && activeIndex >= 0) {
      selectByIndex(activeIndex);
      e.preventDefault();
      return;
    }
    if (e.key === "Escape") {
      hide();
      e.preventDefault();
    }
  });
  input.addEventListener("blur", () => {
    setTimeout(hide, 120);
  });

  menu.addEventListener("mousedown", (e) => {
    e.preventDefault();
  });
  menu.addEventListener("click", (e) => {
    const btn = e.target.closest(".autocomplete-item");
    if (!btn) return;
    const idx = Number(btn.getAttribute("data-idx"));
    selectByIndex(idx);
  });

  window.addEventListener("resize", () => {
    if (!menu.hidden) position();
  });
  window.addEventListener(
    "scroll",
    () => {
      if (!menu.hidden) position();
    },
    true
  );
}

function initTopLevelAutocomplete() {
  initAutocomplete("device_profile", () => cachedDeviceProfiles);
  initAutocomplete("template", () => cachedTemplates);
}

function initCollapsibleGroups() {
  document.querySelectorAll(".group-card").forEach((card) => {
    let head = card.querySelector(":scope > .field-tools");
    if (!head) {
      head = card.querySelector(":scope > div");
    }
    const body = card.querySelector(".group-body");
    if (!head || !body || !body.id) return;
    if (head.querySelector(".collapse-btn")) return;
    if (!head.classList.contains("field-tools")) {
      head.classList.add("field-tools");
    }

    const key = `rauto_collapse_${body.id}`;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "collapse-btn";
    btn.setAttribute("data-target", body.id);
    head.appendChild(btn);

    const collapsed = localStorage.getItem(key) === "1";
    body.hidden = collapsed;
    body.style.display = collapsed ? "none" : "";
    btn.setAttribute("aria-expanded", collapsed ? "false" : "true");
    btn.textContent = collapsed ? t("expand") : t("collapse");
    btn.onclick = () => {
      body.hidden = !body.hidden;
      body.style.display = body.hidden ? "none" : "";
      localStorage.setItem(key, body.hidden ? "1" : "0");
      btn.setAttribute("aria-expanded", body.hidden ? "false" : "true");
      btn.textContent = body.hidden ? t("expand") : t("collapse");
    };
  });
}

async function loadBuiltinProfileDetail() {
  const name = byId("builtin-profile-select").value;
  const out = byId("builtin-detail-status");
  if (!name) {
    out.textContent = "-";
    return;
  }
  out.textContent = t("running");
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
    out.textContent = `${data.name}: ${data.summary}`;
  } catch (e) {
    lastBuiltinProfile = null;
    out.textContent = e.message;
  }
}

function setBuiltinForm(profile) {
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

function linesToArray(raw) {
  return raw
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
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
  row.className = "field-card";
  row.innerHTML = `
    <div class="stack">
      <input class="input js-state" data-i18n-ph="fieldState" />
      <div class="field-card">
        <div class="field-tools">
          <span class="text-sm text-slate-700" data-i18n="fieldPatterns">patterns</span>
          <button type="button" class="mini-btn add js-add-pattern" data-i18n="addPatternInlineBtn">+ Add Pattern</button>
        </div>
        <div class="stack js-pattern-list"></div>
      </div>
      <button type="button" class="mini-btn delete fit-btn">Delete</button>
    </div>
  `;
  row.querySelector(".js-state").value = item.state || "";
  const patternList = row.querySelector(".js-pattern-list");
  row.querySelector(".js-add-pattern").onclick = () => addPatternRow(patternList);
  (item.patterns || []).forEach((p) => addPatternRow(patternList, p));
  if ((item.patterns || []).length === 0) addPatternRow(patternList);
  const delBtn = row.querySelector("button:last-child");
  delBtn.textContent = t("deleteInlineBtn");
  delBtn.onclick = () => row.remove();
  container.appendChild(row);
  localizeDynamicFields();
}

function addReadonlyPromptRow(containerId, item = { state: "", patterns: [] }) {
  const container = byId(containerId);
  const row = document.createElement("div");
  row.className = "field-card";
  row.innerHTML = `
    <div class="stack">
      <input class="input js-state" data-i18n-ph="fieldState" readonly />
      <div class="field-card">
        <div class="field-tools">
          <span class="text-sm text-slate-700" data-i18n="fieldPatterns">patterns</span>
        </div>
        <div class="stack js-pattern-list"></div>
      </div>
    </div>
  `;
  row.querySelector(".js-state").value = item.state || "";
  const patternList = row.querySelector(".js-pattern-list");
  (item.patterns || []).forEach((p) => addReadonlyPatternRow(patternList, p));
  container.appendChild(row);
  localizeDynamicFields();
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
  row.className = "field-card stack";
  row.innerHTML = `
    <input class="input js-state" data-i18n-ph="fieldState" />
    <input class="input js-group" data-i18n-ph="fieldSysNameGroup" />
    <input class="input js-pattern" data-i18n-ph="fieldPattern" />
    <button type="button" class="mini-btn delete fit-btn">Delete</button>
  `;
  row.querySelector(".js-state").value = item.state || "";
  row.querySelector(".js-group").value = item.sys_name_group || "";
  row.querySelector(".js-pattern").value = item.pattern || "";
  const delBtn = row.querySelector("button");
  delBtn.textContent = t("deleteInlineBtn");
  delBtn.onclick = () => row.remove();
  container.appendChild(row);
  localizeDynamicFields();
}

function addReadonlySysPromptRow(
  containerId,
  item = { state: "", sys_name_group: "", pattern: "" }
) {
  const container = byId(containerId);
  const row = document.createElement("div");
  row.className = "field-card stack";
  row.innerHTML = `
    <input class="input js-state" data-i18n-ph="fieldState" readonly />
    <input class="input js-group" data-i18n-ph="fieldSysNameGroup" readonly />
    <input class="input js-pattern" data-i18n-ph="fieldPattern" readonly />
  `;
  row.querySelector(".js-state").value = item.state || "";
  row.querySelector(".js-group").value = item.sys_name_group || "";
  row.querySelector(".js-pattern").value = item.pattern || "";
  container.appendChild(row);
  localizeDynamicFields();
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
  row.className = "field-card stack";
  row.innerHTML = `
    <input class="input js-state" data-i18n-ph="fieldState" />
    <input class="input js-input" data-i18n-ph="fieldInput" />
    <label class="check-label"><input type="checkbox" class="check-input js-is-dynamic" /><span data-i18n="fieldIsDynamic">is_dynamic</span></label>
    <label class="check-label"><input type="checkbox" class="check-input js-record-input" checked /><span data-i18n="fieldRecordInput">record_input</span></label>
    <div class="field-card">
      <div class="field-tools">
        <span class="text-sm text-slate-700" data-i18n="fieldPatterns">patterns</span>
        <button type="button" class="mini-btn add js-add-pattern" data-i18n="addPatternInlineBtn">+ Add Pattern</button>
      </div>
      <div class="stack js-pattern-list"></div>
    </div>
    <button type="button" class="mini-btn delete fit-btn">Delete</button>
  `;
  row.querySelector(".js-state").value = item.state || "";
  row.querySelector(".js-input").value = item.input || "";
  row.querySelector(".js-is-dynamic").checked = !!item.is_dynamic;
  row.querySelector(".js-record-input").checked = item.record_input !== false;
  const patternList = row.querySelector(".js-pattern-list");
  row.querySelector(".js-add-pattern").onclick = () => addPatternRow(patternList);
  (item.patterns || []).forEach((p) => addPatternRow(patternList, p));
  if ((item.patterns || []).length === 0) addPatternRow(patternList);
  const delBtn = row.querySelector("button:last-child");
  delBtn.textContent = t("deleteInlineBtn");
  delBtn.onclick = () => row.remove();
  container.appendChild(row);
  localizeDynamicFields();
}

function addReadonlyInteractionRow(
  containerId,
  item = { state: "", input: "", is_dynamic: false, record_input: true, patterns: [] }
) {
  const container = byId(containerId);
  const row = document.createElement("div");
  row.className = "field-card stack";
  row.innerHTML = `
    <input class="input js-state" data-i18n-ph="fieldState" readonly />
    <input class="input js-input" data-i18n-ph="fieldInput" readonly />
    <label class="check-label"><input type="checkbox" class="check-input js-is-dynamic" disabled /><span data-i18n="fieldIsDynamic">is_dynamic</span></label>
    <label class="check-label"><input type="checkbox" class="check-input js-record-input" disabled /><span data-i18n="fieldRecordInput">record_input</span></label>
    <div class="field-card">
      <div class="field-tools">
        <span class="text-sm text-slate-700" data-i18n="fieldPatterns">patterns</span>
      </div>
      <div class="stack js-pattern-list"></div>
    </div>
  `;
  row.querySelector(".js-state").value = item.state || "";
  row.querySelector(".js-input").value = item.input || "";
  row.querySelector(".js-is-dynamic").checked = !!item.is_dynamic;
  row.querySelector(".js-record-input").checked = item.record_input !== false;
  const patternList = row.querySelector(".js-pattern-list");
  (item.patterns || []).forEach((p) => addReadonlyPatternRow(patternList, p));
  container.appendChild(row);
  localizeDynamicFields();
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
  row.className = "field-card stack";
  row.innerHTML = `
    <input class="input js-from" data-i18n-ph="fieldFrom" />
    <input class="input js-command" data-i18n-ph="fieldCommand" />
    <input class="input js-to" data-i18n-ph="fieldTo" />
    <label class="check-label"><input type="checkbox" class="check-input js-is-exit" /><span data-i18n="fieldIsExit">is_exit</span></label>
    <label class="check-label"><input type="checkbox" class="check-input js-format-sys" /><span data-i18n="fieldFormatSys">format_sys</span></label>
    <button type="button" class="mini-btn delete fit-btn">Delete</button>
  `;
  row.querySelector(".js-from").value = item.from || "";
  row.querySelector(".js-command").value = item.command || "";
  row.querySelector(".js-to").value = item.to || "";
  row.querySelector(".js-is-exit").checked = !!item.is_exit;
  row.querySelector(".js-format-sys").checked = !!item.format_sys;
  const delBtn = row.querySelector("button");
  delBtn.textContent = t("deleteInlineBtn");
  delBtn.onclick = () => row.remove();
  container.appendChild(row);
  localizeDynamicFields();
}

function addReadonlyTransitionRow(
  containerId,
  item = { from: "", command: "", to: "", is_exit: false, format_sys: false }
) {
  const container = byId(containerId);
  const row = document.createElement("div");
  row.className = "field-card stack";
  row.innerHTML = `
    <input class="input js-from" data-i18n-ph="fieldFrom" readonly />
    <input class="input js-command" data-i18n-ph="fieldCommand" readonly />
    <input class="input js-to" data-i18n-ph="fieldTo" readonly />
    <label class="check-label"><input type="checkbox" class="check-input js-is-exit" disabled /><span data-i18n="fieldIsExit">is_exit</span></label>
    <label class="check-label"><input type="checkbox" class="check-input js-format-sys" disabled /><span data-i18n="fieldFormatSys">format_sys</span></label>
  `;
  row.querySelector(".js-from").value = item.from || "";
  row.querySelector(".js-command").value = item.command || "";
  row.querySelector(".js-to").value = item.to || "";
  row.querySelector(".js-is-exit").checked = !!item.is_exit;
  row.querySelector(".js-format-sys").checked = !!item.format_sys;
  container.appendChild(row);
  localizeDynamicFields();
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
  byId("profile-form-name").value = profile.name || "";
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
  return {
    name: byId("profile-form-name").value.trim() || byId("custom-profile-picker").value.trim(),
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
  const out = byId("profile-out");
  if (!name) {
    out.textContent = "profile name is required";
    return;
  }
  out.textContent = t("running");
  try {
    const data = await request(
      "GET",
      `/api/device-profiles/custom/${encodeURIComponent(name)}/form`
    );
    setProfileForm(data);
    out.textContent = `${t("saved")}: ${name}`;
  } catch (e) {
    out.textContent = e.message;
  }
}

async function saveCustomProfile() {
  const out = byId("profile-out");
  out.textContent = t("running");
  try {
    const profile = collectProfileForm();
    const name = (profile.name || "").trim();
    if (!name) {
      out.textContent = "profile name is required";
      return;
    }
    const data = await request(
      "PUT",
      `/api/device-profiles/custom/${encodeURIComponent(name)}/form`,
      profile
    );
    byId("custom-profile-picker").value = name;
    byId("profile-form-name").value = name;
    out.textContent = `${t("saved")}: ${data.path}`;
    await loadProfilesOverview();
  } catch (e) {
    out.textContent = e.message;
  }
}

async function deleteCustomProfile() {
  const name =
    byId("custom-profile-picker").value.trim() ||
    byId("profile-form-name").value.trim();
  const out = byId("profile-out");
  if (!name) {
    out.textContent = "profile name is required";
    return;
  }
  out.textContent = t("running");
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
    out.textContent = `${t("deleted")}: ${name}`;
    await loadProfilesOverview();
  } catch (e) {
    out.textContent = e.message;
  }
}

async function loadTemplates() {
  const out = byId("template-list");
  try {
    const data = await request("GET", "/api/templates");
    cachedTemplates = data.map((item) => item.name);
    renderTemplateOptions(byId("template-pick-name").value || "");
    out.textContent =
      data.map((item) => `- ${item.name} -> ${item.path}`).join("\n") || "-";
  } catch (e) {
    cachedTemplates = [];
    renderTemplateOptions("");
    out.textContent = e.message;
  }
}

function renderTemplateOptions(keyword = "") {
  const q = keyword.trim().toLowerCase();
  const names = cachedTemplates.filter((name) =>
    !q ? true : name.toLowerCase().includes(q)
  );
  byId("template-options").innerHTML = names
    .map((name) => `<option value="${name}"></option>`)
    .join("");
}

async function loadTemplateDetail() {
  const name = byId("template-pick-name").value.trim();
  const out = byId("template-out");
  if (!name) {
    out.textContent = "template name is required";
    return;
  }
  out.textContent = t("running");
  try {
    const data = await request("GET", `/api/templates/${encodeURIComponent(name)}`);
    lastTemplateDetail = data;
    byId("template-pick-name").value = data.name || name;
    byId("template-manage-name").value = data.name || name;
    byId("template-manage-path").value = data.path || "";
    byId("template-content").value = data.content || "";
    out.textContent = `${data.name} -> ${data.path}`;
  } catch (e) {
    lastTemplateDetail = null;
    out.textContent = e.message;
  }
}

async function createTemplate() {
  const name = byId("template-manage-name").value.trim();
  const content = byId("template-content").value;
  const out = byId("template-out");
  if (!name) {
    out.textContent = "template name is required";
    return;
  }
  out.textContent = t("running");
  try {
    const data = await request("POST", "/api/templates", { name, content });
    out.textContent = `${t("created")}: ${data.path}`;
    await loadTemplates();
    byId("template-pick-name").value = name;
    byId("template-manage-name").value = name;
    byId("template-manage-path").value = data.path || "";
  } catch (e) {
    out.textContent = e.message;
  }
}

async function updateTemplate() {
  const name = byId("template-manage-name").value.trim();
  const content = byId("template-content").value;
  const out = byId("template-out");
  if (!name) {
    out.textContent = "template name is required";
    return;
  }
  out.textContent = t("running");
  try {
    const data = await request("PUT", `/api/templates/${encodeURIComponent(name)}`, {
      content,
    });
    out.textContent = `${t("saved")}: ${data.path}`;
    await loadTemplates();
    byId("template-pick-name").value = name;
    byId("template-manage-name").value = name;
    byId("template-manage-path").value = data.path || "";
  } catch (e) {
    out.textContent = e.message;
  }
}

async function deleteTemplate() {
  const name = byId("template-manage-name").value.trim();
  const out = byId("template-out");
  if (!name) {
    out.textContent = "template name is required";
    return;
  }
  out.textContent = t("running");
  try {
    await request("DELETE", `/api/templates/${encodeURIComponent(name)}`);
    byId("template-content").value = "";
    byId("template-manage-path").value = "";
    out.textContent = `${t("deleted")}: ${name}`;
    await loadTemplates();
    if (byId("template-pick-name").value.trim() === name) {
      byId("template-pick-name").value = "";
    }
    byId("template-manage-name").value = "";
    lastTemplateDetail = null;
  } catch (e) {
    out.textContent = e.message;
  }
}

function bindEvents() {
  const langFab = byId("lang-fab");
  const langMenu = byId("lang-menu");

  langFab.onclick = (e) => {
    e.stopPropagation();
    const isHidden = langMenu.hidden;
    if (isHidden) {
      langMenu.hidden = false;
      langMenu.style.display = "";
      langFab.setAttribute("aria-expanded", "true");
    } else {
      langMenu.hidden = true;
      langMenu.style.display = "none";
      langFab.setAttribute("aria-expanded", "false");
    }
  };

  byId("lang-en").onclick = () => {
    currentLang = "en";
    localStorage.setItem("rauto_lang", currentLang);
    applyI18n();
    langMenu.hidden = true;
    langMenu.style.display = "none";
    langFab.setAttribute("aria-expanded", "false");
  };

  byId("lang-zh").onclick = () => {
    currentLang = "zh";
    localStorage.setItem("rauto_lang", currentLang);
    applyI18n();
    langMenu.hidden = true;
    langMenu.style.display = "none";
    langFab.setAttribute("aria-expanded", "false");
  };

  document.addEventListener("click", (e) => {
    if (!langMenu.contains(e.target) && e.target !== langFab) {
      langMenu.hidden = true;
      langMenu.style.display = "none";
      langFab.setAttribute("aria-expanded", "false");
    }
  });

  byId("prompt-mode-view").onclick = () => {
    byId("prompt-view-panel").hidden = false;
    byId("prompt-edit-panel").hidden = true;
    byId("prompt-mode-view").classList.add("is-active");
    byId("prompt-mode-edit").classList.remove("is-active");
  };
  byId("prompt-mode-edit").onclick = () => {
    byId("prompt-view-panel").hidden = true;
    byId("prompt-edit-panel").hidden = false;
    byId("prompt-mode-view").classList.remove("is-active");
    byId("prompt-mode-edit").classList.add("is-active");
  };

  for (const tab of ["ops", "prompts", "templates"]) {
    byId(`tab-${tab}`).onclick = () => {
      currentTab = tab;
      applyTabs();
      if (tab === "prompts") {
        loadProfilesOverview();
        byId("prompt-mode-view").click();
      }
      if (tab === "templates") {
        loadTemplates();
      }
    };
  }

  byId("op-kind-exec").onclick = () => {
    currentOpKind = "exec";
    applyOperationKind();
  };
  byId("op-kind-template").onclick = () => {
    currentOpKind = "template";
    applyOperationKind();
    if (byId("template").value.trim()) {
      loadSelectedTemplateContent();
    }
  };

  byId("connection-test-btn").onclick = async () => {
    const out = byId("connection-test-out");
    out.textContent = t("running");
    try {
      const data = await request("POST", "/api/connection/test", {
        connection: connectionPayload(),
      });
      out.textContent = `${t("connectionOk")}: ${data.username}@${data.host}:${data.port} (${data.device_profile})`;
    } catch (e) {
      out.textContent = e.message;
    }
  };

  byId("render-btn").onclick = async () => {
    const out = byId("render-out");
    out.textContent = t("running");
    try {
      const data = await request("POST", "/api/render", {
        template: byId("template").value.trim(),
        vars: parseVars(),
      });
      out.textContent = data.rendered_commands;
    } catch (e) {
      out.textContent = e.message;
    }
  };

  byId("exec-btn").onclick = async () => {
    const out = byId("exec-out");
    out.textContent = t("running");
    try {
      const data = await request("POST", "/api/exec", {
        command: byId("command").value.trim(),
        mode: byId("mode").value.trim() || null,
        connection: connectionPayload(),
      });
      out.textContent = data.output;
    } catch (e) {
      out.textContent = e.message;
    }
  };

  byId("template-exec-btn").onclick = async () => {
    const out = byId("template-exec-out");
    out.textContent = t("running");
    try {
      const data = await request("POST", "/api/template/execute", {
        template: byId("template").value.trim(),
        vars: parseVars(),
        mode: byId("template-mode").value.trim() || null,
        connection: connectionPayload(),
      });
      out.textContent = JSON.stringify(data, null, 2);
    } catch (e) {
      out.textContent = e.message;
    }
  };

  byId("profile-refresh-btn").onclick = loadProfilesOverview;
  byId("template").onchange = loadSelectedTemplateContent;
  byId("custom-profile-picker").oninput = (e) => {
    renderCustomProfileOptions(e.target.value);
  };
  byId("custom-profile-picker").onchange = async () => {
    if (!byId("custom-profile-picker").value.trim()) return;
    await loadCustomProfile();
  };
  byId("builtin-detail-btn").onclick = loadBuiltinProfileDetail;
  byId("builtin-copy-btn").onclick = () => {
    const out = byId("builtin-detail-status");
    if (!lastBuiltinProfile) {
      out.textContent = t("needLoadBuiltinFirst");
      return;
    }
    const copied = JSON.parse(JSON.stringify(lastBuiltinProfile));
    copied.name = `${copied.name}_custom`;
    setProfileForm(copied);
    byId("custom-profile-picker").value = copied.name;
    byId("prompt-mode-edit").click();
    out.textContent = t("copiedToCustom");
  };
  byId("profile-load-btn").onclick = loadCustomProfile;
  byId("profile-save-btn").onclick = saveCustomProfile;
  byId("profile-delete-btn").onclick = deleteCustomProfile;
  byId("add-more-pattern-btn").onclick = () => addSimpleListRow("profile-more-list");
  byId("add-error-pattern-btn").onclick = () => addSimpleListRow("profile-error-list");
  byId("add-ignore-error-btn").onclick = () => addSimpleListRow("profile-ignore-list");
  byId("add-prompt-row-btn").onclick = () => addPromptRow();
  byId("add-sys-prompt-row-btn").onclick = () => addSysPromptRow();
  byId("add-interaction-row-btn").onclick = () => addInteractionRow();
  byId("add-transition-row-btn").onclick = () => addTransitionRow();

  byId("template-refresh-btn").onclick = loadTemplates;
  byId("template-load-btn").onclick = loadTemplateDetail;
  byId("template-pick-name").oninput = (e) => {
    renderTemplateOptions(e.target.value);
  };
  byId("template-pick-name").onchange = async () => {
    if (!byId("template-pick-name").value.trim()) return;
    await loadTemplateDetail();
  };
  byId("template-create-btn").onclick = createTemplate;
  byId("template-update-btn").onclick = updateTemplate;
  byId("template-delete-btn").onclick = deleteTemplate;
  byId("template-copy-content-btn").onclick = async () => {
    const out = byId("template-out");
    const text = byId("template-content").value || "";
    if (!text.trim()) {
      out.textContent = t("templateNeedLoadFirst");
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      out.textContent = t("templateContentCopied");
    } catch (_) {
      out.textContent = t("requestFailed");
    }
  };
}

bindEvents();
initTopLevelAutocomplete();
initCollapsibleGroups();
applyI18n();
applyTabs();
applyOperationKind();
loadProfilesOverview();
loadTemplates();
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
