function byId(id) {
  return document.getElementById(id);
}

const STORAGE_KEYS = {
  lang: "rauto_lang",
  recordViewMode: "rauto_record_view_mode",
  replayViewMode: "rauto_replay_view_mode",
  recordFailedOnly: "rauto_record_failed_only",
  replayFailedOnly: "rauto_replay_failed_only",
  recordEventKind: "rauto_record_event_kind",
  replayEventKind: "rauto_replay_event_kind",
  recordSearchQuery: "rauto_record_search_query",
  replaySearchQuery: "rauto_replay_search_query",
};

const i18n = {
  en: {
    title: "rauto Web Console",
    subtitle: "Operate existing CLI capabilities from browser UI powered by axum APIs.",
    langFabTitle: "Switch language",
    connectionTitle: "Connection Defaults",
    connectionTestBtn: "Test Connection",
    savedConnTitle: "Saved Connections",
    savedConnNamePlaceholder: "saved connection name",
    savedConnSavePassword: "save password",
    savedConnLoadBtn: "Load",
    savedConnSaveBtn: "Save",
    savedConnDeleteBtn: "Delete",
    savedConnHistoryBtn: "History",
    savedConnRefreshBtn: "Refresh",
    savedConnHistoryEmpty: "no execution history for this connection",
    historyColIndex: "#",
    historyColTime: "Time",
    historyColOperation: "Operation",
    historyColCommand: "Command",
    historyColMode: "Mode",
    historyColProfile: "Target",
    historyColLevel: "Level",
    historyColPath: "Record Path",
    historyDetailTitle: "History Details",
    historyMetaTitle: "Execution Meta",
    historyDetailEmpty: "no event entries in this record",
    historyDeleteBtn: "Delete",
    historyDeleteConfirm: "Delete this history record?",
    historyDeleteDone: "history record deleted",
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
    promptModeView: "View",
    promptModeEdit: "Edit",
    builtinTitle: "Built-in Profiles",
    builtinFieldName: "name",
    builtinFieldAliases: "aliases",
    builtinFieldSummary: "summary",
    builtinFieldSource: "source",
    builtinFieldNotes: "notes",
    customTitle: "Custom Profiles",
    templateMgrTitle: "Template Manager",
    templateListTitle: "Templates",
    templateEditorTitle: "Editor",
    templateManagePathPlaceholder: "template path (auto)",
    templateViewContentLabel: "Template Content",
    renderBtn: "Preview Render",
    execBtn: "Execute",
    templateExecBtn: "Run Template",
    recordingTitle: "Session Recording",
    recordViewLabel: "Display",
    replayViewLabel: "Display",
    viewList: "List",
    viewRaw: "Raw",
    failedOnly: "Failed only",
    eventTypeAll: "All events",
    eventTypeLabel: "Type",
    searchPlaceholder: "search command/content",
    clearFilters: "Clear",
    recordEnableLabel: "Disable recording",
    recordJsonlPlaceholder: "recording JSONL output",
    recordCopyBtn: "Copy Recording",
    recordUseReplayBtn: "Use In Replay",
    replayTitle: "Session Replay",
    replayJsonlPlaceholder: "paste recording JSONL",
    replayCommandPlaceholder: "command to replay, e.g. show version",
    replayModePlaceholder: "mode for replay (optional)",
    replayListBtn: "List Records",
    replayRunBtn: "Replay Command",
    replayNoJsonl: "replay JSONL is required",
    replayNoCommand: "replay command is required",
    replayListEmpty: "no command_output entries",
    replayListNoData: "no replay result",
    recordListEmpty: "no recording data",
    recordParseError: "recording JSONL parse failed",
    noFailedEntries: "no failed command events",
    noMatchedEntries: "no matched events",
    replayContextTitle: "Context",
    replayEntriesTitle: "Entries",
    replayOutputTitle: "Replay Output",
    statTotal: "Total",
    statCommandEvents: "Command Events",
    statFailedEvents: "Failed",
    statKinds: "Kinds",
    tableIndex: "#",
    tableEvent: "Event",
    tableCommand: "Command",
    tableMode: "Mode",
    tableSuccess: "Success",
    tablePromptFlow: "Prompt Flow",
    tableFsmFlow: "FSM Flow",
    flowBefore: "Before",
    flowAfter: "After",
    tableAction: "Action",
    actionViewDetail: "View Detail",
    detailModalTitle: "Entry Details",
    detailModalClose: "Close",
    entryDrawerTitle: "Event Details",
    entryDrawerClose: "Close",
    detailSectionBasic: "Basic",
    detailSectionFlow: "Prompt/FSM Flow",
    detailSectionOutput: "Command Output",
    detailSectionRaw: "Raw Content",
    detailLabelKind: "Event Kind",
    detailLabelSuccess: "Success",
    detailLabelCommand: "Command",
    detailLabelMode: "Mode",
    detailLabelPrompt: "Prompt",
    detailLabelFsmPrompt: "FSM Prompt",
    detailLabelDevice: "Device",
    detailLabelTimestamp: "Timestamp",
    detailLabelRecordLevel: "Record Level",
    detailLabelError: "Error",
    tableDetail: "Details",
    recordingCopied: "recording copied",
    recordingSetToReplay: "recording moved to replay",
    profileLoadBtn: "Load",
    profileRefreshBtn: "Refresh",
    profileSaveBtn: "Save",
    profileDeleteBtn: "Delete",
    promptModeDiagnose: "Diagnose",
    profileDiagnoseTitle: "State Machine Diagnose",
    profileDiagnoseBtn: "Diagnose",
    profileDiagnoseResultTitle: "Diagnose Result",
    diagnoseOk: "Healthy",
    diagnoseBad: "Issues Found",
    profileNameRequired: "profile name is required",
    diagTotalStates: "Total States",
    diagGraphStates: "States In Graph",
    diagEntryStates: "Entry States",
    diagIssues: "Issue Count",
    diagUnreachableStates: "Unreachable States",
    diagDeadEndStates: "Dead-End States",
    diagMissingEdgeSources: "Missing Edge Sources",
    diagMissingEdgeTargets: "Missing Edge Targets",
    diagAmbiguousPromptStates: "Ambiguous Prompt States",
    diagSummaryProfile: "Profile",
    diagSummaryIssueCount: "Issue Count",
    builtinDetailBtn: "View Detail",
    builtinCopyBtn: "Copy To Custom Form",
    templateLoadBtn: "Load",
    templateRefreshBtn: "Refresh",
    templateSaveBtn: "Save",
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
    profileMorePatternsPlaceholder: "more_patterns: one per line",
    profileErrorPatternsPlaceholder: "error_patterns: one per line",
    profileIgnoreErrorsPlaceholder: "ignore_errors: one per line",
    profilePromptsPlaceholder: 'prompts JSON array, e.g. [{"state":"Enable","patterns":["^...$"]}]',
    profileSysPromptsPlaceholder: "sys_prompts JSON array",
    profileInteractionsPlaceholder: "interactions JSON array",
    profileTransitionsPlaceholder: "transitions JSON array",
    templateContentPlaceholder: "Template content",
    running: "running...",
    requestFailed: "Request failed",
    connectionNameRequired: "connection name is required",
    saved: "Saved",
    deleted: "Deleted",
    created: "Created",
    connectionOk: "Connection successful",
    loaded: "Loaded",
    needLoadBuiltinFirst: "Load builtin detail first",
    copiedToCustom: "Copied to custom form",
    templateCopiedToEdit: "Copied to create/update editor",
  },
  zh: {
    title: "rauto Web 控制台",
    subtitle: "通过 axum API 在浏览器中操作现有 CLI 功能。",
    langFabTitle: "切换语言",
    connectionTitle: "连接默认参数",
    connectionTestBtn: "测试连接",
    savedConnTitle: "已保存连接",
    savedConnNamePlaceholder: "连接配置名称",
    savedConnSavePassword: "保存密码",
    savedConnLoadBtn: "加载",
    savedConnSaveBtn: "保存",
    savedConnDeleteBtn: "删除",
    savedConnHistoryBtn: "历史",
    savedConnRefreshBtn: "刷新",
    savedConnHistoryEmpty: "该连接暂无执行历史",
    historyColIndex: "序号",
    historyColTime: "时间",
    historyColOperation: "操作",
    historyColCommand: "命令",
    historyColMode: "模式",
    historyColProfile: "目标",
    historyColLevel: "录制级别",
    historyColPath: "录制文件",
    historyDetailTitle: "历史详情",
    historyMetaTitle: "执行元数据",
    historyDetailEmpty: "该记录没有 event 明细",
    historyDeleteBtn: "删除",
    historyDeleteConfirm: "确认删除这条历史记录？",
    historyDeleteDone: "历史记录已删除",
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
    promptModeView: "查看详情",
    promptModeEdit: "新增/修改",
    builtinTitle: "内置 Profile",
    builtinFieldName: "名称",
    builtinFieldAliases: "别名",
    builtinFieldSummary: "摘要",
    builtinFieldSource: "来源",
    builtinFieldNotes: "说明",
    customTitle: "自定义 Profile",
    templateMgrTitle: "Template 管理",
    templateListTitle: "Template 列表",
    templateEditorTitle: "编辑器",
    templateManagePathPlaceholder: "template 路径（自动）",
    templateViewContentLabel: "模板内容",
    renderBtn: "预览渲染",
    execBtn: "执行",
    templateExecBtn: "运行模板",
    recordingTitle: "会话录制",
    recordViewLabel: "展示模式",
    replayViewLabel: "展示模式",
    viewList: "列表",
    viewRaw: "原始",
    failedOnly: "仅失败项",
    eventTypeAll: "全部事件",
    eventTypeLabel: "类型",
    searchPlaceholder: "搜索命令/内容",
    clearFilters: "清空筛选",
    recordEnableLabel: "关闭录制",
    recordJsonlPlaceholder: "录制 JSONL 输出",
    recordCopyBtn: "复制录制",
    recordUseReplayBtn: "用于回放",
    replayTitle: "会话回放",
    replayJsonlPlaceholder: "粘贴录制 JSONL",
    replayCommandPlaceholder: "回放命令，例如 show version",
    replayModePlaceholder: "回放模式（可选）",
    replayListBtn: "列出记录",
    replayRunBtn: "回放命令",
    replayNoJsonl: "回放 JSONL 不能为空",
    replayNoCommand: "回放命令不能为空",
    replayListEmpty: "没有 command_output 记录",
    replayListNoData: "暂无回放结果",
    recordListEmpty: "暂无录制数据",
    recordParseError: "录制 JSONL 解析失败",
    noFailedEntries: "没有失败命令事件",
    noMatchedEntries: "没有匹配事件",
    replayContextTitle: "上下文",
    replayEntriesTitle: "事件列表",
    replayOutputTitle: "回放输出",
    statTotal: "总数",
    statCommandEvents: "命令事件",
    statFailedEvents: "失败数",
    statKinds: "事件类型",
    tableIndex: "序号",
    tableEvent: "事件",
    tableCommand: "命令",
    tableMode: "模式",
    tableSuccess: "成功",
    tablePromptFlow: "Prompt 变化",
    tableFsmFlow: "FSM 变化",
    flowBefore: "变更前",
    flowAfter: "变更后",
    tableAction: "操作",
    actionViewDetail: "查看详情",
    detailModalTitle: "记录详情",
    detailModalClose: "关闭",
    entryDrawerTitle: "事件详情",
    entryDrawerClose: "关闭",
    detailSectionBasic: "基础信息",
    detailSectionFlow: "Prompt/FSM 变化",
    detailSectionOutput: "命令输出",
    detailSectionRaw: "原始内容",
    detailLabelKind: "事件类型",
    detailLabelSuccess: "是否成功",
    detailLabelCommand: "命令",
    detailLabelMode: "模式",
    detailLabelPrompt: "Prompt",
    detailLabelFsmPrompt: "FSM Prompt",
    detailLabelDevice: "设备",
    detailLabelTimestamp: "时间",
    detailLabelRecordLevel: "录制级别",
    detailLabelError: "错误",
    tableDetail: "详情",
    recordingCopied: "录制内容已复制",
    recordingSetToReplay: "录制内容已填入回放",
    profileLoadBtn: "加载",
    profileRefreshBtn: "刷新",
    profileSaveBtn: "保存",
    profileDeleteBtn: "删除",
    promptModeDiagnose: "诊断",
    profileDiagnoseTitle: "状态机诊断",
    profileDiagnoseBtn: "诊断",
    profileDiagnoseResultTitle: "诊断结果",
    diagnoseOk: "健康",
    diagnoseBad: "发现问题",
    profileNameRequired: "profile 名称不能为空",
    diagTotalStates: "状态总数",
    diagGraphStates: "参与图构建的状态数",
    diagEntryStates: "入口状态数",
    diagIssues: "问题计数",
    diagUnreachableStates: "不可达状态",
    diagDeadEndStates: "无后继状态（死胡同）",
    diagMissingEdgeSources: "缺失的边起点",
    diagMissingEdgeTargets: "缺失的边终点",
    diagAmbiguousPromptStates: "可能歧义的提示状态",
    diagSummaryProfile: "诊断对象",
    diagSummaryIssueCount: "问题计数",
    builtinDetailBtn: "查看详情",
    builtinCopyBtn: "复制到新增/修改",
    templateLoadBtn: "加载",
    templateRefreshBtn: "刷新",
    templateSaveBtn: "保存",
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
    profileMorePatternsPlaceholder: "more_patterns：每行一个",
    profileErrorPatternsPlaceholder: "error_patterns：每行一个",
    profileIgnoreErrorsPlaceholder: "ignore_errors：每行一个",
    profilePromptsPlaceholder: 'prompts JSON 数组，例如 [{"state":"Enable","patterns":["^...$"]}]',
    profileSysPromptsPlaceholder: "sys_prompts JSON 数组",
    profileInteractionsPlaceholder: "interactions JSON 数组",
    profileTransitionsPlaceholder: "transitions JSON 数组",
    templateContentPlaceholder: "Template 内容",
    running: "执行中...",
    requestFailed: "请求失败",
    connectionNameRequired: "连接配置名称不能为空",
    saved: "已保存",
    deleted: "已删除",
    created: "已创建",
    connectionOk: "连接成功",
    loaded: "已加载",
    needLoadBuiltinFirst: "请先加载内置详情",
    copiedToCustom: "已复制到新增/修改表单",
    templateCopiedToEdit: "已复制到新增/修改编辑区",
  },
};

let currentLang = localStorage.getItem(STORAGE_KEYS.lang) || "zh";
let currentTab = "ops";
let currentOpKind = "exec";
let currentPromptMode = "view";
let cachedSavedConnections = [];
let cachedCustomProfiles = [];
let cachedDeviceProfiles = [];
let cachedTemplates = [];
let lastBuiltinProfile = null;
let lastTemplateDetail = null;
let recordViewMode = localStorage.getItem(STORAGE_KEYS.recordViewMode) || "list";
let replayViewMode = localStorage.getItem(STORAGE_KEYS.replayViewMode) || "list";
let lastReplayResult = null;
let recordFailedOnly = localStorage.getItem(STORAGE_KEYS.recordFailedOnly) === "true";
let replayFailedOnly = localStorage.getItem(STORAGE_KEYS.replayFailedOnly) === "true";
let recordEventKind = localStorage.getItem(STORAGE_KEYS.recordEventKind) || "all";
let replayEventKind = localStorage.getItem(STORAGE_KEYS.replayEventKind) || "all";
let recordSearchQuery = localStorage.getItem(STORAGE_KEYS.recordSearchQuery) || "";
let replaySearchQuery = localStorage.getItem(STORAGE_KEYS.replaySearchQuery) || "";
let detailEntrySeq = 0;
const detailEntryMap = new Map();
const autocompleteMenus = [];
const ALLOWED_EVENT_KINDS = new Set([
  "all",
  "command_output",
  "connection_established",
  "connection_closed",
  "prompt_changed",
  "state_changed",
  "raw_chunk",
]);

function saveFilterPrefs() {
  localStorage.setItem(STORAGE_KEYS.recordViewMode, recordViewMode);
  localStorage.setItem(STORAGE_KEYS.replayViewMode, replayViewMode);
  localStorage.setItem(STORAGE_KEYS.recordFailedOnly, String(recordFailedOnly));
  localStorage.setItem(STORAGE_KEYS.replayFailedOnly, String(replayFailedOnly));
  localStorage.setItem(STORAGE_KEYS.recordEventKind, recordEventKind);
  localStorage.setItem(STORAGE_KEYS.replayEventKind, replayEventKind);
  localStorage.setItem(STORAGE_KEYS.recordSearchQuery, recordSearchQuery);
  localStorage.setItem(STORAGE_KEYS.replaySearchQuery, replaySearchQuery);
}

function normalizeFilterPrefs() {
  if (recordViewMode !== "list" && recordViewMode !== "raw") recordViewMode = "list";
  if (replayViewMode !== "list" && replayViewMode !== "raw") replayViewMode = "list";
  if (!ALLOWED_EVENT_KINDS.has(recordEventKind)) recordEventKind = "all";
  if (!ALLOWED_EVENT_KINDS.has(replayEventKind)) replayEventKind = "all";
}

function t(key) {
  return i18n[currentLang][key] || i18n.en[key] || key;
}

function setPanelVisible(el, visible, displayValue = "block") {
  if (!el) return;
  el.hidden = !visible;
  el.classList.toggle("hidden", !visible);
  el.style.display = visible ? displayValue : "none";
}

function setEventKindOptions(id, selected) {
  const sel = byId(id);
  if (!sel) return;
  const options = [
    ["all", t("eventTypeAll")],
    ["command_output", "command_output"],
    ["connection_established", "connection_established"],
    ["connection_closed", "connection_closed"],
    ["prompt_changed", "prompt_changed"],
    ["state_changed", "state_changed"],
    ["raw_chunk", "raw_chunk"],
  ];
  sel.innerHTML = options
    .map(([value, label]) => `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`)
    .join("");
  sel.value = selected || "all";
}

function applyI18n() {
  byId("title").textContent = t("title");
  byId("subtitle").textContent = t("subtitle");
  byId("lang-fab").title = t("langFabTitle");
  byId("lang-fab").setAttribute("aria-label", t("langFabTitle"));
  byId("connection-title").textContent = t("connectionTitle");
  byId("connection-test-btn").textContent = t("connectionTestBtn");
  byId("saved-conn-title").textContent = t("savedConnTitle");
  byId("saved-conn-save-password-label").textContent = t("savedConnSavePassword");
  byId("saved-conn-save-btn").textContent = t("savedConnSaveBtn");
  byId("saved-conn-delete-btn").textContent = t("savedConnDeleteBtn");
  byId("saved-conn-history-btn").textContent = t("savedConnHistoryBtn");
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
  byId("prompt-mode-view").textContent = t("promptModeView");
  byId("prompt-mode-edit").textContent = t("promptModeEdit");
  byId("prompt-mode-diagnose").textContent = t("promptModeDiagnose");
  byId("builtin-title").textContent = t("builtinTitle");
  byId("custom-title").textContent = t("customTitle");
  byId("template-mgr-title").textContent = t("templateMgrTitle");
  byId("template-list-title").textContent = t("templateListTitle");
  byId("template-editor-title").textContent = t("templateEditorTitle");

  byId("render-btn").textContent = t("renderBtn");
  byId("exec-btn").textContent = t("execBtn");
  byId("template-exec-btn").textContent = t("templateExecBtn");
  byId("recording-title").textContent = t("recordingTitle");
  byId("record-view-label").textContent = t("recordViewLabel");
  byId("record-view-list").textContent = t("viewList");
  byId("record-view-raw").textContent = t("viewRaw");
  byId("record-failed-only-label").textContent = t("failedOnly");
  byId("record-event-kind").setAttribute("aria-label", t("eventTypeLabel"));
  byId("record-search").placeholder = t("searchPlaceholder");
  byId("record-clear-filters").textContent = t("clearFilters");
  byId("record-enable-label").textContent = t("recordEnableLabel");
  byId("record-copy-btn").textContent = t("recordCopyBtn");
  byId("record-use-replay-btn").textContent = t("recordUseReplayBtn");
  byId("replay-title").textContent = t("replayTitle");
  byId("replay-view-label").textContent = t("replayViewLabel");
  byId("replay-view-list").textContent = t("viewList");
  byId("replay-view-raw").textContent = t("viewRaw");
  byId("replay-failed-only-label").textContent = t("failedOnly");
  byId("replay-event-kind").setAttribute("aria-label", t("eventTypeLabel"));
  byId("replay-search").placeholder = t("searchPlaceholder");
  byId("replay-clear-filters").textContent = t("clearFilters");
  byId("replay-list-btn").textContent = t("replayListBtn");
  byId("replay-run-btn").textContent = t("replayRunBtn");
  byId("detail-modal-title").textContent = t("detailModalTitle");
  byId("detail-modal-close").textContent = t("detailModalClose");
  byId("entry-drawer-title").textContent = t("entryDrawerTitle");
  byId("entry-drawer-close").textContent = t("entryDrawerClose");
  byId("profile-save-btn").textContent = t("profileSaveBtn");
  byId("profile-delete-btn").textContent = t("profileDeleteBtn");
  byId("profile-diagnose-title").textContent = t("profileDiagnoseTitle");
  byId("profile-diagnose-btn").textContent = t("profileDiagnoseBtn");
  byId("profile-diagnose-result-title").textContent = t("profileDiagnoseResultTitle");
  byId("diag-k-total").textContent = t("diagTotalStates");
  byId("diag-k-graph").textContent = t("diagGraphStates");
  byId("diag-k-entry").textContent = t("diagEntryStates");
  byId("diag-k-issues").textContent = t("diagIssues");
  byId("diag-l-unreach").textContent = t("diagUnreachableStates");
  byId("diag-l-deadend").textContent = t("diagDeadEndStates");
  byId("diag-l-missing-src").textContent = t("diagMissingEdgeSources");
  byId("diag-l-missing-tgt").textContent = t("diagMissingEdgeTargets");
  byId("diag-l-ambiguous").textContent = t("diagAmbiguousPromptStates");
  byId("builtin-detail-btn").textContent = t("builtinDetailBtn");
  byId("builtin-copy-btn").textContent = t("builtinCopyBtn");
  byId("template-save-btn").textContent = t("templateSaveBtn");
  byId("template-delete-btn").textContent = t("templateDeleteBtn");
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
  byId("saved-conn-name").placeholder = t("savedConnNamePlaceholder");
  byId("template").placeholder = t("templatePlaceholder");
  byId("template-selected-content").placeholder = t("templateSelectedContentPlaceholder");
  byId("record-jsonl").placeholder = t("recordJsonlPlaceholder");
  byId("replay-jsonl").placeholder = t("replayJsonlPlaceholder");
  byId("replay-command").placeholder = t("replayCommandPlaceholder");
  byId("replay-mode").placeholder = t("replayModePlaceholder");
  byId("vars").placeholder = t("varsPlaceholder");
  byId("command").placeholder = t("commandPlaceholder");
  byId("mode").placeholder = t("modePlaceholder");
  byId("template-mode").placeholder = t("templateModePlaceholder");
  byId("custom-profile-picker").placeholder = t("customProfilePickerPlaceholder");
  byId("profile-diagnose-picker").placeholder = t("customProfilePickerPlaceholder");
  byId("builtin-detail-name").placeholder = t("builtinFieldName");
  byId("builtin-detail-aliases").placeholder = t("builtinFieldAliases");
  byId("builtin-detail-summary").placeholder = t("builtinFieldSummary");
  byId("builtin-detail-source").placeholder = t("builtinFieldSource");
  byId("builtin-detail-notes").placeholder = t("builtinFieldNotes");
  byId("template-pick-name").placeholder = t("templateViewPickerPlaceholder");
  renderCustomProfileOptions();
  renderDiagnoseProfileOptions();
  renderTemplateOptions();
  byId("template-manage-path").placeholder = t("templateManagePathPlaceholder");
  byId("template-content").placeholder = t("templateContentPlaceholder");
  setEventKindOptions("record-event-kind", recordEventKind);
  setEventKindOptions("replay-event-kind", replayEventKind);
  localizeDynamicFields();
  renderRecordingView();
  renderReplayView();

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

function applyPromptMode() {
  const modes = ["view", "edit", "diagnose"];
  for (const mode of modes) {
    const btn = byId(`prompt-mode-${mode}`);
    const panel = byId(`prompt-${mode}-panel`);
    const active = mode === currentPromptMode;
    btn.classList.toggle("is-active", active);
    panel.hidden = !active;
    panel.style.display = active ? "" : "none";
  }
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
  const connectionName = value("saved-conn-name");
  return {
    connection_name: connectionName || null,
    host: value("host") || null,
    port: Number.isFinite(parsedPort) ? parsedPort : 22,
    username: value("username") || null,
    password: value("password") || null,
    enable_password: value("enable_password") || null,
    device_profile: value("device_profile") || null,
  };
}

function recordLevelPayload() {
  if (byId("record-enable").checked) return "off";
  const level = (byId("record-level").value || "key-events-only").trim();
  if (!level || level === "off") return null;
  return level;
}

function safeString(value) {
  if (value == null) return "-";
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

function displayMode(mode) {
  const raw = String(mode || "").trim();
  return raw;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function parseJsonl(jsonl) {
  const rows = [];
  const text = (jsonl || "").trim();
  if (!text) {
    return { ok: true, rows };
  }
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line) continue;
    try {
      rows.push(JSON.parse(line));
    } catch (err) {
      return { ok: false, error: `${t("recordParseError")}: line ${i + 1}` };
    }
  }
  return { ok: true, rows };
}

function isFailedCommandEvent(entry) {
  const event = (entry && entry.event) || {};
  return event.kind === "command_output" && event.success === false;
}

function matchesSearch(entry, query) {
  const q = (query || "").trim().toLowerCase();
  if (!q) return true;
  const event = (entry && entry.event) || {};
  const fields = [
    event.kind,
    event.command,
    event.mode,
    event.content,
    event.all,
    event.prompt_before,
    event.prompt_after,
    event.fsm_prompt_before,
    event.fsm_prompt_after,
    event.device_addr,
    event.reason,
  ];
  const haystack = fields
    .filter((v) => v != null)
    .map((v) => String(v).toLowerCase())
    .join("\n");
  return haystack.includes(q);
}

function filterEntries(entries, kindFilter, failedOnly, query) {
  return (entries || []).filter((entry) => {
    const event = (entry && entry.event) || {};
    const kindOk = !kindFilter || kindFilter === "all" ? true : event.kind === kindFilter;
    const failedOk = failedOnly ? isFailedCommandEvent(entry) : true;
    const queryOk = matchesSearch(entry, query);
    return kindOk && failedOk && queryOk;
  });
}

function buildEventStats(entries) {
  const kinds = new Set();
  let commandEvents = 0;
  let failedEvents = 0;
  for (const entry of entries) {
    const event = (entry && entry.event) || {};
    const kind = event.kind || "unknown";
    kinds.add(kind);
    if (kind === "command_output") {
      commandEvents += 1;
      if (event.success === false) {
        failedEvents += 1;
      }
    }
  }
  return {
    total: entries.length,
    commandEvents,
    failedEvents,
    kinds: kinds.size,
  };
}

function renderStatsCards(stats) {
  const cards = [
    [t("statTotal"), stats.total],
    [t("statCommandEvents"), stats.commandEvents],
    [t("statFailedEvents"), stats.failedEvents],
    [t("statKinds"), stats.kinds],
  ];
  return `
    <div class="grid gap-2 md:grid-cols-4">
      ${cards
        .map(
          ([label, value]) => `
            <div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <div class="text-xs text-slate-500">${escapeHtml(label)}</div>
              <div class="mt-1 text-lg font-semibold text-slate-900">${escapeHtml(value)}</div>
            </div>
          `
        )
        .join("")}
    </div>
  `;
}

function successBadge(event) {
  if (event.kind !== "command_output") return '<span class="text-slate-400">-</span>';
  if (event.success) {
    return '<span class="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">OK</span>';
  }
  return '<span class="inline-flex items-center rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700">FAIL</span>';
}

function renderFlowCell(beforeValue, afterValue, tone = "slate") {
  const before = escapeHtml(safeString(beforeValue));
  const after = escapeHtml(safeString(afterValue));
  const beforeCls =
    tone === "teal"
      ? "border-cyan-200 bg-cyan-50 text-cyan-800"
      : "border-indigo-200 bg-indigo-50 text-indigo-800";
  const afterCls =
    tone === "teal"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : "border-amber-200 bg-amber-50 text-amber-800";
  const markerCls = tone === "teal" ? "bg-emerald-400" : "bg-amber-400";
  return `
    <div class="min-w-[180px] rounded-lg border border-slate-200 bg-slate-50 px-2 py-2">
      <div class="rounded-md border ${beforeCls} px-2 py-1">
        <div class="text-[10px] font-semibold uppercase tracking-wide opacity-70">${escapeHtml(
          t("flowBefore")
        )}</div>
        <div class="mt-0.5 font-mono text-xs break-all">${before}</div>
      </div>
      <div class="my-1 flex items-center gap-1 px-1">
        <span class="h-2 w-2 rounded-full ${markerCls}"></span>
        <span class="h-[2px] flex-1 rounded ${markerCls}"></span>
        <span class="h-2 w-2 rounded-full ${markerCls}"></span>
      </div>
      <div class="rounded-md border ${afterCls} px-2 py-1">
        <div class="text-[10px] font-semibold uppercase tracking-wide opacity-70">${escapeHtml(
          t("flowAfter")
        )}</div>
        <div class="mt-0.5 font-mono text-xs break-all">${after}</div>
      </div>
    </div>
  `;
}

function renderEntriesTable(entries) {
  const baseSeq = detailEntrySeq;
  const rows = entries
    .map((entry, idx) => {
      const event = (entry && entry.event) || {};
      const kind = safeString(event.kind);
      const command = event.kind === "command_output" ? safeString(event.command) : "-";
      const modeRaw = event.kind === "command_output" ? displayMode(event.mode) : "-";
      const mode = modeRaw || "-";
      const detailId = `entry-${baseSeq + idx}`;
      detailEntryMap.set(detailId, entry);
      const isFailed = event.kind === "command_output" && event.success === false;
      return `
        <tr class="align-top ${isFailed ? "bg-rose-50/60 hover:bg-rose-50 border-l-4 border-rose-400" : "hover:bg-slate-50/80"}">
          <td class="whitespace-nowrap px-3 py-2 text-slate-500">${idx + 1}</td>
          <td class="px-3 py-2 font-medium text-slate-800">${escapeHtml(kind)}</td>
          <td class="min-w-[320px] max-w-[420px] px-3 py-2 font-mono text-xs text-slate-700 break-all">${escapeHtml(command)}</td>
          <td class="px-3 py-2 font-mono text-xs text-slate-700">${escapeHtml(mode)}</td>
          <td class="px-3 py-2">${successBadge(event)}</td>
          <td class="px-3 py-2">${renderFlowCell(event.prompt_before, event.prompt_after, "indigo")}</td>
          <td class="px-3 py-2">${renderFlowCell(event.fsm_prompt_before, event.fsm_prompt_after, "teal")}</td>
          <td class="whitespace-nowrap px-3 py-2">
            <button class="mini-btn js-entry-detail-btn" type="button" data-detail-id="${escapeHtml(
              detailId
            )}">${escapeHtml(t("actionViewDetail"))}</button>
          </td>
        </tr>
      `;
    })
    .join("");
  detailEntrySeq += entries.length;

  return `
    <div class="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table class="min-w-[1320px] table-fixed text-sm">
        <thead class="bg-slate-100 text-xs font-semibold text-slate-600">
          <tr>
            <th class="px-3 py-2 text-left">${escapeHtml(t("tableIndex"))}</th>
            <th class="px-3 py-2 text-left">${escapeHtml(t("tableEvent"))}</th>
            <th class="px-3 py-2 text-left">${escapeHtml(t("tableCommand"))}</th>
            <th class="px-3 py-2 text-left">${escapeHtml(t("tableMode"))}</th>
            <th class="px-3 py-2 text-left">${escapeHtml(t("tableSuccess"))}</th>
            <th class="px-3 py-2 text-left">${escapeHtml(t("tablePromptFlow"))}</th>
            <th class="px-3 py-2 text-left">${escapeHtml(t("tableFsmFlow"))}</th>
            <th class="px-3 py-2 text-left">${escapeHtml(t("tableAction"))}</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-200">
          ${rows}
        </tbody>
      </table>
    </div>
  `;
}

function renderRecordingView() {
  const listOut = byId("record-list-out");
  const rawOut = byId("record-jsonl");
  const listBtn = byId("record-view-list");
  const rawBtn = byId("record-view-raw");
  const isList = recordViewMode === "list";
  listBtn.classList.toggle("is-active", isList);
  rawBtn.classList.toggle("is-active", !isList);
  setPanelVisible(listOut, isList, "grid");
  setPanelVisible(rawOut, !isList, "block");

  if (!isList) return;

  const parsed = parseJsonl(rawOut.value || "");
  if (!parsed.ok) {
    listOut.innerHTML = `<div class="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">${escapeHtml(
      parsed.error
    )}</div>`;
    return;
  }
  const entries = filterEntries(parsed.rows, recordEventKind, recordFailedOnly, recordSearchQuery);
  if (!entries.length) {
    listOut.innerHTML = `<div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">${escapeHtml(
      recordFailedOnly
        ? t("noFailedEntries")
        : recordEventKind !== "all"
          ? t("noMatchedEntries")
          : t("recordListEmpty")
    )}</div>`;
    return;
  }
  const stats = buildEventStats(entries);
  listOut.innerHTML = `${renderStatsCards(stats)}${renderEntriesTable(entries)}`;
}

function applyRecordingFromResponse(data) {
  const jsonl = data && data.recording_jsonl ? String(data.recording_jsonl) : "";
  if (jsonl) {
    byId("record-jsonl").value = jsonl;
    renderRecordingView();
  }
}

function applyConnectionForm(connection = {}) {
  byId("host").value = connection.host || "";
  byId("port").value = connection.port != null ? String(connection.port) : "";
  byId("username").value = connection.username || "";
  byId("password").value = connection.password || "";
  byId("enable_password").value = connection.enable_password || "";
  byId("device_profile").value = connection.device_profile || "";
}

function formatHistoryTime(tsMs) {
  const n = Number(tsMs);
  if (!Number.isFinite(n) || n <= 0) return "-";
  return new Date(n).toLocaleString();
}

function historyOperationLabel(raw) {
  const op = safeString(raw).toLowerCase();
  if (op === "exec") {
    return currentLang === "zh" ? "命令执行" : "Execute";
  }
  if (op === "template_execute") {
    return currentLang === "zh" ? "模板执行" : "Template Execute";
  }
  return op || "-";
}

function historyOperationBadge(raw) {
  const op = safeString(raw).toLowerCase();
  const label = historyOperationLabel(op);
  const cls =
    op === "template_execute"
      ? "bg-cyan-100 text-cyan-800 border-cyan-200"
      : "bg-indigo-100 text-indigo-800 border-indigo-200";
  return `<span class="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${cls}">${escapeHtml(
    label
  )}</span>`;
}

function historyModeBadge(mode) {
  const value = displayMode(mode);
  if (!value) {
    return '<span class="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">-</span>';
  }
  return `<span class="inline-flex items-center rounded-full border border-amber-200 bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">${escapeHtml(
    value
  )}</span>`;
}

function historyRecordLevelBadge(level) {
  const value = safeString(level).toLowerCase();
  const cls =
    value === "full"
      ? "border-violet-200 bg-violet-100 text-violet-800"
      : value === "off"
        ? "border-slate-200 bg-slate-100 text-slate-600"
        : "border-emerald-200 bg-emerald-100 text-emerald-800";
  return `<span class="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${cls}">${escapeHtml(
    value || "-"
  )}</span>`;
}

function historyTargetCell(item) {
  const name = safeString(item.connection_name || "-");
  const host = safeString(item.host);
  const port = safeString(item.port);
  const profile = safeString(item.device_profile);
  return `
    <div class="grid gap-1">
      <div>
        <span class="inline-flex items-center rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-slate-700">${escapeHtml(
          name
        )}</span>
      </div>
      <div class="font-mono text-xs text-slate-700 break-all">${escapeHtml(`${host}:${port}`)}</div>
      <div class="text-xs text-slate-500 break-all">${escapeHtml(profile)}</div>
    </div>
  `;
}

function renderConnectionHistoryTable(items) {
  const sorted = [...items].sort((a, b) => Number(a.ts_ms || 0) - Number(b.ts_ms || 0));
  const rows = sorted
    .map((item, idx) => {
      return `
        <tr class="align-top hover:bg-slate-50/80">
          <td class="whitespace-nowrap px-3 py-2 text-slate-500">${idx + 1}</td>
          <td class="whitespace-nowrap px-3 py-2 text-slate-700">
            <div class="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700">${escapeHtml(
              formatHistoryTime(item.ts_ms)
            )}</div>
          </td>
          <td class="px-3 py-2">${historyOperationBadge(item.operation)}</td>
          <td class="max-w-[380px] px-3 py-2">
            <div class="rounded-lg border border-slate-200 bg-white px-2 py-1.5 font-mono text-xs text-slate-700 break-all">${escapeHtml(
              safeString(item.command_label)
            )}</div>
          </td>
          <td class="px-3 py-2">${historyModeBadge(item.mode)}</td>
          <td class="max-w-[260px] px-3 py-2">${historyTargetCell(item)}</td>
          <td class="px-3 py-2">${historyRecordLevelBadge(item.record_level)}</td>
          <td class="max-w-[380px] px-3 py-2">
            <div class="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 font-mono text-[11px] text-slate-600 break-all">${escapeHtml(
              safeString(item.record_path)
            )}</div>
          </td>
          <td class="whitespace-nowrap px-3 py-2">
            <div class="inline-flex items-center gap-2">
              <button class="mini-btn js-history-detail-btn" type="button" data-history-id="${escapeHtml(
                safeString(item.id)
              )}">${escapeHtml(t("actionViewDetail"))}</button>
              <button class="mini-btn delete js-history-delete-btn" type="button" data-history-id="${escapeHtml(
                safeString(item.id)
              )}">${escapeHtml(t("historyDeleteBtn"))}</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");

  return `
    <div class="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table class="min-w-[1320px] table-fixed text-sm">
        <thead class="bg-slate-100 text-xs font-semibold text-slate-600">
          <tr>
            <th class="px-3 py-2 text-left">${escapeHtml(t("historyColIndex"))}</th>
            <th class="px-3 py-2 text-left">${escapeHtml(t("historyColTime"))}</th>
            <th class="px-3 py-2 text-left">${escapeHtml(t("historyColOperation"))}</th>
            <th class="px-3 py-2 text-left">${escapeHtml(t("historyColCommand"))}</th>
            <th class="px-3 py-2 text-left">${escapeHtml(t("historyColMode"))}</th>
            <th class="px-3 py-2 text-left">${escapeHtml(t("historyColProfile"))}</th>
            <th class="px-3 py-2 text-left">${escapeHtml(t("historyColLevel"))}</th>
            <th class="px-3 py-2 text-left">${escapeHtml(t("historyColPath"))}</th>
            <th class="px-3 py-2 text-left">${escapeHtml(t("tableAction"))}</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-200">
          ${rows}
        </tbody>
      </table>
    </div>
  `;
}

function renderSavedConnectionOptions(keyword = "") {
  const datalist = byId("saved-conn-options");
  const q = keyword.trim().toLowerCase();
  const names = cachedSavedConnections
    .map((item) => item.name)
    .filter((name) => (!q ? true : name.toLowerCase().includes(q)));
  datalist.innerHTML = names.map((name) => `<option value="${name}"></option>`).join("");
}

async function loadSavedConnections() {
  const out = byId("saved-conn-list");
  try {
    const data = await request("GET", "/api/connections");
    cachedSavedConnections = Array.isArray(data) ? data : [];
    renderSavedConnectionOptions(byId("saved-conn-name").value || "");
    out.textContent =
      cachedSavedConnections
        .map(
          (item) =>
            `- ${item.name} -> ${item.path}${item.has_password ? " (with password)" : ""}`
        )
        .join("\n") || "-";
  } catch (e) {
    cachedSavedConnections = [];
    renderSavedConnectionOptions("");
    out.textContent = e.message;
  }
}

async function loadSavedConnectionByName() {
  const name = byId("saved-conn-name").value.trim();
  const out = byId("saved-conn-out");
  if (!name) {
    out.textContent = t("connectionNameRequired");
    return;
  }
  out.textContent = t("running");
  try {
    const data = await request("GET", `/api/connections/${encodeURIComponent(name)}`);
    applyConnectionForm(data.connection || {});
    byId("saved-conn-name").value = data.name || name;
    out.textContent = `${t("loaded")}: ${data.name}`;
  } catch (e) {
    out.textContent = e.message;
  }
}

async function saveConnectionByName() {
  const name = byId("saved-conn-name").value.trim();
  const out = byId("saved-conn-out");
  if (!name) {
    out.textContent = t("connectionNameRequired");
    return;
  }
  out.textContent = t("running");
  try {
    const data = await request("PUT", `/api/connections/${encodeURIComponent(name)}`, {
      connection: connectionPayload(),
      save_password: byId("saved-conn-save-password").checked,
    });
    out.textContent = `${t("saved")}: ${data.path}`;
    await loadSavedConnections();
  } catch (e) {
    out.textContent = e.message;
  }
}

async function deleteConnectionByName() {
  const name = byId("saved-conn-name").value.trim();
  const out = byId("saved-conn-out");
  if (!name) {
    out.textContent = t("connectionNameRequired");
    return;
  }
  out.textContent = t("running");
  try {
    await request("DELETE", `/api/connections/${encodeURIComponent(name)}`);
    out.textContent = `${t("deleted")}: ${name}`;
    byId("saved-conn-name").value = "";
    await loadSavedConnections();
  } catch (e) {
    out.textContent = e.message;
  }
}

async function loadConnectionHistory() {
  const name = byId("saved-conn-name").value.trim();
  const out = byId("saved-conn-history-out");
  if (!name) {
    out.innerHTML = `<div class="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">${escapeHtml(
      t("connectionNameRequired")
    )}</div>`;
    return;
  }
  out.innerHTML = `<div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">${escapeHtml(
    t("running")
  )}</div>`;
  try {
    const data = await request(
      "GET",
      `/api/connections/${encodeURIComponent(name)}/history?limit=30`
    );
    if (!Array.isArray(data) || data.length === 0) {
      out.innerHTML = `<div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">${escapeHtml(
        t("savedConnHistoryEmpty")
      )}</div>`;
      return;
    }
    out.innerHTML = renderConnectionHistoryTable(data);
  } catch (e) {
    out.innerHTML = `<div class="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">${escapeHtml(
      e.message
    )}</div>`;
  }
}

function formatHistoryDetailView(data) {
  const meta = (data && data.meta) || {};
  const entries = Array.isArray(data && data.entries) ? data.entries : [];
  const metaCard = `
    <section class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
      <div class="mb-1 text-xs font-semibold text-slate-500">${escapeHtml(t("historyMetaTitle"))}</div>
      <div class="grid gap-1 font-mono text-xs break-all">
        <div>time=${escapeHtml(formatHistoryTime(meta.ts_ms))}</div>
        <div>operation=${escapeHtml(safeString(meta.operation))}</div>
        <div>command=${escapeHtml(safeString(meta.command_label))}</div>
        <div>mode=${escapeHtml(displayMode(meta.mode))}</div>
        <div>profile=${escapeHtml(safeString(meta.device_profile))}</div>
        <div>target=${escapeHtml(`${safeString(meta.host)}:${safeString(meta.port)}`)}</div>
        <div>record_level=${escapeHtml(safeString(meta.record_level))}</div>
        <div>record_path=${escapeHtml(safeString(meta.record_path))}</div>
      </div>
    </section>
  `;
  if (!entries.length) {
    return `<div class="grid gap-3">${metaCard}
      <div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">${escapeHtml(
        t("historyDetailEmpty")
      )}</div></div>`;
  }
  return `<div class="grid gap-3">${metaCard}${renderStatsCards(
    buildEventStats(entries)
  )}${renderEntriesTable(entries)}</div>`;
}

async function loadConnectionHistoryDetail(historyId) {
  const name = byId("saved-conn-name").value.trim();
  if (!name || !historyId) return;
  openDetailModal(t("running"));
  try {
    const data = await request(
      "GET",
      `/api/connections/${encodeURIComponent(name)}/history/${encodeURIComponent(historyId)}`
    );
    openDetailModal(formatHistoryDetailView(data), {
      title: t("historyDetailTitle"),
      html: true,
    });
  } catch (e) {
    openDetailModal(e.message, { title: t("historyDetailTitle") });
  }
}

async function deleteConnectionHistoryItem(historyId) {
  const name = byId("saved-conn-name").value.trim();
  const out = byId("saved-conn-out");
  if (!name || !historyId) return;
  if (!window.confirm(t("historyDeleteConfirm"))) return;
  out.textContent = t("running");
  try {
    await request(
      "DELETE",
      `/api/connections/${encodeURIComponent(name)}/history/${encodeURIComponent(historyId)}`
    );
    out.textContent = t("historyDeleteDone");
    await loadConnectionHistory();
  } catch (e) {
    out.textContent = e.message;
  }
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
      renderDiagnoseProfileOptions();
    } else {
      cachedCustomProfiles = [];
      outProfile.textContent = "-";
      renderCustomProfileOptions();
      renderDiagnoseProfileOptions();
    }
  } catch (e) {
    cachedCustomProfiles = [];
    cachedDeviceProfiles = [];
    outProfile.textContent = e.message;
    outBuiltinDetail.textContent = e.message;
    renderCustomProfileOptions();
    renderDiagnoseProfileOptions();
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
  initAutocomplete("profile-diagnose-picker", () => cachedDeviceProfiles);
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
  byId("custom-profile-picker").value = profile.name || "";
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
    name: byId("custom-profile-picker").value.trim(),
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
    out.textContent = t("profileNameRequired");
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
      out.textContent = t("profileNameRequired");
      return;
    }
    const data = await request(
      "PUT",
      `/api/device-profiles/custom/${encodeURIComponent(name)}/form`,
      profile
    );
    byId("custom-profile-picker").value = name;
    out.textContent = `${t("saved")}: ${data.path}`;
    await loadProfilesOverview();
  } catch (e) {
    out.textContent = e.message;
  }
}

async function deleteCustomProfile() {
  const name = byId("custom-profile-picker").value.trim();
  const out = byId("profile-out");
  if (!name) {
    out.textContent = t("profileNameRequired");
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

function resetDiagnoseView() {
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
}

function renderDiagnoseResult(name, report) {
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

  const out = byId("profile-diagnose-out");
  out.textContent =
    `${t("diagSummaryProfile")}: ${name}\n` +
    `${t("diagSummaryIssueCount")}: ${issues}`;
}

async function diagnoseCustomProfile() {
  const name = byId("profile-diagnose-picker").value.trim();
  const out = byId("profile-diagnose-out");
  if (!name) {
    out.textContent = t("profileNameRequired");
    return;
  }
  out.textContent = t("running");
  resetDiagnoseView();
  try {
    const data = await request("POST", "/api/device-profiles/diagnose", {
      name,
    });
    const report = data.diagnostics || {};
    renderDiagnoseResult(data.name || name, report);
  } catch (e) {
    resetDiagnoseView();
    out.textContent = e.message;
  }
}

function formatReplayListView(data) {
  if (!data) {
    return `<div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">${escapeHtml(
      t("replayListNoData")
    )}</div>`;
  }
  const sections = [];
  if (data.context) {
    sections.push(`
      <div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
        <div class="mb-1 text-xs font-semibold text-slate-500">${escapeHtml(
          t("replayContextTitle")
        )}</div>
        <div class="font-mono text-xs break-all">
          device=${escapeHtml(safeString(data.context.device_addr))}<br/>
          prompt=${escapeHtml(safeString(data.context.prompt))}<br/>
          fsm=${escapeHtml(safeString(data.context.fsm_prompt))}
        </div>
      </div>
    `);
  }
  const entriesRaw = Array.isArray(data.entries) ? data.entries : [];
  const entries = filterEntries(
    entriesRaw,
    replayEventKind,
    replayFailedOnly,
    replaySearchQuery
  );
  if (entries.length) {
    sections.push(renderStatsCards(buildEventStats(entries)));
    sections.push(renderEntriesTable(entries));
  }
  if (data.output) {
    sections.push(`
      <div class="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
        <div class="mb-2 text-xs font-semibold text-slate-500">${escapeHtml(
          t("replayOutputTitle")
        )}</div>
        <div class="inline-flex items-center gap-2 text-xs">
          ${data.output.success
            ? '<span class="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-700">OK</span>'
            : '<span class="inline-flex items-center rounded-full bg-rose-100 px-2 py-0.5 font-semibold text-rose-700">FAIL</span>'}
          <span class="font-mono text-slate-600">prompt=${escapeHtml(
            safeString(data.output.prompt)
          )}</span>
        </div>
        <pre class="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-all rounded-md bg-slate-900 p-2 text-xs text-slate-100">${escapeHtml(
          safeString(data.output.content)
        )}</pre>
      </div>
    `);
  }
  if (!sections.length) {
    sections.push(
      `<div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">${escapeHtml(
        replayFailedOnly
          ? t("noFailedEntries")
          : replayEventKind !== "all"
            ? t("noMatchedEntries")
            : t("replayListNoData")
      )}</div>`
    );
  }
  return sections.join("");
}

function detailField(label, value, mono = false) {
  const valueCls = mono ? "font-mono text-xs break-all" : "text-sm break-all";
  return `
    <div class="rounded-lg border border-slate-200 bg-white px-3 py-2">
      <div class="text-[11px] font-semibold text-slate-500">${escapeHtml(label)}</div>
      <div class="mt-1 ${valueCls} text-slate-800">${escapeHtml(safeString(value))}</div>
    </div>
  `;
}

function detailBoolBadge(value) {
  if (value === true) {
    return '<span class="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">true</span>';
  }
  if (value === false) {
    return '<span class="inline-flex items-center rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700">false</span>';
  }
  return '<span class="text-slate-500">-</span>';
}

function renderEntryDetailView(entry) {
  const event = (entry && entry.event) || {};
  const kind = safeString(event.kind);
  const isCommandOutput = event.kind === "command_output";
  const parts = [];

  parts.push(`
    <section class="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div class="mb-2 text-xs font-semibold text-slate-600">${escapeHtml(
        t("detailSectionBasic")
      )}</div>
      <div class="grid gap-2 md:grid-cols-2">
        ${detailField(t("detailLabelKind"), kind)}
        <div class="rounded-lg border border-slate-200 bg-white px-3 py-2">
          <div class="text-[11px] font-semibold text-slate-500">${escapeHtml(
            t("detailLabelSuccess")
          )}</div>
          <div class="mt-1">${detailBoolBadge(event.success)}</div>
        </div>
        ${detailField(t("detailLabelCommand"), event.command || "-", true)}
        ${detailField(
          t("detailLabelMode"),
          event.kind === "command_output" ? displayMode(event.mode) : event.mode || "-",
          true
        )}
        ${detailField(t("detailLabelPrompt"), event.prompt || "-", true)}
        ${detailField(t("detailLabelFsmPrompt"), event.fsm_prompt || "-", true)}
        ${detailField(
          t("detailLabelTimestamp"),
          formatHistoryTime(entry.ts_ms || entry.timestamp_ms || event.ts_ms || 0)
        )}
        ${detailField(
          t("detailLabelDevice"),
          event.device_addr || entry.device_addr || "-",
          true
        )}
        ${detailField(
          t("detailLabelRecordLevel"),
          entry.record_level || event.record_level || "-",
          true
        )}
      </div>
    </section>
  `);

  parts.push(`
    <section class="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div class="mb-2 text-xs font-semibold text-slate-600">${escapeHtml(
        t("detailSectionFlow")
      )}</div>
      <div class="grid gap-2 lg:grid-cols-2">
        <div>
          <div class="mb-1 text-[11px] font-semibold text-slate-500">${escapeHtml(
            t("tablePromptFlow")
          )}</div>
          ${renderFlowCell(event.prompt_before, event.prompt_after, "indigo")}
        </div>
        <div>
          <div class="mb-1 text-[11px] font-semibold text-slate-500">${escapeHtml(
            t("tableFsmFlow")
          )}</div>
          ${renderFlowCell(event.fsm_prompt_before, event.fsm_prompt_after, "teal")}
        </div>
      </div>
    </section>
  `);

  if (isCommandOutput) {
    parts.push(`
      <section class="mt-3 rounded-xl border border-slate-200 bg-white p-3">
        <div class="mb-2 text-xs font-semibold text-slate-600">${escapeHtml(
          t("detailSectionOutput")
        )}</div>
        <div class="grid gap-2 md:grid-cols-2">
          ${detailField(t("detailLabelError"), event.error || "-", true)}
        </div>
        <pre class="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-all rounded-md bg-slate-900 p-2 text-xs text-slate-100">${escapeHtml(
          safeString(event.content || event.all || "-")
        )}</pre>
      </section>
    `);
  } else if (event.content || event.all) {
    parts.push(`
      <section class="mt-3 rounded-xl border border-slate-200 bg-white p-3">
        <div class="mb-2 text-xs font-semibold text-slate-600">${escapeHtml(
          t("detailSectionRaw")
        )}</div>
        <pre class="max-h-56 overflow-auto whitespace-pre-wrap break-all rounded-md bg-slate-900 p-2 text-xs text-slate-100">${escapeHtml(
          safeString(event.content || event.all)
        )}</pre>
      </section>
    `);
  }

  return parts.join("");
}

function openEntryDrawer(entry) {
  const backdrop = byId("entry-drawer-backdrop");
  const drawer = byId("entry-drawer");
  const body = byId("entry-drawer-body");
  body.innerHTML = renderEntryDetailView(entry);
  backdrop.classList.add("open");
  drawer.classList.add("open");
  document.body.classList.add("overflow-hidden");
}

function closeEntryDrawer() {
  const backdrop = byId("entry-drawer-backdrop");
  const drawer = byId("entry-drawer");
  const body = byId("entry-drawer-body");
  backdrop.classList.remove("open");
  drawer.classList.remove("open");
  body.innerHTML = "";
  document.body.classList.remove("overflow-hidden");
}

function openDetailModal(content, options = {}) {
  const modal = byId("detail-modal");
  const body = byId("detail-modal-body");
  byId("detail-modal-title").textContent = options.title || t("detailModalTitle");
  if (options.html) {
    body.innerHTML = content;
  } else {
    body.innerHTML = `<pre class="output max-h-[70vh] overflow-auto whitespace-pre-wrap break-all">${escapeHtml(
      safeString(content)
    )}</pre>`;
  }
  modal.classList.remove("hidden");
  modal.classList.add("flex");
  document.body.classList.add("overflow-hidden");
}

function closeDetailModal() {
  const modal = byId("detail-modal");
  modal.classList.add("hidden");
  modal.classList.remove("flex");
  byId("detail-modal-body").innerHTML = "";
  byId("detail-modal-title").textContent = t("detailModalTitle");
  document.body.classList.remove("overflow-hidden");
}

function renderReplayView() {
  const listOut = byId("replay-list-out");
  const rawOut = byId("replay-out");
  const listBtn = byId("replay-view-list");
  const rawBtn = byId("replay-view-raw");
  const isList = replayViewMode === "list";
  listBtn.classList.toggle("is-active", isList);
  rawBtn.classList.toggle("is-active", !isList);
  setPanelVisible(listOut, isList, "grid");
  setPanelVisible(rawOut, !isList, "block");

  if (!lastReplayResult) {
    if (isList) {
      listOut.innerHTML = formatReplayListView(null);
    } else {
      rawOut.textContent = t("replayListNoData");
    }
    return;
  }
  if (isList) {
    listOut.innerHTML = formatReplayListView(lastReplayResult);
  } else {
    rawOut.textContent = JSON.stringify(lastReplayResult, null, 2);
  }
}

function showReplayStatus(text) {
  if (replayViewMode === "list") {
    byId("replay-list-out").innerHTML = `<div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">${escapeHtml(
      text
    )}</div>`;
  } else {
    byId("replay-out").textContent = text;
  }
}

function resetRecordFilters() {
  recordFailedOnly = false;
  recordEventKind = "all";
  recordSearchQuery = "";
  byId("record-failed-only").checked = false;
  byId("record-event-kind").value = "all";
  byId("record-search").value = "";
  saveFilterPrefs();
  renderRecordingView();
}

function resetReplayFilters() {
  replayFailedOnly = false;
  replayEventKind = "all";
  replaySearchQuery = "";
  byId("replay-failed-only").checked = false;
  byId("replay-event-kind").value = "all";
  byId("replay-search").value = "";
  saveFilterPrefs();
  renderReplayView();
}

async function replayList() {
  const jsonl = byId("replay-jsonl").value.trim();
  if (!jsonl) {
    showReplayStatus(t("replayNoJsonl"));
    return;
  }
  showReplayStatus(t("running"));
  try {
    const data = await request("POST", "/api/replay", { jsonl, list: true });
    lastReplayResult = data;
    renderReplayView();
  } catch (e) {
    showReplayStatus(e.message);
  }
}

async function replayCommand() {
  const jsonl = byId("replay-jsonl").value.trim();
  const command = byId("replay-command").value.trim();
  const mode = byId("replay-mode").value.trim();
  if (!jsonl) {
    showReplayStatus(t("replayNoJsonl"));
    return;
  }
  if (!command) {
    showReplayStatus(t("replayNoCommand"));
    return;
  }
  showReplayStatus(t("running"));
  try {
    const data = await request("POST", "/api/replay", {
      jsonl,
      command,
      mode: mode || null,
    });
    lastReplayResult = data;
    renderReplayView();
  } catch (e) {
    showReplayStatus(e.message);
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
    byId("template-manage-path").value = data.path || "";
    byId("template-content").value = data.content || "";
    out.textContent = `${data.name} -> ${data.path}`;
  } catch (e) {
    lastTemplateDetail = null;
    out.textContent = e.message;
  }
}

async function saveTemplate() {
  const name = byId("template-pick-name").value.trim();
  const content = byId("template-content").value;
  const out = byId("template-out");
  if (!name) {
    out.textContent = "template name is required";
    return;
  }
  out.textContent = t("running");
  try {
    const exists = cachedTemplates.includes(name);
    const data = exists
      ? await request("PUT", `/api/templates/${encodeURIComponent(name)}`, { content })
      : await request("POST", "/api/templates", { name, content });
    out.textContent = `${exists ? t("saved") : t("created")}: ${data.path}`;
    await loadTemplates();
    byId("template-pick-name").value = name;
    byId("template-manage-path").value = data.path || "";
    lastTemplateDetail = data;
  } catch (e) {
    out.textContent = e.message;
  }
}

async function deleteTemplate() {
  const name = byId("template-pick-name").value.trim();
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
    lastTemplateDetail = null;
  } catch (e) {
    out.textContent = e.message;
  }
}

function bindEvents() {
  const langFab = byId("lang-fab");
  const langMenu = byId("lang-menu");
  const detailModal = byId("detail-modal");
  const entryDrawer = byId("entry-drawer");
  const entryDrawerBackdrop = byId("entry-drawer-backdrop");

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
    localStorage.setItem(STORAGE_KEYS.lang, currentLang);
    applyI18n();
    langMenu.hidden = true;
    langMenu.style.display = "none";
    langFab.setAttribute("aria-expanded", "false");
  };

  byId("lang-zh").onclick = () => {
    currentLang = "zh";
    localStorage.setItem(STORAGE_KEYS.lang, currentLang);
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
    const detailBtn = e.target.closest(".js-entry-detail-btn");
    if (detailBtn) {
      const id = detailBtn.getAttribute("data-detail-id") || "";
      const entry = detailEntryMap.get(id);
      if (entry) {
        openEntryDrawer(entry);
      }
    }
    const historyDetailBtn = e.target.closest(".js-history-detail-btn");
    if (historyDetailBtn) {
      const historyId = historyDetailBtn.getAttribute("data-history-id") || "";
      if (historyId) {
        loadConnectionHistoryDetail(historyId);
      }
    }
    const historyDeleteBtn = e.target.closest(".js-history-delete-btn");
    if (historyDeleteBtn) {
      const historyId = historyDeleteBtn.getAttribute("data-history-id") || "";
      if (historyId) {
        deleteConnectionHistoryItem(historyId);
      }
    }
  });

  byId("detail-modal-close").onclick = closeDetailModal;
  byId("entry-drawer-close").onclick = closeEntryDrawer;
  entryDrawerBackdrop.onclick = closeEntryDrawer;
  entryDrawer.onclick = (e) => {
    if (e.target === entryDrawer) {
      closeEntryDrawer();
    }
  };
  detailModal.onclick = (e) => {
    if (e.target === detailModal) {
      closeDetailModal();
    }
  };
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && entryDrawer.classList.contains("open")) {
      closeEntryDrawer();
      return;
    }
    if (e.key === "Escape" && !detailModal.classList.contains("hidden")) {
      closeDetailModal();
    }
  });

  byId("prompt-mode-view").onclick = () => {
    currentPromptMode = "view";
    applyPromptMode();
  };
  byId("prompt-mode-edit").onclick = () => {
    currentPromptMode = "edit";
    applyPromptMode();
  };
  byId("prompt-mode-diagnose").onclick = () => {
    currentPromptMode = "diagnose";
    applyPromptMode();
  };

  for (const tab of ["ops", "prompts", "templates"]) {
    byId(`tab-${tab}`).onclick = () => {
      currentTab = tab;
      applyTabs();
      if (tab === "prompts") {
        loadProfilesOverview();
        currentPromptMode = "view";
        applyPromptMode();
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
  byId("saved-conn-save-btn").onclick = saveConnectionByName;
  byId("saved-conn-delete-btn").onclick = deleteConnectionByName;
  byId("saved-conn-history-btn").onclick = loadConnectionHistory;
  byId("saved-conn-name").oninput = (e) => {
    renderSavedConnectionOptions(e.target.value);
  };
  byId("saved-conn-name").onchange = async () => {
    if (!byId("saved-conn-name").value.trim()) return;
    await loadSavedConnectionByName();
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
        record_level: recordLevelPayload(),
      });
      out.textContent = data.output;
      applyRecordingFromResponse(data);
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
        record_level: recordLevelPayload(),
      });
      out.textContent = JSON.stringify(data, null, 2);
      applyRecordingFromResponse(data);
    } catch (e) {
      out.textContent = e.message;
    }
  };

  byId("template").onchange = loadSelectedTemplateContent;
  byId("record-enable").onchange = () => {
    byId("record-level").disabled = byId("record-enable").checked;
  };
  byId("record-view-list").onclick = () => {
    recordViewMode = "list";
    saveFilterPrefs();
    renderRecordingView();
  };
  byId("record-view-raw").onclick = () => {
    recordViewMode = "raw";
    saveFilterPrefs();
    renderRecordingView();
  };
  byId("record-jsonl").oninput = () => {
    if (recordViewMode === "list") {
      renderRecordingView();
    }
  };
  byId("record-failed-only").onchange = () => {
    recordFailedOnly = byId("record-failed-only").checked;
    saveFilterPrefs();
    renderRecordingView();
  };
  byId("record-event-kind").onchange = () => {
    recordEventKind = byId("record-event-kind").value || "all";
    saveFilterPrefs();
    renderRecordingView();
  };
  byId("record-search").oninput = () => {
    recordSearchQuery = byId("record-search").value || "";
    saveFilterPrefs();
    renderRecordingView();
  };
  byId("record-clear-filters").onclick = () => {
    resetRecordFilters();
  };
  byId("record-copy-btn").onclick = async () => {
    const text = byId("record-jsonl").value || "";
    if (!text.trim()) {
      showReplayStatus(t("replayNoJsonl"));
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      showReplayStatus(t("recordingCopied"));
    } catch (_) {
      showReplayStatus(t("requestFailed"));
    }
  };
  byId("record-use-replay-btn").onclick = () => {
    byId("replay-jsonl").value = byId("record-jsonl").value || "";
    lastReplayResult = null;
    renderReplayView();
    showReplayStatus(t("recordingSetToReplay"));
  };
  byId("replay-view-list").onclick = () => {
    replayViewMode = "list";
    saveFilterPrefs();
    renderReplayView();
  };
  byId("replay-view-raw").onclick = () => {
    replayViewMode = "raw";
    saveFilterPrefs();
    renderReplayView();
  };
  byId("replay-failed-only").onchange = () => {
    replayFailedOnly = byId("replay-failed-only").checked;
    saveFilterPrefs();
    renderReplayView();
  };
  byId("replay-event-kind").onchange = () => {
    replayEventKind = byId("replay-event-kind").value || "all";
    saveFilterPrefs();
    renderReplayView();
  };
  byId("replay-search").oninput = () => {
    replaySearchQuery = byId("replay-search").value || "";
    saveFilterPrefs();
    renderReplayView();
  };
  byId("replay-clear-filters").onclick = () => {
    resetReplayFilters();
  };
  byId("replay-list-btn").onclick = replayList;
  byId("replay-run-btn").onclick = replayCommand;
  byId("custom-profile-picker").oninput = (e) => {
    renderCustomProfileOptions(e.target.value);
  };
  byId("custom-profile-picker").onchange = async () => {
    if (!byId("custom-profile-picker").value.trim()) return;
    await loadCustomProfile();
  };
  byId("profile-diagnose-picker").oninput = (e) => {
    renderDiagnoseProfileOptions(e.target.value);
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
    currentPromptMode = "edit";
    applyPromptMode();
    out.textContent = t("copiedToCustom");
  };
  byId("profile-save-btn").onclick = saveCustomProfile;
  byId("profile-delete-btn").onclick = deleteCustomProfile;
  byId("profile-diagnose-btn").onclick = diagnoseCustomProfile;
  byId("add-more-pattern-btn").onclick = () => addSimpleListRow("profile-more-list");
  byId("add-error-pattern-btn").onclick = () => addSimpleListRow("profile-error-list");
  byId("add-ignore-error-btn").onclick = () => addSimpleListRow("profile-ignore-list");
  byId("add-prompt-row-btn").onclick = () => addPromptRow();
  byId("add-sys-prompt-row-btn").onclick = () => addSysPromptRow();
  byId("add-interaction-row-btn").onclick = () => addInteractionRow();
  byId("add-transition-row-btn").onclick = () => addTransitionRow();

  byId("template-pick-name").oninput = (e) => {
    renderTemplateOptions(e.target.value);
  };
  byId("template-pick-name").onchange = async () => {
    if (!byId("template-pick-name").value.trim()) return;
    await loadTemplateDetail();
  };
  byId("template-save-btn").onclick = saveTemplate;
  byId("template-delete-btn").onclick = deleteTemplate;
}

normalizeFilterPrefs();
saveFilterPrefs();
bindEvents();
initTopLevelAutocomplete();
initCollapsibleGroups();
applyI18n();
applyTabs();
applyOperationKind();
applyPromptMode();
resetDiagnoseView();
byId("record-level").disabled = byId("record-enable").checked;
byId("record-failed-only").checked = recordFailedOnly;
byId("replay-failed-only").checked = replayFailedOnly;
byId("record-event-kind").value = recordEventKind;
byId("replay-event-kind").value = replayEventKind;
byId("record-search").value = recordSearchQuery;
byId("replay-search").value = replaySearchQuery;
loadSavedConnections();
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
