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
  historyFilterQuery: "rauto_history_filter_query",
  historyFilterOperation: "rauto_history_filter_operation",
  historyFilterLimit: "rauto_history_filter_limit",
  rollbackTemplateLibrary: "rauto_rollback_templates",
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
    tabInteractive: "Interactive",
    tabReplay: "Session Replay",
    tabPrompts: "Prompt Profiles",
    tabTemplates: "Template Manager",
    tabBackup: "Backup",
    opsTitle: "Operations",
    replayPageTitle: "Session Replay",
    interactiveTitle: "Interactive Session",
    interactiveCardTitle: "Interactive",
    interactiveStatusIdle: "idle",
    interactiveStatusRunning: "starting...",
    interactiveStatusReady: "session ready",
    interactiveStatusStopped: "stopped",
    interactiveStatusNoSession: "no active session",
    interactiveStartBtn: "Start Session",
    interactiveStopBtn: "Stop Session",
    interactiveSendBtn: "Send",
    interactiveClearBtn: "Clear",
    interactiveCommandPlaceholder: "command, e.g. show version",
    interactiveModePlaceholder: "mode (optional)",
    recordFabTitle: "Recording",
    recordDrawerClose: "Close",
    recordDrawerSubtitle: "View recorded sessions and filters",
    historyDrawerTitle: "Connection History",
    historyDrawerSubtitle: "View saved connection history",
    historyDrawerRefresh: "Refresh",
    historyDrawerConnLabel: "Connection",
    historyFilterPlaceholder: "search command/target",
    historyFilterOperationAll: "All operations",
    historyFilterLimitLabel: "Limit",
    historyFilterClear: "Clear",
    opCardTitle: "Execution",
    opKindExec: "Execute",
    opKindTemplate: "Template Render + Execute",
    opKindTx: "Transaction Block",
    opExecDirect: "Direct Execute",
    opExecTemplate: "Template Render + Execute",
    txNamePlaceholder: "tx block name",
    txTemplatePlaceholder: "template file name or path (optional)",
    txVarsPlaceholder: 'JSON vars, e.g. {"name":"WEB01"}',
    txCommandsPlaceholder: "commands (one per line, optional when template is set)",
    txModePlaceholder: "tx mode (default Config)",
    txTemplateProfilePlaceholder:
      "template profile for rollback inference (default device profile)",
    txTimeoutPlaceholder: "timeout secs (optional)",
    txResourceRollbackPlaceholder: "resource rollback command (optional)",
    txRollbackModeLabel: "Rollback mode",
    txRollbackModeInfer: "infer per-step",
    txRollbackModePerStep: "custom per-step",
    txRollbackModeWhole: "whole resource",
    txRollbackCommandsPlaceholder: "rollback commands (one per line, used by per_step)",
    txRollbackOnFailureLabel: "rollback failed step",
    txRollbackTriggerStepPlaceholder: "trigger step index (default 0)",
    txBasicTitle: "Transaction Block",
    txAdvancedBtn: "Advanced",
    txStageBlock: "Tx Block",
    txStageWorkflow: "Tx Workflow",
    txStageHintBlock: "Step 1: build and run a single transaction block.",
    txStageHintWorkflow: "Step 2: combine multiple blocks and execute a workflow.",
    txPlanBtn: "Preview Tx Plan",
    txExecBtn: "Execute Tx Block",
    txWorkflowTitle: "Transaction Workflow (JSON)",
    txWorkflowBuilderTitle: "Workflow Builder",
    txWorkflowImportBlockBtn: "Import From Tx Form",
    txWorkflowAddBlockBtn: "+ Add Block",
    txWorkflowCollapseAllBtn: "Collapse All",
    txWorkflowExpandAllBtn: "Expand All",
    txWorkflowNamePlaceholder: "workflow name",
    txWorkflowFailFastLabel: "fail fast",
    txWorkflowGenerateBtn: "Generate JSON",
    txWorkflowLoadBtn: "Load JSON To Builder",
    txWorkflowDownloadBtn: "Download JSON",
    txWorkflowImportFileBtn: "Import JSON File",
    txWorkflowMoreBtn: "More Actions",
    txWorkflowBlockNamePlaceholder: "block name",
    txWorkflowBlockModePlaceholder: "default mode (e.g. Config)",
    txWorkflowBlockKindConfig: "config",
    txWorkflowBlockKindShow: "show",
    txWorkflowBlockRollbackPolicyLabel: "rollback policy",
    txWorkflowBlockRollbackNone: "none",
    txWorkflowBlockRollbackPerStep: "per_step",
    txWorkflowBlockRollbackWhole: "whole_resource",
    txWorkflowRollbackInputModeLabel: "rollback input",
    txWorkflowRollbackInputText: "text",
    txWorkflowRollbackInputPairs: "per-command",
    txWorkflowRollbackOnFailureLabel: "rollback failed step",
    txWorkflowRollbackTriggerStepPlaceholder: "trigger step index (default 0)",
    txWorkflowRollbackEmptyHint: "enter commands above to edit per-command rollbacks",
    txWorkflowRollbackAutoBtn: "Auto-generate rollback",
    txWorkflowRollbackAutoHint: "Generated by simple rule: prefix with 'no '",
    txWorkflowRollbackRuleLabel: "rule",
    txWorkflowRollbackRuleNoPrefix: "prefix no",
    txWorkflowRollbackRuleSetDelete: "set → delete",
    txWorkflowRollbackRuleAddRemove: "add → remove",
    txWorkflowRollbackRuleCustom: "custom template",
    txWorkflowRollbackTemplatePlaceholder: "template, e.g. no {{cmd}}",
    txWorkflowRollbackLibraryLabel: "library",
    txWorkflowRollbackLibraryPick: "pick template",
    txWorkflowRollbackLibraryName: "template name",
    txWorkflowRollbackLibrarySave: "Save",
    txWorkflowRollbackLibraryDelete: "Delete",
    txWorkflowBlockTimeoutPlaceholder: "timeout secs (optional)",
    txWorkflowBlockUndoPlaceholder: "whole-resource undo command",
    txWorkflowBlockCommandsPlaceholder: "commands (one per line)",
    txWorkflowBlockRollbacksPlaceholder:
      "rollback commands (one per line, used by per_step)",
    txWorkflowDeleteBlockBtn: "Delete Block",
    txWorkflowCopyBlockBtn: "Copy",
    txWorkflowMoveUpBtn: "Up",
    txWorkflowMoveDownBtn: "Down",
    txWorkflowDragBtn: "Drag",
    txWorkflowSummaryCommands: "commands",
    txWorkflowSummaryKind: "kind",
    txWorkflowSummaryMode: "mode",
    txWorkflowSummaryRollback: "rollback",
    txWorkflowFilterKindAll: "all kinds",
    txWorkflowFilterRollbackAll: "all rollback",
    txWorkflowFilterSearchPlaceholder: "search block name/command",
    txWorkflowFilterClearBtn: "Clear",
    txWorkflowFilterNoMatch: "no blocks matched current filters",
    txWorkflowBuilderEmpty: "no blocks yet, add one first",
    txWorkflowJsonPlaceholder:
      '{"name":"fw-policy-publish","blocks":[],"fail_fast":true}',
    txWorkflowPlanBtn: "Preview Workflow",
    txWorkflowExecBtn: "Execute Workflow",
    txWorkflowExecRawBtn: "Raw",
    txWorkflowJsonRequired: "workflow json is required",
    txWorkflowImportEmpty: "tx block plan is empty",
    txWorkflowImportDone: "imported one tx block into workflow builder",
    txWorkflowDownloadDone: "workflow json downloaded",
    txWorkflowImportFileInvalid: "please choose a valid workflow json file",
    txWorkflowImportFileDone: "workflow json imported into builder",
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
    backupTitle: "Backup & Restore",
    backupCreateTitle: "Create Backup",
    backupListTitle: "Backup Archives",
    backupOutputPlaceholder: "optional output path (.tar.gz)",
    backupArchivePlaceholder: "select or input archive path",
    backupCreateBtn: "Create",
    backupRefreshBtn: "Refresh",
    backupDownloadBtn: "Download",
    backupRestoreMergeBtn: "Restore (Merge)",
    backupRestoreReplaceBtn: "Restore (Replace)",
    backupSelectedMetaLabel: "Selected",
    backupMetaSize: "Size",
    backupMetaTime: "Modified",
    backupArchiveRequired: "archive path is required",
    backupRestoreConfirmMerge:
      "Restore backup to ~/.rauto in merge mode now? Existing files may be overwritten.",
    backupRestoreConfirmReplace:
      "Restore backup to ~/.rauto in replace mode now? Current ~/.rauto data will be replaced.",
    backupCreated: "backup created",
    backupRestored: "backup restored",
    backupPickOne: "please select a backup archive from list",
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
    commandRequired: "command is required",
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
    tabInteractive: "交互会话",
    tabReplay: "会话回放",
    tabPrompts: "Prompt 管理",
    tabTemplates: "Template 管理",
    tabBackup: "备份恢复",
    opsTitle: "常用操作",
    replayPageTitle: "会话回放",
    interactiveTitle: "交互会话",
    interactiveCardTitle: "交互会话",
    interactiveStatusIdle: "空闲",
    interactiveStatusRunning: "正在启动...",
    interactiveStatusReady: "会话已就绪",
    interactiveStatusStopped: "已停止",
    interactiveStatusNoSession: "没有可用会话",
    interactiveStartBtn: "启动会话",
    interactiveStopBtn: "停止会话",
    interactiveSendBtn: "发送",
    interactiveClearBtn: "清空",
    interactiveCommandPlaceholder: "命令，例如 show version",
    interactiveModePlaceholder: "模式（可选）",
    recordFabTitle: "会话录制",
    recordDrawerClose: "关闭",
    recordDrawerSubtitle: "查看录制历史与筛选条件",
    historyDrawerTitle: "连接历史",
    historyDrawerSubtitle: "查看已保存连接的历史记录",
    historyDrawerRefresh: "刷新",
    historyDrawerConnLabel: "连接配置",
    historyFilterPlaceholder: "搜索命令/目标",
    historyFilterOperationAll: "全部操作",
    historyFilterLimitLabel: "条数",
    historyFilterClear: "清空",
    opCardTitle: "执行模式",
    opKindExec: "执行",
    opKindTemplate: "模板渲染并执行",
    opKindTx: "事务块执行",
    opExecDirect: "直接执行命令",
    opExecTemplate: "模板渲染并执行",
    txNamePlaceholder: "事务块名称",
    txTemplatePlaceholder: "模板文件名或路径（可选）",
    txVarsPlaceholder: 'JSON 变量，例如 {"name":"WEB01"}',
    txCommandsPlaceholder: "命令列表（每行一条；若提供模板可不填）",
    txModePlaceholder: "事务模式（默认 Config）",
    txTemplateProfilePlaceholder: "回滚推断模板 profile（默认使用设备 profile）",
    txTimeoutPlaceholder: "超时秒数（可选）",
    txResourceRollbackPlaceholder: "资源级回滚命令（可选）",
    txRollbackModeLabel: "回滚模式",
    txRollbackModeInfer: "自动推断逐条回滚",
    txRollbackModePerStep: "自定义逐条回滚",
    txRollbackModeWhole: "整块回滚",
    txRollbackCommandsPlaceholder: "回滚命令（每行一条，用于 per_step）",
    txRollbackOnFailureLabel: "失败步也回滚",
    txRollbackTriggerStepPlaceholder: "回滚触发步序号（默认 0）",
    txBasicTitle: "事务块执行",
    txAdvancedBtn: "高级参数",
    txStageBlock: "事务块",
    txStageWorkflow: "事务工作流",
    txStageHintBlock: "步骤 1：构建并执行单个事务块。",
    txStageHintWorkflow: "步骤 2：组合多个事务块并执行工作流。",
    txPlanBtn: "预览事务计划",
    txExecBtn: "执行事务块",
    txWorkflowTitle: "事务工作流（JSON）",
    txWorkflowBuilderTitle: "工作流构建器",
    txWorkflowImportBlockBtn: "从事务块表单导入",
    txWorkflowAddBlockBtn: "+ 添加 Block",
    txWorkflowCollapseAllBtn: "全部折叠",
    txWorkflowExpandAllBtn: "全部展开",
    txWorkflowNamePlaceholder: "工作流名称",
    txWorkflowFailFastLabel: "失败即停止",
    txWorkflowGenerateBtn: "生成 JSON",
    txWorkflowLoadBtn: "从 JSON 回填构建器",
    txWorkflowDownloadBtn: "下载 JSON",
    txWorkflowImportFileBtn: "导入 JSON 文件",
    txWorkflowMoreBtn: "更多操作",
    txWorkflowBlockNamePlaceholder: "block 名称",
    txWorkflowBlockModePlaceholder: "默认模式（如 Config）",
    txWorkflowBlockKindConfig: "config",
    txWorkflowBlockKindShow: "show",
    txWorkflowBlockRollbackPolicyLabel: "回滚策略",
    txWorkflowBlockRollbackNone: "none",
    txWorkflowBlockRollbackPerStep: "per_step",
    txWorkflowBlockRollbackWhole: "whole_resource",
    txWorkflowRollbackInputModeLabel: "回滚输入",
    txWorkflowRollbackInputText: "文本",
    txWorkflowRollbackInputPairs: "逐条",
    txWorkflowRollbackOnFailureLabel: "失败步也回滚",
    txWorkflowRollbackTriggerStepPlaceholder: "回滚触发步序号（默认 0）",
    txWorkflowRollbackEmptyHint: "请先输入命令，再编辑逐条回滚",
    txWorkflowRollbackAutoBtn: "自动生成回滚",
    txWorkflowRollbackAutoHint: "按规则生成：为每条命令加 no 前缀",
    txWorkflowRollbackRuleLabel: "规则",
    txWorkflowRollbackRuleNoPrefix: "前缀 no",
    txWorkflowRollbackRuleSetDelete: "set → delete",
    txWorkflowRollbackRuleAddRemove: "add → remove",
    txWorkflowRollbackRuleCustom: "自定义模板",
    txWorkflowRollbackTemplatePlaceholder: "模板，例如 no {{cmd}}",
    txWorkflowRollbackLibraryLabel: "模板库",
    txWorkflowRollbackLibraryPick: "选择模板",
    txWorkflowRollbackLibraryName: "模板名称",
    txWorkflowRollbackLibrarySave: "保存",
    txWorkflowRollbackLibraryDelete: "删除",
    txWorkflowBlockTimeoutPlaceholder: "超时秒数（可选）",
    txWorkflowBlockUndoPlaceholder: "整块回滚命令",
    txWorkflowBlockCommandsPlaceholder: "命令列表（每行一条）",
    txWorkflowBlockRollbacksPlaceholder: "回滚命令（每行一条，用于 per_step）",
    txWorkflowDeleteBlockBtn: "删除 Block",
    txWorkflowCopyBlockBtn: "复制",
    txWorkflowMoveUpBtn: "上移",
    txWorkflowMoveDownBtn: "下移",
    txWorkflowDragBtn: "拖拽",
    txWorkflowSummaryCommands: "命令数",
    txWorkflowSummaryKind: "类型",
    txWorkflowSummaryMode: "模式",
    txWorkflowSummaryRollback: "回滚",
    txWorkflowFilterKindAll: "全部类型",
    txWorkflowFilterRollbackAll: "全部回滚",
    txWorkflowFilterSearchPlaceholder: "搜索 block 名称/命令",
    txWorkflowFilterClearBtn: "清空",
    txWorkflowFilterNoMatch: "当前筛选条件下没有匹配的 block",
    txWorkflowBuilderEmpty: "还没有 block，请先添加",
    txWorkflowJsonPlaceholder:
      '{"name":"fw-policy-publish","blocks":[],"fail_fast":true}',
    txWorkflowPlanBtn: "预览工作流",
    txWorkflowExecBtn: "执行工作流",
    txWorkflowExecRawBtn: "原始数据",
    txWorkflowJsonRequired: "需要填写 workflow JSON",
    txWorkflowImportEmpty: "事务块计划为空",
    txWorkflowImportDone: "已导入一个事务块到工作流构建器",
    txWorkflowDownloadDone: "工作流 JSON 已下载",
    txWorkflowImportFileInvalid: "请选择有效的 workflow JSON 文件",
    txWorkflowImportFileDone: "已从文件导入 workflow JSON 并回填构建器",
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
    backupTitle: "备份与恢复",
    backupCreateTitle: "创建备份",
    backupListTitle: "备份归档",
    backupOutputPlaceholder: "可选输出路径（.tar.gz）",
    backupArchivePlaceholder: "选择或输入归档路径",
    backupCreateBtn: "创建",
    backupRefreshBtn: "刷新",
    backupDownloadBtn: "下载",
    backupRestoreMergeBtn: "恢复（合并）",
    backupRestoreReplaceBtn: "恢复（替换）",
    backupSelectedMetaLabel: "已选",
    backupMetaSize: "大小",
    backupMetaTime: "修改时间",
    backupArchiveRequired: "归档路径不能为空",
    backupRestoreConfirmMerge: "确认以“合并模式”恢复到 ~/.rauto？已有文件可能被覆盖。",
    backupRestoreConfirmReplace: "确认以“替换模式”恢复到 ~/.rauto？当前 ~/.rauto 数据会被替换。",
    backupCreated: "备份已创建",
    backupRestored: "备份已恢复",
    backupPickOne: "请先从列表中选择一个备份归档",
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
    commandRequired: "命令不能为空",
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
let currentExecMode = "direct";
let currentPromptMode = "view";
let cachedSavedConnections = [];
let cachedCustomProfiles = [];
let cachedDeviceProfiles = [];
let cachedTemplates = [];
let cachedBackups = [];
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
let historyFilterQuery =
  localStorage.getItem(STORAGE_KEYS.historyFilterQuery) || "";
let historyFilterOperation =
  localStorage.getItem(STORAGE_KEYS.historyFilterOperation) || "all";
let historyFilterLimit = Number(
  localStorage.getItem(STORAGE_KEYS.historyFilterLimit) || 30
);
let lastHistoryItems = [];
let detailEntrySeq = 0;
let txWorkflowBlockSeq = 0;
let txWorkflowBlocks = [];
let txWorkflowDragBlockId = "";
let txWorkflowFilterKind = "all";
let txWorkflowFilterRollback = "all";
let txWorkflowFilterQuery = "";
let txAdvancedExpanded = false;
let currentTxStage = "block";
let txWorkflowMoreExpanded = false;
let rollbackTemplateLibrary = [];
let txRollbackInputMode = "text";
let interactiveSessionId = null;
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
  "tx_block_started",
  "tx_step_succeeded",
  "tx_step_failed",
  "tx_rollback_started",
  "tx_rollback_step_succeeded",
  "tx_rollback_step_failed",
  "tx_block_finished",
  "tx_workflow_started",
  "tx_workflow_finished",
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

function saveHistoryFilterPrefs() {
  localStorage.setItem(STORAGE_KEYS.historyFilterQuery, historyFilterQuery);
  localStorage.setItem(
    STORAGE_KEYS.historyFilterOperation,
    historyFilterOperation
  );
  localStorage.setItem(
    STORAGE_KEYS.historyFilterLimit,
    String(historyFilterLimit)
  );
}

function normalizeHistoryFilters() {
  if (!historyFilterQuery) historyFilterQuery = "";
  if (
    ![
      "all",
      "exec",
      "template_execute",
      "tx_block",
      "tx_workflow",
      "interactive",
    ].includes(historyFilterOperation)
  ) {
    historyFilterOperation = "all";
  }
  if (!Number.isFinite(historyFilterLimit) || historyFilterLimit <= 0) {
    historyFilterLimit = 30;
  }
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
    ["tx_block_started", "tx_block_started"],
    ["tx_step_succeeded", "tx_step_succeeded"],
    ["tx_step_failed", "tx_step_failed"],
    ["tx_rollback_started", "tx_rollback_started"],
    ["tx_rollback_step_succeeded", "tx_rollback_step_succeeded"],
    ["tx_rollback_step_failed", "tx_rollback_step_failed"],
    ["tx_block_finished", "tx_block_finished"],
    ["tx_workflow_started", "tx_workflow_started"],
    ["tx_workflow_finished", "tx_workflow_finished"],
  ];
  sel.innerHTML = options
    .map(([value, label]) => `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`)
    .join("");
  sel.value = selected || "all";
}

function loadRollbackTemplateLibrary() {
  const raw = localStorage.getItem(STORAGE_KEYS.rollbackTemplateLibrary);
  if (!raw) {
    rollbackTemplateLibrary = [];
    return;
  }
  try {
    const parsed = JSON.parse(raw);
    rollbackTemplateLibrary = Array.isArray(parsed)
      ? parsed.filter((item) => item && item.name && item.template)
      : [];
  } catch (_) {
    rollbackTemplateLibrary = [];
  }
}

function saveRollbackTemplateLibrary() {
  localStorage.setItem(
    STORAGE_KEYS.rollbackTemplateLibrary,
    JSON.stringify(rollbackTemplateLibrary)
  );
}

function upsertRollbackTemplate(name, template) {
  const normalized = name.trim();
  if (!normalized || !template.trim()) return;
  const idx = rollbackTemplateLibrary.findIndex((t) => t.name === normalized);
  const item = { name: normalized, template };
  if (idx >= 0) {
    rollbackTemplateLibrary[idx] = item;
  } else {
    rollbackTemplateLibrary.push(item);
  }
  saveRollbackTemplateLibrary();
}

function deleteRollbackTemplate(name) {
  const normalized = name.trim();
  if (!normalized) return;
  rollbackTemplateLibrary = rollbackTemplateLibrary.filter((t) => t.name !== normalized);
  saveRollbackTemplateLibrary();
}

function rollbackTemplateOptionsHtml(selectedName = "") {
  const options = rollbackTemplateLibrary
    .map((item) => {
      const selected = item.name === selectedName ? "selected" : "";
      return `<option value="${escapeHtml(item.name)}" ${selected}>${escapeHtml(
        item.name
      )}</option>`;
    })
    .join("");
  return `<option value="">${escapeHtml(t("txWorkflowRollbackLibraryPick"))}</option>${options}`;
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
  byId("tab-interactive").textContent = t("tabInteractive");
  byId("tab-replay").textContent = t("tabReplay");
  byId("tab-prompts").textContent = t("tabPrompts");
  byId("tab-templates").textContent = t("tabTemplates");
  byId("tab-backup").textContent = t("tabBackup");

  byId("ops-title").textContent = t("opsTitle");
  byId("interactive-title").textContent = t("interactiveTitle");
  byId("interactive-card-title").textContent = t("interactiveCardTitle");
  byId("interactive-start-btn").textContent = t("interactiveStartBtn");
  byId("interactive-stop-btn").textContent = t("interactiveStopBtn");
  byId("interactive-send-btn").textContent = t("interactiveSendBtn");
  byId("interactive-clear-btn").textContent = t("interactiveClearBtn");
  byId("record-fab").title = t("recordFabTitle");
  byId("record-drawer-close").textContent = t("recordDrawerClose");
  byId("recording-subtitle").textContent = t("recordDrawerSubtitle");
  byId("history-drawer-title").textContent = t("historyDrawerTitle");
  byId("history-drawer-subtitle").textContent = t("historyDrawerSubtitle");
  byId("history-drawer-refresh-btn").textContent = t("historyDrawerRefresh");
  byId("history-drawer-conn-label").textContent = t("historyDrawerConnLabel");
  byId("history-filter-query").placeholder = t("historyFilterPlaceholder");
  byId("history-filter-clear-btn").textContent = t("historyFilterClear");
  const historyOpEl = byId("history-filter-operation");
  historyOpEl.innerHTML = `
    <option value="all">${escapeHtml(t("historyFilterOperationAll"))}</option>
    <option value="exec">exec</option>
    <option value="template_execute">template_execute</option>
    <option value="tx_block">tx_block</option>
    <option value="tx_workflow">tx_workflow</option>
    <option value="interactive">interactive</option>
  `;
  historyOpEl.value = historyFilterOperation;
  byId("history-filter-limit").value = String(historyFilterLimit || 30);
  byId("history-filter-query").value = historyFilterQuery || "";
  if (interactiveSessionId) {
    setInteractiveStatus(`${t("interactiveStatusReady")} · ${interactiveSessionId}`);
  } else {
    setInteractiveStatus(t("interactiveStatusIdle"));
  }
  byId("replay-page-title").textContent = t("replayPageTitle");
  byId("op-card-title").textContent = t("opCardTitle");
  byId("op-kind-exec").textContent = t("opKindExec");
  byId("op-exec-direct").textContent = t("opExecDirect");
  byId("op-exec-template").textContent = t("opExecTemplate");
  byId("op-kind-tx").textContent = t("opKindTx");
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
  byId("backup-title").textContent = t("backupTitle");
  byId("backup-create-title").textContent = t("backupCreateTitle");
  byId("backup-list-title").textContent = t("backupListTitle");
  byId("backup-output-path").placeholder = t("backupOutputPlaceholder");
  byId("backup-restore-archive").placeholder = t("backupArchivePlaceholder");
  byId("backup-create-btn").textContent = t("backupCreateBtn");
  byId("backup-refresh-btn").textContent = t("backupRefreshBtn");
  byId("backup-download-btn").textContent = t("backupDownloadBtn");
  byId("backup-restore-merge-btn").textContent = t("backupRestoreMergeBtn");
  byId("backup-restore-replace-btn").textContent = t("backupRestoreReplaceBtn");

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
  byId("tx-name").placeholder = t("txNamePlaceholder");
  byId("tx-template").placeholder = t("txTemplatePlaceholder");
  byId("tx-vars").placeholder = t("txVarsPlaceholder");
  byId("tx-commands").placeholder = t("txCommandsPlaceholder");
  byId("tx-mode").placeholder = t("txModePlaceholder");
  byId("tx-template-profile").placeholder = t("txTemplateProfilePlaceholder");
  byId("tx-timeout-secs").placeholder = t("txTimeoutPlaceholder");
  byId("tx-resource-rollback").placeholder = t("txResourceRollbackPlaceholder");
  byId("tx-rollback-mode-label").textContent = t("txRollbackModeLabel");
  byId("tx-rollback-mode").innerHTML = `
    <option value="infer">${escapeHtml(t("txRollbackModeInfer"))}</option>
    <option value="per_step">${escapeHtml(t("txRollbackModePerStep"))}</option>
    <option value="whole_resource">${escapeHtml(t("txRollbackModeWhole"))}</option>
  `;
  byId("tx-rollback-input-label").textContent = t("txWorkflowRollbackInputModeLabel");
  byId("tx-rollback-input-text").textContent = t("txWorkflowRollbackInputText");
  byId("tx-rollback-input-pairs").textContent = t("txWorkflowRollbackInputPairs");
  byId("tx-rollback-auto-btn").textContent = t("txWorkflowRollbackAutoBtn");
  byId("tx-rollback-auto-hint").textContent = t("txWorkflowRollbackAutoHint");
  byId("tx-rollback-rule-label").textContent = t("txWorkflowRollbackRuleLabel");
  byId("tx-rollback-rule").innerHTML = `
    <option value="no_prefix">${escapeHtml(t("txWorkflowRollbackRuleNoPrefix"))}</option>
    <option value="set_delete">${escapeHtml(t("txWorkflowRollbackRuleSetDelete"))}</option>
    <option value="add_remove">${escapeHtml(t("txWorkflowRollbackRuleAddRemove"))}</option>
    <option value="custom">${escapeHtml(t("txWorkflowRollbackRuleCustom"))}</option>
  `;
  if (!byId("tx-rollback-rule").value) {
    byId("tx-rollback-rule").value = "no_prefix";
  }
  byId("tx-rollback-template").placeholder = t("txWorkflowRollbackTemplatePlaceholder");
  byId("tx-rollback-template-pick").innerHTML = rollbackTemplateOptionsHtml(
    byId("tx-rollback-template-name").value || ""
  );
  byId("tx-rollback-template-name").placeholder = t("txWorkflowRollbackLibraryName");
  byId("tx-rollback-template-save").textContent = t("txWorkflowRollbackLibrarySave");
  byId("tx-rollback-template-delete").textContent = t("txWorkflowRollbackLibraryDelete");
  byId("tx-rollback-commands").placeholder = t("txRollbackCommandsPlaceholder");
  byId("tx-rollback-on-failure-label").textContent = t("txRollbackOnFailureLabel");
  byId("tx-rollback-trigger-step").placeholder = t("txRollbackTriggerStepPlaceholder");
  byId("tx-rollback-empty-hint").textContent = t("txWorkflowRollbackEmptyHint");
  byId("tx-basic-title").textContent = t("txBasicTitle");
  byId("tx-stage-block").textContent = `1. ${t("txStageBlock")}`;
  byId("tx-stage-workflow").textContent = `2. ${t("txStageWorkflow")}`;
  byId("tx-plan-btn").textContent = t("txPlanBtn");
  byId("tx-exec-btn").textContent = t("txExecBtn");
  byId("tx-workflow-title").textContent = t("txWorkflowTitle");
  byId("tx-workflow-builder-title").textContent = t("txWorkflowBuilderTitle");
  byId("tx-workflow-import-block-btn").textContent = t("txWorkflowImportBlockBtn");
  byId("tx-workflow-add-block-btn").textContent = t("txWorkflowAddBlockBtn");
  byId("tx-workflow-collapse-all-btn").textContent = t("txWorkflowCollapseAllBtn");
  byId("tx-workflow-expand-all-btn").textContent = t("txWorkflowExpandAllBtn");
  byId("tx-workflow-name").placeholder = t("txWorkflowNamePlaceholder");
  byId("tx-workflow-fail-fast-label").textContent = t("txWorkflowFailFastLabel");
  const txWorkflowFilterKindEl = byId("tx-workflow-filter-kind");
  txWorkflowFilterKindEl.innerHTML = `
    <option value="all">${escapeHtml(t("txWorkflowFilterKindAll"))}</option>
    <option value="config">${escapeHtml(t("txWorkflowBlockKindConfig"))}</option>
    <option value="show">${escapeHtml(t("txWorkflowBlockKindShow"))}</option>
  `;
  txWorkflowFilterKindEl.value = txWorkflowFilterKind;
  const txWorkflowFilterRollbackEl = byId("tx-workflow-filter-rollback");
  txWorkflowFilterRollbackEl.innerHTML = `
    <option value="all">${escapeHtml(t("txWorkflowFilterRollbackAll"))}</option>
    <option value="none">${escapeHtml(t("txWorkflowBlockRollbackNone"))}</option>
    <option value="per_step">${escapeHtml(t("txWorkflowBlockRollbackPerStep"))}</option>
    <option value="whole_resource">${escapeHtml(t("txWorkflowBlockRollbackWhole"))}</option>
  `;
  txWorkflowFilterRollbackEl.value = txWorkflowFilterRollback;
  byId("tx-workflow-filter-query").placeholder = t("txWorkflowFilterSearchPlaceholder");
  byId("tx-workflow-filter-clear-btn").textContent = t("txWorkflowFilterClearBtn");
  byId("tx-workflow-generate-btn").textContent = t("txWorkflowGenerateBtn");
  byId("tx-workflow-load-btn").textContent = t("txWorkflowLoadBtn");
  byId("tx-workflow-download-btn").textContent = t("txWorkflowDownloadBtn");
  byId("tx-workflow-import-file-btn").textContent = t("txWorkflowImportFileBtn");
  byId("tx-workflow-json").placeholder = t("txWorkflowJsonPlaceholder");
  byId("tx-workflow-plan-btn").textContent = t("txWorkflowPlanBtn");
  byId("tx-workflow-exec-btn").textContent = t("txWorkflowExecBtn");
  byId("tx-workflow-exec-raw-toggle").textContent = t("txWorkflowExecRawBtn");
  renderTxWorkflowBuilder();
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
  byId("interactive-command").placeholder = t("interactiveCommandPlaceholder");
  byId("interactive-mode").placeholder = t("interactiveModePlaceholder");
  setEventKindOptions("record-event-kind", recordEventKind);
  setEventKindOptions("replay-event-kind", replayEventKind);
  localizeDynamicFields();
  renderRecordingView();
  renderReplayView();
  applyTxLayoutState();
  applyTxStage();
  applyTxWorkflowMoreActionsState();
  applyTxRollbackMode();
  applyTxRollbackRuleVisibility();
  updateSelectedBackupMeta();

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
  const tabs = ["ops", "interactive", "replay", "prompts", "templates", "backup"];
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

function setInteractiveStatus(text) {
  const el = byId("interactive-status");
  if (el) el.textContent = text;
}

function updateInteractiveButtons() {
  const active = !!interactiveSessionId;
  const startBtn = byId("interactive-start-btn");
  const stopBtn = byId("interactive-stop-btn");
  const sendBtn = byId("interactive-send-btn");
  if (startBtn) startBtn.disabled = active;
  if (stopBtn) stopBtn.disabled = !active;
  if (sendBtn) sendBtn.disabled = !active;
}

function isDeviceSelected() {
  const host = byId("host").value.trim();
  const saved = byId("saved-conn-name").value.trim();
  const profile = byId("device_profile").value.trim();
  return !!(host || saved || profile);
}

function updateRecordFabVisibility() {
  const wrap = byId("record-fab-wrap");
  if (!wrap) return;
  const visible = isDeviceSelected();
  wrap.hidden = !visible;
  wrap.style.display = visible ? "" : "none";
}

function updateRecordFabBadge(count) {
  const badge = byId("record-fab-badge");
  if (!badge) return;
  const value = Number(count) || 0;
  if (value <= 0) {
    badge.hidden = true;
    badge.style.display = "none";
    return;
  }
  badge.hidden = false;
  badge.style.display = "flex";
  badge.textContent = value > 99 ? "99+" : String(value);
}

function openRecordDrawer() {
  const backdrop = byId("record-drawer-backdrop");
  const drawer = byId("record-drawer");
  backdrop.classList.add("open");
  drawer.classList.add("open");
  document.body.classList.add("overflow-hidden");
}

function closeRecordDrawer() {
  const backdrop = byId("record-drawer-backdrop");
  const drawer = byId("record-drawer");
  backdrop.classList.remove("open");
  drawer.classList.remove("open");
  document.body.classList.remove("overflow-hidden");
}

function openHistoryDrawer() {
  const backdrop = byId("history-drawer-backdrop");
  const drawer = byId("history-drawer");
  backdrop.classList.add("open");
  drawer.classList.add("open");
  document.body.classList.add("overflow-hidden");
}

function closeHistoryDrawer() {
  const backdrop = byId("history-drawer-backdrop");
  const drawer = byId("history-drawer");
  backdrop.classList.remove("open");
  drawer.classList.remove("open");
  document.body.classList.remove("overflow-hidden");
}

function appendInteractiveLog(label, content) {
  const out = byId("interactive-out");
  if (!out) return;
  const ts = new Date().toLocaleTimeString();
  const prefix = label ? `${label}` : "output";
  out.textContent += `[${ts}] ${prefix}\n${content}\n\n`;
  out.scrollTop = out.scrollHeight;
}

function applyOperationKind() {
  const isExec = currentOpKind === "exec";
  const isTx = currentOpKind === "tx";
  byId("op-exec-fields").hidden = !isExec;
  byId("op-exec-fields").style.display = isExec ? "" : "none";
  byId("op-tx-fields").hidden = !isTx;
  byId("op-tx-fields").style.display = isTx ? "" : "none";
  byId("op-kind-exec").classList.toggle("is-active", isExec);
  byId("op-kind-tx").classList.toggle("is-active", isTx);
  byId("op-kind-exec").setAttribute("aria-selected", isExec ? "true" : "false");
  byId("op-kind-tx").setAttribute("aria-selected", isTx ? "true" : "false");
  if (isTx) {
    applyTxStage();
  }
  if (isExec) {
    applyExecMode();
  }
}

function applyExecMode() {
  const isDirect = currentExecMode === "direct";
  byId("op-exec-direct-fields").hidden = !isDirect;
  byId("op-exec-direct-fields").style.display = isDirect ? "" : "none";
  byId("op-exec-template-fields").hidden = isDirect;
  byId("op-exec-template-fields").style.display = isDirect ? "none" : "";
  byId("op-exec-direct").classList.toggle("is-active", isDirect);
  byId("op-exec-template").classList.toggle("is-active", !isDirect);
  byId("op-exec-direct").setAttribute("aria-selected", isDirect ? "true" : "false");
  byId("op-exec-template").setAttribute("aria-selected", isDirect ? "false" : "true");
  if (!isDirect && byId("template").value.trim()) {
    loadSelectedTemplateContent();
  }
}

function applyTxLayoutState() {
  const advancedFields = byId("tx-advanced-fields");
  const advancedToggleBtn = byId("tx-advanced-toggle-btn");
  if (advancedFields) {
    advancedFields.hidden = !txAdvancedExpanded;
    advancedFields.style.display = txAdvancedExpanded ? "" : "none";
  }
  if (advancedToggleBtn) {
    advancedToggleBtn.textContent = txAdvancedExpanded ? t("collapse") : t("txAdvancedBtn");
  }
}

function applyTxStage() {
  const isBlock = currentTxStage === "block";
  const isWorkflow = currentTxStage === "workflow";
  const blockBtn = byId("tx-stage-block");
  const workflowBtn = byId("tx-stage-workflow");
  const blockPanel = byId("tx-stage-block-panel");
  const workflowPanel = byId("tx-stage-workflow-panel");
  const hint = byId("tx-stage-hint");
  blockBtn.classList.toggle("is-active", isBlock);
  workflowBtn.classList.toggle("is-active", isWorkflow);
  blockBtn.setAttribute("aria-selected", isBlock ? "true" : "false");
  workflowBtn.setAttribute("aria-selected", isWorkflow ? "true" : "false");
  blockBtn.textContent = `1. ${t("txStageBlock")}`;
  workflowBtn.textContent = `2. ${t("txStageWorkflow")}`;
  blockPanel.hidden = !isBlock;
  blockPanel.style.display = isBlock ? "" : "none";
  workflowPanel.hidden = !isWorkflow;
  workflowPanel.style.display = isWorkflow ? "" : "none";
  if (hint) {
    hint.textContent = isBlock ? t("txStageHintBlock") : t("txStageHintWorkflow");
  }
}

function applyTxWorkflowMoreActionsState() {
  const btn = byId("tx-workflow-more-btn");
  const panel = byId("tx-workflow-more-panel");
  if (!btn || !panel) return;
  panel.hidden = !txWorkflowMoreExpanded;
  panel.style.display = txWorkflowMoreExpanded ? "" : "none";
  btn.textContent = txWorkflowMoreExpanded
    ? `${t("txWorkflowMoreBtn")} · ${t("collapse")}`
    : `${t("txWorkflowMoreBtn")} · ${t("expand")}`;
}

function applyTxRollbackMode() {
  const mode = byId("tx-rollback-mode").value || "infer";
  const perStep = byId("tx-rollback-per-step");
  const whole = byId("tx-rollback-resource");
  perStep.hidden = mode !== "per_step";
  perStep.style.display = mode === "per_step" ? "" : "none";
  whole.hidden = mode !== "whole_resource";
  whole.style.display = mode === "whole_resource" ? "" : "none";
  applyTxRollbackInputMode();
}

function applyTxRollbackInputMode() {
  const isText = txRollbackInputMode === "text";
  byId("tx-rollback-input-text").classList.toggle("is-active", isText);
  byId("tx-rollback-input-pairs").classList.toggle("is-active", !isText);
  byId("tx-rollback-commands").hidden = !isText;
  byId("tx-rollback-commands").style.display = isText ? "" : "none";
  byId("tx-rollback-pairs").hidden = isText;
  byId("tx-rollback-pairs").style.display = isText ? "none" : "";
  renderTxRollbackPairs();
}

function applyTxRollbackRuleVisibility() {
  const isCustom = byId("tx-rollback-rule").value === "custom";
  byId("tx-rollback-template").hidden = !isCustom;
  byId("tx-rollback-template").style.display = isCustom ? "" : "none";
}

function renderTxRollbackPairs() {
  if (txRollbackInputMode !== "pairs") return;
  const commands = parseTxCommands();
  const rollbacks = parseRollbackLinesRaw(byId("tx-rollback-commands").value || "");
  const wrap = byId("tx-rollback-pairs");
  const hint = byId("tx-rollback-empty-hint");
  if (!commands.length) {
    wrap.innerHTML = "";
    hint.hidden = false;
    hint.style.display = "";
    return;
  }
  hint.hidden = true;
  hint.style.display = "none";
  wrap.innerHTML = commands
    .map((cmd, idx) => {
      const val = rollbacks[idx] || "";
      return `
        <div class="grid gap-2 md:grid-cols-[1fr_1fr] tx-workflow-pair-row">
          <div class="input tx-workflow-pair-label">
            <span class="tx-workflow-pair-index">#${idx + 1}</span>
            <span class="tx-workflow-pair-command">${escapeHtml(cmd)}</span>
          </div>
          <input class="input js-tx-rollback-pair" data-index="${idx}" value="${escapeHtml(
        val
      )}" placeholder="${escapeHtml(t("txRollbackCommandsPlaceholder"))}" />
        </div>
      `;
    })
    .join("");
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

function renderTxWorkflowResult(result) {
  if (!result) return `<pre class="output">${escapeHtml(t("requestFailed"))}</pre>`;
  const failedIdx =
    typeof result.failed_block === "number" ? result.failed_block : null;
  const blocks = Array.isArray(result.block_results) ? result.block_results : [];
  const summary = `
    <div class="grid gap-2 md:grid-cols-3">
      <div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
        <div class="text-xs text-slate-500">workflow</div>
        <div class="mt-1 text-sm font-semibold text-slate-900">${escapeHtml(
          safeString(result.workflow_name)
        )}</div>
      </div>
      <div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
        <div class="text-xs text-slate-500">committed</div>
        <div class="mt-1 text-sm font-semibold text-slate-900">${escapeHtml(
          String(!!result.committed)
        )}</div>
      </div>
      <div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
        <div class="text-xs text-slate-500">rollback</div>
        <div class="mt-1 text-sm font-semibold text-slate-900">${escapeHtml(
          `attempted=${!!result.rollback_attempted} succeeded=${!!result.rollback_succeeded}`
        )}</div>
      </div>
    </div>
  `;
  const blockCards = blocks
    .map((block, idx) => {
      const isFailed = failedIdx === idx;
      const rollbackErrors = Array.isArray(block.rollback_errors)
        ? block.rollback_errors
        : [];
      const failedSummary = isFailed
        ? `
      <div class="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
        failed_block_rollback: attempted=${!!block.rollback_attempted} succeeded=${!!block.rollback_succeeded}
        ${
          rollbackErrors.length
            ? `<div class="mt-1">errors: ${escapeHtml(rollbackErrors.join(" | "))}</div>`
            : ""
        }
      </div>`
        : "";
      return `
      <section class="rounded-xl border border-slate-200 bg-white px-3 py-3">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="text-sm font-semibold text-slate-900">block[${idx}] ${escapeHtml(
            safeString(block.block_name)
          )}</div>
          <div class="text-xs text-slate-600">committed=${escapeHtml(
            String(!!block.committed)
          )}</div>
        </div>
        <div class="mt-2 grid gap-2 md:grid-cols-3 text-xs text-slate-700">
          <div>executed_steps=${escapeHtml(String(block.executed_steps))}</div>
          <div>rollback_attempted=${escapeHtml(String(!!block.rollback_attempted))}</div>
          <div>rollback_succeeded=${escapeHtml(String(!!block.rollback_succeeded))}</div>
        </div>
        ${
          rollbackErrors.length
            ? `<div class="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                rollback_errors: ${escapeHtml(rollbackErrors.join(" | "))}
              </div>`
            : ""
        }
        ${failedSummary}
      </section>
    `;
    })
    .join("");
  return `<div class="grid gap-3">${summary}${blockCards}</div>`;
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

  const parsed = parseJsonl(rawOut.value || "");
  if (!parsed.ok) {
    listOut.innerHTML = `<div class="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">${escapeHtml(
      parsed.error
    )}</div>`;
    updateRecordFabBadge(0);
    return;
  }
  const entries = filterEntries(parsed.rows, recordEventKind, recordFailedOnly, recordSearchQuery);
  updateRecordFabBadge(entries.length);
  if (!isList) {
    return;
  }
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

function historyMatchesSearch(item, query) {
  const q = (query || "").trim().toLowerCase();
  if (!q) return true;
  const fields = [
    item.command_label,
    item.operation,
    item.mode,
    item.device_profile,
    item.connection_name,
    item.host,
    item.port,
    item.username,
  ];
  const haystack = fields
    .filter((v) => v != null)
    .map((v) => String(v).toLowerCase())
    .join("\n");
  return haystack.includes(q);
}

function filterHistoryItems(items) {
  return (items || []).filter((item) => {
    const op = String(item.operation || "").toLowerCase();
    const opOk = historyFilterOperation === "all" ? true : op === historyFilterOperation;
    return opOk && historyMatchesSearch(item, historyFilterQuery);
  });
}

function renderHistoryDrawer() {
  const out = byId("history-drawer-out");
  if (!out) return;
  if (!Array.isArray(lastHistoryItems) || lastHistoryItems.length === 0) {
    out.innerHTML = `<div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">${escapeHtml(
      t("savedConnHistoryEmpty")
    )}</div>`;
    return;
  }
  const filtered = filterHistoryItems(lastHistoryItems);
  if (!filtered.length) {
    out.innerHTML = `<div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">${escapeHtml(
      t("noMatchedEntries")
    )}</div>`;
    return;
  }
  out.innerHTML = renderConnectionHistoryTable(filtered);
}

function renderSavedConnectionOptions(keyword = "") {
  const datalist = byId("saved-conn-options");
  const q = keyword.trim().toLowerCase();
  const names = cachedSavedConnections
    .map((item) => item.name)
    .filter((name) => (!q ? true : name.toLowerCase().includes(q)));
  datalist.innerHTML = names.map((name) => `<option value="${name}"></option>`).join("");
}

function renderBackupOptions(keyword = "") {
  const datalist = byId("backup-archive-options");
  const q = keyword.trim().toLowerCase();
  const rows = cachedBackups.filter((item) =>
    q ? (item.path || "").toLowerCase().includes(q) : true
  );
  datalist.innerHTML = rows
    .map((item) => `<option value="${escapeHtml(item.path || "")}"></option>`)
    .join("");
}

function selectedBackupNameFromInput() {
  const raw = byId("backup-restore-archive").value.trim();
  if (!raw) return "";
  const matched = cachedBackups.find(
    (item) => (item.path || "") === raw || (item.name || "") === raw
  );
  if (matched && matched.name) {
    return matched.name;
  }
  const tail = raw.split("/").pop();
  if (!tail) return "";
  const hit = cachedBackups.find((item) => (item.name || "") === tail);
  return hit && hit.name ? hit.name : "";
}

function selectedBackupFromInput() {
  const raw = byId("backup-restore-archive").value.trim();
  if (!raw) return null;
  const matched = cachedBackups.find(
    (item) => (item.path || "") === raw || (item.name || "") === raw
  );
  if (matched) return matched;
  const tail = raw.split("/").pop();
  if (!tail) return null;
  return cachedBackups.find((item) => (item.name || "") === tail) || null;
}

function formatBytes(bytes) {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value < 0) return "-";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 * 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  return `${(value / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function updateSelectedBackupMeta() {
  const el = byId("backup-selected-meta");
  if (!el) return;
  const item = selectedBackupFromInput();
  if (!item) {
    el.textContent = "-";
    return;
  }
  el.textContent = `${t("backupSelectedMetaLabel")}: ${item.name || "-"} · ${t(
    "backupMetaSize"
  )}: ${formatBytes(item.size_bytes)} · ${t("backupMetaTime")}: ${formatHistoryTime(
    item.modified_ms
  )}`;
}

function renderBackupList() {
  const out = byId("backup-list");
  if (!out) return;
  if (!Array.isArray(cachedBackups) || cachedBackups.length === 0) {
    out.innerHTML =
      '<div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">-</div>';
    return;
  }
  const selected = selectedBackupFromInput();
  out.innerHTML = cachedBackups
    .map((item) => {
      const active =
        selected &&
        ((selected.name || "") === (item.name || "") || (selected.path || "") === (item.path || ""));
      const cls = active
        ? "border-teal-300 bg-teal-50/70"
        : "border-slate-200 bg-white hover:border-slate-300";
      return `
      <button
        type="button"
        class="w-full rounded-xl border px-3 py-2 text-left transition ${cls} js-backup-row"
        data-backup-path="${escapeHtml(item.path || "")}"
        data-backup-name="${escapeHtml(item.name || "")}"
      >
        <div class="flex items-center justify-between gap-2">
          <span class="text-sm font-semibold text-slate-800">${escapeHtml(item.name || "-")}</span>
          <span class="text-xs text-slate-500">${escapeHtml(formatBytes(item.size_bytes))}</span>
        </div>
        <div class="mt-1 text-xs text-slate-500">${escapeHtml(item.path || "-")}</div>
        <div class="mt-1 flex flex-wrap items-center justify-between gap-2">
          <span class="text-xs text-slate-400">${escapeHtml(
            `${t("backupMetaTime")}: ${formatHistoryTime(item.modified_ms)}`
          )}</span>
          <span class="inline-flex items-center gap-2">
            <button
              type="button"
              class="mini-btn js-backup-download"
              data-backup-path="${escapeHtml(item.path || "")}"
              data-backup-name="${escapeHtml(item.name || "")}"
            >${escapeHtml(t("backupDownloadBtn"))}</button>
            <button
              type="button"
              class="mini-btn js-backup-restore-merge"
              data-backup-path="${escapeHtml(item.path || "")}"
              data-backup-name="${escapeHtml(item.name || "")}"
            >${escapeHtml(t("backupRestoreMergeBtn"))}</button>
            <button
              type="button"
              class="mini-btn delete js-backup-restore-replace"
              data-backup-path="${escapeHtml(item.path || "")}"
              data-backup-name="${escapeHtml(item.name || "")}"
            >${escapeHtml(t("backupRestoreReplaceBtn"))}</button>
          </span>
        </div>
      </button>`;
    })
    .join("");
}

async function loadBackups() {
  const out = byId("backup-out");
  try {
    const data = await request("GET", "/api/backups");
    cachedBackups = Array.isArray(data) ? data : [];
    renderBackupOptions(byId("backup-restore-archive").value || "");
    updateSelectedBackupMeta();
    renderBackupList();
    if (!out.textContent || out.textContent.trim() === "-" || out.textContent.includes("running")) {
      out.textContent = "-";
    }
  } catch (e) {
    cachedBackups = [];
    renderBackupOptions("");
    updateSelectedBackupMeta();
    renderBackupList();
    out.textContent = e.message;
  }
}

async function createBackupFromWeb() {
  const out = byId("backup-out");
  out.textContent = t("running");
  try {
    const output = byId("backup-output-path").value.trim();
    const data = await request("POST", "/api/backups", {
      output: output || null,
    });
    const path = (data && data.path) || "-";
    out.textContent = `${t("backupCreated")}: ${path}`;
    if (path && path !== "-") {
      byId("backup-restore-archive").value = path;
    }
    await loadBackups();
  } catch (e) {
    out.textContent = e.message;
  }
}

async function restoreBackupFromWeb(replace = false) {
  const out = byId("backup-out");
  const archive = byId("backup-restore-archive").value.trim();
  if (!archive) {
    out.textContent = t("backupArchiveRequired");
    return;
  }
  const confirmText = replace
    ? t("backupRestoreConfirmReplace")
    : t("backupRestoreConfirmMerge");
  if (!window.confirm(confirmText)) {
    return;
  }
  out.textContent = t("running");
  try {
    const data = await request("POST", "/api/backups/restore", {
      archive,
      replace,
    });
    out.textContent = `${t("backupRestored")}: ${data.archive || archive}`;
    await loadBackups();
    await loadSavedConnections();
    await loadProfilesOverview();
    await loadTemplates();
  } catch (e) {
    out.textContent = e.message;
  }
}

function downloadBackupFromWeb() {
  const out = byId("backup-out");
  const name = selectedBackupNameFromInput();
  if (!name) {
    out.textContent = t("backupPickOne");
    return;
  }
  const url = `/api/backups/${encodeURIComponent(name)}/download`;
  window.open(url, "_blank");
}

function selectBackupPath(path) {
  if (!path) return;
  byId("backup-restore-archive").value = path;
  updateSelectedBackupMeta();
  renderBackupList();
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
  updateRecordFabVisibility();
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
  const out = byId("history-drawer-out");
  byId("history-drawer-conn-name").textContent = name || "-";
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
    const limit = Number(byId("history-filter-limit").value || historyFilterLimit || 30);
    const data = await request(
      "GET",
      `/api/connections/${encodeURIComponent(name)}/history?limit=${Number.isFinite(limit) ? limit : 30}`
    );
    lastHistoryItems = Array.isArray(data) ? data : [];
    renderHistoryDrawer();
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

function parseJsonById(id) {
  const raw = byId(id).value.trim();
  if (!raw) return {};
  return JSON.parse(raw);
}

function parseTxCommands() {
  const lines = (byId("tx-commands").value || "")
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => !!s);
  return lines;
}

function parseRollbackLinesRaw(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map((s) => s.trim());
}

function txPayload(dryRun) {
  const timeoutRaw = byId("tx-timeout-secs").value.trim();
  const timeout = timeoutRaw ? Number(timeoutRaw) : null;
  const rollbackMode = byId("tx-rollback-mode").value || "infer";
  return {
    name: byId("tx-name").value.trim() || null,
    template: byId("tx-template").value.trim() || null,
    vars: parseJsonById("tx-vars"),
    commands: parseTxCommands(),
    mode: byId("tx-mode").value.trim() || null,
    timeout_secs: Number.isFinite(timeout) && timeout > 0 ? timeout : null,
    resource_rollback_command:
      rollbackMode === "whole_resource"
        ? byId("tx-resource-rollback").value.trim() || null
        : null,
    rollback_on_failure: byId("tx-rollback-on-failure").checked,
    rollback_trigger_step_index:
      rollbackMode === "whole_resource"
        ? Number(byId("tx-rollback-trigger-step").value || 0)
        : null,
    rollback_commands:
      rollbackMode === "per_step"
        ? parseRollbackLinesRaw(byId("tx-rollback-commands").value || "")
        : [],
    template_profile: byId("tx-template-profile").value.trim() || null,
    dry_run: dryRun,
    connection: connectionPayload(),
    record_level: recordLevelPayload(),
  };
}

function txWorkflowPayload(dryRun) {
  const raw = byId("tx-workflow-json").value.trim();
  if (!raw) {
    throw new Error(t("txWorkflowJsonRequired"));
  }
  return {
    workflow: JSON.parse(raw),
    dry_run: dryRun,
    connection: connectionPayload(),
    record_level: recordLevelPayload(),
  };
}

async function startInteractive() {
  setInteractiveStatus(t("interactiveStatusRunning"));
  try {
    const data = await request("POST", "/api/interactive/start", {
      connection: connectionPayload(),
      record_level: recordLevelPayload(),
    });
    interactiveSessionId = data.session_id || null;
    if (interactiveSessionId) {
      setInteractiveStatus(`${t("interactiveStatusReady")} · ${interactiveSessionId}`);
    } else {
      setInteractiveStatus(t("interactiveStatusNoSession"));
    }
  } catch (e) {
    interactiveSessionId = null;
    setInteractiveStatus(e.message);
  }
  updateInteractiveButtons();
}

async function sendInteractiveCommand() {
  const command = byId("interactive-command").value.trim();
  const mode = byId("interactive-mode").value.trim();
  if (!interactiveSessionId) {
    setInteractiveStatus(t("interactiveStatusNoSession"));
    updateInteractiveButtons();
    return;
  }
  if (!command) {
    setInteractiveStatus(t("commandRequired"));
    return;
  }
  setInteractiveStatus(t("running"));
  try {
    const data = await request("POST", "/api/interactive/command", {
      session_id: interactiveSessionId,
      command,
      mode: mode || null,
    });
    appendInteractiveLog(command, data.output || "");
    setInteractiveStatus(`${t("interactiveStatusReady")} · ${interactiveSessionId}`);
  } catch (e) {
    setInteractiveStatus(e.message);
  }
}

async function stopInteractive() {
  if (!interactiveSessionId) {
    setInteractiveStatus(t("interactiveStatusNoSession"));
    updateInteractiveButtons();
    return;
  }
  const id = interactiveSessionId;
  setInteractiveStatus(t("running"));
  try {
    const data = await request(
      "DELETE",
      `/api/interactive/${encodeURIComponent(id)}`
    );
    if (data && data.recording_jsonl) {
      byId("record-jsonl").value = String(data.recording_jsonl);
      renderRecordingView();
    }
    setInteractiveStatus(t("interactiveStatusStopped"));
  } catch (e) {
    setInteractiveStatus(e.message);
  } finally {
    interactiveSessionId = null;
    updateInteractiveButtons();
  }
}

function createTxWorkflowBlock(seed = {}) {
  txWorkflowBlockSeq += 1;
  return {
    id: `tx-block-${txWorkflowBlockSeq}`,
    name: seed.name || "",
    kind: seed.kind || "config",
    rollbackPolicy: seed.rollbackPolicy || "per_step",
    mode: seed.mode || "Config",
    timeoutSecs: seed.timeoutSecs != null ? String(seed.timeoutSecs) : "",
    undoCommand: seed.undoCommand || "",
    commandsText: seed.commandsText || "",
    rollbackCommandsText: seed.rollbackCommandsText || "",
    failFast: seed.failFast !== false,
    collapsed: seed.collapsed === true,
    rollbackInputMode: seed.rollbackInputMode || "text",
    rollbackRule: seed.rollbackRule || "no_prefix",
    rollbackRuleTemplate: seed.rollbackRuleTemplate || "",
    rollbackOnFailure: seed.rollbackOnFailure === true,
    triggerStepIndex:
      seed.triggerStepIndex != null && seed.triggerStepIndex !== ""
        ? String(seed.triggerStepIndex)
        : "",
  };
}

function renderTxWorkflowBuilder() {
  const wrap = byId("tx-workflow-blocks");
  if (!wrap) return;
  const activeEl = document.activeElement;
  const active = activeEl
    ? {
        blockId: activeEl.getAttribute && activeEl.getAttribute("data-tx-block-id"),
        field: activeEl.getAttribute && activeEl.getAttribute("data-field"),
        cls: activeEl.classList ? Array.from(activeEl.classList) : [],
        index: activeEl.getAttribute && activeEl.getAttribute("data-index"),
        selStart:
          typeof activeEl.selectionStart === "number" ? activeEl.selectionStart : null,
        selEnd: typeof activeEl.selectionEnd === "number" ? activeEl.selectionEnd : null,
      }
    : null;
  if (!txWorkflowBlocks.length) {
    wrap.innerHTML = `<div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">${escapeHtml(
      t("txWorkflowBuilderEmpty")
    )}</div>`;
    return;
  }
  const filteredBlocks = getFilteredTxWorkflowBlocks();
  if (!filteredBlocks.length) {
    wrap.innerHTML = `<div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">${escapeHtml(
      t("txWorkflowFilterNoMatch")
    )}</div>`;
    return;
  }
  wrap.innerHTML = filteredBlocks
    .map(
      (block) => {
        const fullIdx = txWorkflowBlocks.findIndex((b) => b.id === block.id);
        const commandCount = txWorkflowLines(block.commandsText).length;
        const modeText = block.mode && block.mode.trim() ? block.mode.trim() : "Config";
        const kindText = block.kind === "show" ? "show" : "config";
        const rollbackText = block.rollbackPolicy || "per_step";
        const commandsList = txWorkflowLines(block.commandsText);
        const rollbackList = parseRollbackLinesRaw(block.rollbackCommandsText);
        const rollbackMode = block.rollbackInputMode || "text";
        const rollbackRule = block.rollbackRule || "no_prefix";
        const libraryName = block.rollbackLibraryName || "";
        return `
      <div class="group-card" data-tx-block-id="${escapeHtml(block.id)}">
        <div class="field-tools">
          <div class="grid gap-1">
            <span>#${fullIdx + 1}</span>
            <div class="inline-flex flex-wrap items-center gap-1">
              <span class="tx-workflow-chip">${escapeHtml(t("txWorkflowSummaryCommands"))}: ${commandCount}</span>
              <span class="tx-workflow-chip">${escapeHtml(t("txWorkflowSummaryKind"))}: ${escapeHtml(kindText)}</span>
              <span class="tx-workflow-chip">${escapeHtml(t("txWorkflowSummaryMode"))}: ${escapeHtml(modeText)}</span>
              <span class="tx-workflow-chip">${escapeHtml(t("txWorkflowSummaryRollback"))}: ${escapeHtml(rollbackText)}</span>
            </div>
          </div>
          <div class="inline-flex items-center gap-2">
            <button type="button" class="mini-btn js-tx-workflow-toggle-block" data-tx-block-id="${escapeHtml(
              block.id
            )}">${escapeHtml(block.collapsed ? t("expand") : t("collapse"))}</button>
            <button type="button" class="mini-btn js-tx-workflow-drag-block" data-tx-block-id="${escapeHtml(
              block.id
            )}" draggable="true">${escapeHtml(t("txWorkflowDragBtn"))}</button>
            <button type="button" class="mini-btn js-tx-workflow-move-up-block" data-tx-block-id="${escapeHtml(
              block.id
            )}" ${fullIdx === 0 ? "disabled" : ""}>${escapeHtml(t("txWorkflowMoveUpBtn"))}</button>
            <button type="button" class="mini-btn js-tx-workflow-move-down-block" data-tx-block-id="${escapeHtml(
              block.id
            )}" ${fullIdx === txWorkflowBlocks.length - 1 ? "disabled" : ""}>${escapeHtml(
        t("txWorkflowMoveDownBtn")
      )}</button>
            <button type="button" class="mini-btn js-tx-workflow-copy-block" data-tx-block-id="${escapeHtml(
              block.id
            )}">${escapeHtml(t("txWorkflowCopyBlockBtn"))}</button>
            <button type="button" class="mini-btn delete js-tx-workflow-delete-block" data-tx-block-id="${escapeHtml(
              block.id
            )}">${escapeHtml(t("txWorkflowDeleteBlockBtn"))}</button>
          </div>
        </div>
        <div class="group-body grid gap-2" ${block.collapsed ? "hidden" : ""}>
          <input class="input js-tx-workflow-field" data-field="name" data-tx-block-id="${escapeHtml(
            block.id
          )}" value="${escapeHtml(block.name)}" placeholder="${escapeHtml(
        t("txWorkflowBlockNamePlaceholder")
      )}" />
          <div class="grid gap-2 md:grid-cols-2">
            <input class="input js-tx-workflow-field" data-field="mode" data-tx-block-id="${escapeHtml(
              block.id
            )}" value="${escapeHtml(block.mode)}" placeholder="${escapeHtml(
        t("txWorkflowBlockModePlaceholder")
      )}" />
            <select class="input js-tx-workflow-field" data-field="kind" data-tx-block-id="${escapeHtml(
              block.id
            )}">
              <option value="config" ${block.kind === "config" ? "selected" : ""}>${escapeHtml(
        t("txWorkflowBlockKindConfig")
      )}</option>
              <option value="show" ${block.kind === "show" ? "selected" : ""}>${escapeHtml(
        t("txWorkflowBlockKindShow")
      )}</option>
            </select>
          </div>
          <div class="grid gap-2 md:grid-cols-2">
            <select class="input js-tx-workflow-field" data-field="rollbackPolicy" data-tx-block-id="${escapeHtml(
              block.id
            )}">
              <option value="none" ${block.rollbackPolicy === "none" ? "selected" : ""}>${escapeHtml(
        t("txWorkflowBlockRollbackNone")
      )}</option>
              <option value="per_step" ${block.rollbackPolicy === "per_step" ? "selected" : ""}>${escapeHtml(
        t("txWorkflowBlockRollbackPerStep")
      )}</option>
              <option value="whole_resource" ${
                block.rollbackPolicy === "whole_resource" ? "selected" : ""
              }>${escapeHtml(t("txWorkflowBlockRollbackWhole"))}</option>
            </select>
            <input class="input js-tx-workflow-field" data-field="timeoutSecs" data-tx-block-id="${escapeHtml(
              block.id
            )}" value="${escapeHtml(block.timeoutSecs)}" placeholder="${escapeHtml(
        t("txWorkflowBlockTimeoutPlaceholder")
      )}" />
          </div>
          ${
            block.rollbackPolicy === "whole_resource"
              ? `
          <div class="grid gap-2 md:grid-cols-2">
            <input class="input js-tx-workflow-field" data-field="undoCommand" data-tx-block-id="${escapeHtml(
              block.id
            )}" value="${escapeHtml(block.undoCommand)}" placeholder="${escapeHtml(
                  t("txWorkflowBlockUndoPlaceholder")
                )}" />
            <input class="input js-tx-workflow-field" data-field="triggerStepIndex" data-tx-block-id="${escapeHtml(
              block.id
            )}" value="${escapeHtml(block.triggerStepIndex || "")}" placeholder="${escapeHtml(
                  t("txWorkflowRollbackTriggerStepPlaceholder")
                )}" />
          </div>
          `
              : `
          <input class="input js-tx-workflow-field" data-field="undoCommand" data-tx-block-id="${escapeHtml(
            block.id
          )}" value="${escapeHtml(block.undoCommand)}" placeholder="${escapeHtml(
                  t("txWorkflowBlockUndoPlaceholder")
                )}" />
          `
          }
          ${
            block.rollbackPolicy === "per_step"
              ? `
          <label class="check-label">
            <input type="checkbox" class="check-input js-tx-workflow-field" data-field="rollbackOnFailure" data-tx-block-id="${escapeHtml(
              block.id
            )}" ${block.rollbackOnFailure ? "checked" : ""} />
            <span>${escapeHtml(t("txWorkflowRollbackOnFailureLabel"))}</span>
          </label>
          `
              : ""
          }
          <label class="check-label">
            <input type="checkbox" class="check-input js-tx-workflow-field" data-field="failFast" data-tx-block-id="${escapeHtml(
              block.id
            )}" ${block.failFast ? "checked" : ""} />
            <span>${escapeHtml(t("txWorkflowFailFastLabel"))}</span>
          </label>
          <textarea class="input min-h-24 font-mono js-tx-workflow-field" data-field="commandsText" data-tx-block-id="${escapeHtml(
            block.id
          )}" placeholder="${escapeHtml(t("txWorkflowBlockCommandsPlaceholder"))}">${escapeHtml(
        block.commandsText
      )}</textarea>
          ${
            block.rollbackPolicy === "per_step"
              ? `
          <div class="grid gap-2">
            <div class="inline-flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-600">
              <span>${escapeHtml(t("txWorkflowRollbackInputModeLabel"))}</span>
              <div class="tab-group">
                <button type="button" class="tab-btn ${rollbackMode === "text" ? "is-active" : ""} js-tx-workflow-rollback-mode" data-mode="text" data-tx-block-id="${escapeHtml(
                  block.id
                )}">${escapeHtml(t("txWorkflowRollbackInputText"))}</button>
                <button type="button" class="tab-btn ${rollbackMode === "pairs" ? "is-active" : ""} js-tx-workflow-rollback-mode" data-mode="pairs" data-tx-block-id="${escapeHtml(
                  block.id
                )}">${escapeHtml(t("txWorkflowRollbackInputPairs"))}</button>
              </div>
            </div>
            ${
              rollbackMode === "pairs"
                ? `
            <div class="grid gap-2">
              <div class="inline-flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <button type="button" class="mini-btn js-tx-workflow-rollback-auto" data-tx-block-id="${escapeHtml(
                  block.id
                )}">${escapeHtml(t("txWorkflowRollbackAutoBtn"))}</button>
                <span>${escapeHtml(t("txWorkflowRollbackAutoHint"))}</span>
                <span class="ml-2 text-slate-400">${escapeHtml(t("txWorkflowRollbackRuleLabel"))}</span>
                <select class="input js-tx-workflow-rollback-rule" data-tx-block-id="${escapeHtml(
                  block.id
                )}">
                  <option value="no_prefix" ${rollbackRule === "no_prefix" ? "selected" : ""}>${escapeHtml(
                    t("txWorkflowRollbackRuleNoPrefix")
                  )}</option>
                  <option value="set_delete" ${rollbackRule === "set_delete" ? "selected" : ""}>${escapeHtml(
                    t("txWorkflowRollbackRuleSetDelete")
                  )}</option>
                  <option value="add_remove" ${rollbackRule === "add_remove" ? "selected" : ""}>${escapeHtml(
                    t("txWorkflowRollbackRuleAddRemove")
                  )}</option>
                  <option value="custom" ${rollbackRule === "custom" ? "selected" : ""}>${escapeHtml(
                    t("txWorkflowRollbackRuleCustom")
                  )}</option>
                </select>
                ${
                  rollbackRule === "custom"
                    ? `<input class="input js-tx-workflow-rollback-template" data-tx-block-id="${escapeHtml(
                        block.id
                      )}" value="${escapeHtml(
                        block.rollbackRuleTemplate || ""
                      )}" placeholder="${escapeHtml(
                        t("txWorkflowRollbackTemplatePlaceholder")
                      )}" />`
                    : ""
                }
              </div>
              <div class="grid gap-2 md:grid-cols-[1fr_1fr_auto_auto]">
                <select class="input js-tx-workflow-rollback-template-pick" data-tx-block-id="${escapeHtml(
                  block.id
                )}">
                  ${rollbackTemplateOptionsHtml(libraryName)}
                </select>
                <input class="input js-tx-workflow-rollback-template-name" data-tx-block-id="${escapeHtml(
                  block.id
                )}" value="${escapeHtml(libraryName)}" placeholder="${escapeHtml(
                  t("txWorkflowRollbackLibraryName")
                )}" />
                <button type="button" class="mini-btn js-tx-workflow-rollback-template-save" data-tx-block-id="${escapeHtml(
                  block.id
                )}">${escapeHtml(t("txWorkflowRollbackLibrarySave"))}</button>
                <button type="button" class="mini-btn delete js-tx-workflow-rollback-template-delete" data-tx-block-id="${escapeHtml(
                  block.id
                )}">${escapeHtml(t("txWorkflowRollbackLibraryDelete"))}</button>
              </div>
              ${
                commandsList.length
                  ? commandsList
                      .map((cmd, cmdIdx) => {
                        const rollbackValue = rollbackList[cmdIdx] || "";
                        return `
                <div class="grid gap-2 md:grid-cols-[1fr_1fr] tx-workflow-pair-row">
                  <div class="input tx-workflow-pair-label">
                    <span class="tx-workflow-pair-index">#${cmdIdx + 1}</span>
                    <span class="tx-workflow-pair-command">${escapeHtml(cmd)}</span>
                  </div>
                  <input class="input js-tx-workflow-rollback-pair" data-tx-block-id="${escapeHtml(
                    block.id
                  )}" data-index="${cmdIdx}" value="${escapeHtml(
                          rollbackValue
                        )}" placeholder="${escapeHtml(
                          t("txWorkflowBlockRollbacksPlaceholder")
                        )}" />
                </div>
              `;
                      })
                      .join("")
                  : `<div class="text-xs text-slate-500">${escapeHtml(
                      t("txWorkflowRollbackEmptyHint")
                    )}</div>`
              }
            </div>
            `
                : `
            <textarea class="input min-h-24 font-mono js-tx-workflow-field" data-field="rollbackCommandsText" data-tx-block-id="${escapeHtml(
              block.id
            )}" placeholder="${escapeHtml(
                    t("txWorkflowBlockRollbacksPlaceholder")
                  )}">${escapeHtml(block.rollbackCommandsText)}</textarea>
            `
            }
          </div>
          `
              : `
          <textarea class="input min-h-24 font-mono js-tx-workflow-field" data-field="rollbackCommandsText" data-tx-block-id="${escapeHtml(
            block.id
          )}" placeholder="${escapeHtml(
                  t("txWorkflowBlockRollbacksPlaceholder")
                )}">${escapeHtml(block.rollbackCommandsText)}</textarea>
          `
          }
        </div>
      </div>
    `;
      }
    )
    .join("");

  if (active && active.blockId) {
    let target = null;
    if (active.cls && active.cls.includes("js-tx-workflow-rollback-pair")) {
      target = wrap.querySelector(
        `.js-tx-workflow-rollback-pair[data-tx-block-id="${active.blockId}"][data-index="${active.index}"]`
      );
    } else if (active.field) {
      target = wrap.querySelector(
        `.js-tx-workflow-field[data-tx-block-id="${active.blockId}"][data-field="${active.field}"]`
      );
    }
    if (target) {
      target.focus();
      if (active.selStart != null && active.selEnd != null && target.setSelectionRange) {
        try {
          target.setSelectionRange(active.selStart, active.selEnd);
        } catch (_) {}
      }
    }
  }
}

function txWorkflowLines(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => !!s);
}

function autoScrollDuringDrag(event, container) {
  const y = event.clientY;
  const threshold = 96;
  const step = 22;
  if (!Number.isFinite(y)) return;

  if (container && container.scrollHeight > container.clientHeight) {
    const rect = container.getBoundingClientRect();
    if (y < rect.top + threshold) {
      container.scrollTop -= step;
      return;
    }
    if (y > rect.bottom - threshold) {
      container.scrollTop += step;
      return;
    }
  }

  const vpHeight = window.innerHeight || document.documentElement.clientHeight;
  if (y < threshold) {
    window.scrollBy(0, -step);
  } else if (y > vpHeight - threshold) {
    window.scrollBy(0, step);
  }
}

function clearTxWorkflowDropMarkers(container) {
  if (!container) return;
  container
    .querySelectorAll(
      ".tx-workflow-drop-target, .tx-workflow-drop-before, .tx-workflow-drop-after"
    )
    .forEach((el) => {
      el.classList.remove("tx-workflow-drop-target");
      el.classList.remove("tx-workflow-drop-before");
      el.classList.remove("tx-workflow-drop-after");
    });
}

function buildRollbackCommand(rule, cmd, template) {
  const raw = String(cmd || "").trim();
  if (!raw) return "";
  if (rule === "set_delete") {
    if (raw.startsWith("set ")) return `delete ${raw.slice(4).trim()}`;
    if (raw.startsWith("delete ")) return raw;
    return `no ${raw}`;
  }
  if (rule === "add_remove") {
    if (raw.startsWith("add ")) return `remove ${raw.slice(4).trim()}`;
    if (raw.startsWith("remove ")) return raw;
    return `no ${raw}`;
  }
  if (rule === "custom") {
    const tpl = String(template || "").trim();
    if (!tpl) return "";
    return tpl.replaceAll("{{cmd}}", raw);
  }
  if (raw.startsWith("no ")) return raw;
  return `no ${raw}`;
}

function getFilteredTxWorkflowBlocks() {
  const query = txWorkflowFilterQuery.trim().toLowerCase();
  return txWorkflowBlocks.filter((block) => {
    const kindOk = txWorkflowFilterKind === "all" || block.kind === txWorkflowFilterKind;
    const rollbackOk =
      txWorkflowFilterRollback === "all" ||
      block.rollbackPolicy === txWorkflowFilterRollback;
    const queryOk =
      !query ||
      String(block.name || "").toLowerCase().includes(query) ||
      String(block.commandsText || "").toLowerCase().includes(query);
    return kindOk && rollbackOk && queryOk;
  });
}

function setAllTxWorkflowBlocksCollapsed(collapsed) {
  txWorkflowBlocks.forEach((block) => {
    block.collapsed = !!collapsed;
  });
  renderTxWorkflowBuilder();
}

function generateTxWorkflowJsonFromBuilder() {
  const name = byId("tx-workflow-name").value.trim() || "tx-workflow";
  const failFast = byId("tx-workflow-fail-fast").checked;
  const blocks = txWorkflowBlocks.map((block) => {
    const commands = txWorkflowLines(block.commandsText);
    const rollbacks = parseRollbackLinesRaw(block.rollbackCommandsText);
    const timeout = block.timeoutSecs ? Number(block.timeoutSecs) : null;
    const timeoutSecs = Number.isFinite(timeout) && timeout > 0 ? timeout : null;
    const mode = block.mode.trim() || "Config";
    const kind = block.kind === "show" ? "show" : "config";
    const triggerRaw =
      block.rollbackPolicy === "whole_resource" ? block.triggerStepIndex : "";
    const triggerStepIndex = Number.isFinite(Number(triggerRaw))
      ? Number(triggerRaw)
      : 0;

    const applyRollbackOnFailure =
      block.rollbackPolicy === "per_step" && block.rollbackOnFailure === true;
    const steps = commands.map((command, idx) => ({
      mode,
      command,
      timeout_secs: timeoutSecs,
      rollback_command:
        block.rollbackPolicy === "per_step"
          ? rollbacks[idx] && rollbacks[idx].trim()
            ? rollbacks[idx]
            : null
          : null,
      rollback_on_failure: applyRollbackOnFailure,
    }));

    let rollbackPolicy;
    if (kind === "show" || block.rollbackPolicy === "none") {
      rollbackPolicy = "none";
    } else if (block.rollbackPolicy === "whole_resource") {
      rollbackPolicy = {
        whole_resource: {
          mode,
          undo_command: block.undoCommand.trim(),
          trigger_step_index: triggerStepIndex,
          timeout_secs: timeoutSecs,
        },
      };
    } else {
      rollbackPolicy = "per_step";
    }

    return {
      name: block.name.trim() || "tx-block",
      kind,
      rollback_policy: rollbackPolicy,
      steps,
      fail_fast: block.failFast,
    };
  });
    const workflow = {
      name,
      blocks,
      fail_fast: failFast,
    };
    byId("tx-workflow-json").value = JSON.stringify(workflow, null, 2);
}

function loadTxWorkflowBuilderFromJson() {
  const raw = byId("tx-workflow-json").value.trim();
  if (!raw) return;
  const workflow = JSON.parse(raw);
  byId("tx-workflow-name").value = workflow.name || "";
  byId("tx-workflow-fail-fast").checked = workflow.fail_fast !== false;
  const blocks = Array.isArray(workflow.blocks) ? workflow.blocks : [];
  txWorkflowBlocks = blocks.map((b) => {
    const steps = Array.isArray(b.steps) ? b.steps : [];
    const mode = (steps[0] && steps[0].mode) || "Config";
    const timeoutSecs = (steps[0] && steps[0].timeout_secs) || null;
    const rollbackOnFailure = steps.some((s) => s.rollback_on_failure === true);
    let rollbackPolicy = "per_step";
    let undoCommand = "";
    let triggerStepIndex = 0;
    if (typeof b.rollback_policy === "string") {
      rollbackPolicy = b.rollback_policy;
    } else if (
      b.rollback_policy &&
      typeof b.rollback_policy === "object" &&
      b.rollback_policy.whole_resource
    ) {
      rollbackPolicy = "whole_resource";
      undoCommand = b.rollback_policy.whole_resource.undo_command || "";
      triggerStepIndex = b.rollback_policy.whole_resource.trigger_step_index || 0;
    }
    return createTxWorkflowBlock({
      name: b.name || "",
      kind: b.kind || "config",
      rollbackPolicy,
      mode,
      timeoutSecs,
      undoCommand,
      rollbackOnFailure,
      triggerStepIndex,
      commandsText: steps.map((s) => s.command || "").join("\n"),
      rollbackCommandsText: steps
        .map((s) => (s.rollback_command != null ? String(s.rollback_command) : ""))
        .join("\n"),
      failFast: b.fail_fast !== false,
    });
  });
  renderTxWorkflowBuilder();
}

function downloadTxWorkflowJsonFromBuilder() {
  generateTxWorkflowJsonFromBuilder();
  const content = byId("tx-workflow-json").value || "";
  const nameRaw = (byId("tx-workflow-name").value || "").trim() || "tx-workflow";
  const safeName = nameRaw.replace(/[^a-zA-Z0-9._-]+/g, "-");
  const fileName = `${safeName}.json`;
  const blob = new Blob([content], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function importTxWorkflowBuilderFromFile() {
  const out = byId("tx-workflow-plan-out");
  const input = byId("tx-workflow-import-file-input");
  const file = input && input.files && input.files[0] ? input.files[0] : null;
  if (!file) {
    throw new Error(t("txWorkflowImportFileInvalid"));
  }
  const text = await file.text();
  byId("tx-workflow-json").value = text;
  loadTxWorkflowBuilderFromJson();
  out.textContent = t("txWorkflowImportFileDone");
  input.value = "";
}

function txBlockToBuilderSeed(block) {
  const steps = Array.isArray(block && block.steps) ? block.steps : [];
  const mode = (steps[0] && steps[0].mode) || "Config";
  const timeoutSecs = (steps[0] && steps[0].timeout_secs) || null;
  let rollbackPolicy = "per_step";
  let triggerStepIndex = 0;
  let undoCommand = "";
  const rp = block && block.rollback_policy;
  if (typeof rp === "string") {
    rollbackPolicy = rp;
  } else if (rp && typeof rp === "object" && rp.whole_resource) {
    rollbackPolicy = "whole_resource";
    undoCommand = rp.whole_resource.undo_command || "";
    triggerStepIndex = rp.whole_resource.trigger_step_index || 0;
  }
  return {
    name: (block && block.name) || "",
    kind: (block && block.kind) || "config",
    rollbackPolicy,
    mode,
    timeoutSecs,
    undoCommand,
    rollbackOnFailure: steps.some((s) => s.rollback_on_failure === true),
    triggerStepIndex,
    commandsText: steps.map((s) => s.command || "").join("\n"),
    rollbackCommandsText: steps
      .map((s) => (s.rollback_command != null ? String(s.rollback_command) : ""))
      .join("\n"),
    failFast: block && block.fail_fast !== false,
  };
}

async function importTxBlockIntoWorkflowBuilder() {
  const out = byId("tx-workflow-plan-out");
  out.textContent = t("running");
  try {
    const data = await request("POST", "/api/tx/block", txPayload(true));
    const block = data && data.tx_block ? data.tx_block : null;
    if (!block) {
      out.textContent = t("txWorkflowImportEmpty");
      return;
    }
    txWorkflowBlocks.push(createTxWorkflowBlock(txBlockToBuilderSeed(block)));
    renderTxWorkflowBuilder();
    out.textContent = t("txWorkflowImportDone");
  } catch (e) {
    out.textContent = e.message;
  }
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
    const txDeleteBtn = e.target.closest(".js-tx-workflow-delete-block");
    if (txDeleteBtn) {
      const blockId = txDeleteBtn.getAttribute("data-tx-block-id") || "";
      if (blockId) {
        txWorkflowBlocks = txWorkflowBlocks.filter((b) => b.id !== blockId);
        renderTxWorkflowBuilder();
      }
    }
    const txToggleBtn = e.target.closest(".js-tx-workflow-toggle-block");
    if (txToggleBtn) {
      const blockId = txToggleBtn.getAttribute("data-tx-block-id") || "";
      const item = txWorkflowBlocks.find((b) => b.id === blockId);
      if (item) {
        item.collapsed = !item.collapsed;
        renderTxWorkflowBuilder();
      }
    }
    const txCopyBtn = e.target.closest(".js-tx-workflow-copy-block");
    if (txCopyBtn) {
      const blockId = txCopyBtn.getAttribute("data-tx-block-id") || "";
      const idx = txWorkflowBlocks.findIndex((b) => b.id === blockId);
      if (idx >= 0) {
        const src = txWorkflowBlocks[idx];
        txWorkflowBlocks.splice(idx + 1, 0, createTxWorkflowBlock({ ...src }));
        renderTxWorkflowBuilder();
      }
    }
    const txMoveUpBtn = e.target.closest(".js-tx-workflow-move-up-block");
    if (txMoveUpBtn) {
      const blockId = txMoveUpBtn.getAttribute("data-tx-block-id") || "";
      const idx = txWorkflowBlocks.findIndex((b) => b.id === blockId);
      if (idx > 0) {
        const tmp = txWorkflowBlocks[idx - 1];
        txWorkflowBlocks[idx - 1] = txWorkflowBlocks[idx];
        txWorkflowBlocks[idx] = tmp;
        renderTxWorkflowBuilder();
      }
    }
    const txMoveDownBtn = e.target.closest(".js-tx-workflow-move-down-block");
    if (txMoveDownBtn) {
      const blockId = txMoveDownBtn.getAttribute("data-tx-block-id") || "";
      const idx = txWorkflowBlocks.findIndex((b) => b.id === blockId);
      if (idx >= 0 && idx < txWorkflowBlocks.length - 1) {
        const tmp = txWorkflowBlocks[idx + 1];
        txWorkflowBlocks[idx + 1] = txWorkflowBlocks[idx];
        txWorkflowBlocks[idx] = tmp;
        renderTxWorkflowBuilder();
      }
    }
    const txRollbackModeBtn = e.target.closest(".js-tx-workflow-rollback-mode");
    if (txRollbackModeBtn) {
      const blockId = txRollbackModeBtn.getAttribute("data-tx-block-id") || "";
      const mode = txRollbackModeBtn.getAttribute("data-mode") || "text";
      const item = txWorkflowBlocks.find((b) => b.id === blockId);
      if (item) {
        item.rollbackInputMode = mode === "pairs" ? "pairs" : "text";
        renderTxWorkflowBuilder();
      }
    }
    const txRollbackAutoBtn = e.target.closest(".js-tx-workflow-rollback-auto");
    if (txRollbackAutoBtn) {
      const blockId = txRollbackAutoBtn.getAttribute("data-tx-block-id") || "";
      const item = txWorkflowBlocks.find((b) => b.id === blockId);
      if (item) {
        const commands = txWorkflowLines(item.commandsText);
        const rollbacks = commands.map((cmd) =>
          buildRollbackCommand(item.rollbackRule, cmd, item.rollbackRuleTemplate)
        );
        item.rollbackCommandsText = rollbacks.join("\n");
        item.rollbackInputMode = "pairs";
        renderTxWorkflowBuilder();
      }
    }
    const txRollbackSaveBtn = e.target.closest(".js-tx-workflow-rollback-template-save");
    if (txRollbackSaveBtn) {
      const blockId = txRollbackSaveBtn.getAttribute("data-tx-block-id") || "";
      const item = txWorkflowBlocks.find((b) => b.id === blockId);
      if (!item) return;
      const nameEl = document.querySelector(
        `.js-tx-workflow-rollback-template-name[data-tx-block-id="${blockId}"]`
      );
      const name = nameEl ? nameEl.value.trim() : "";
      const template = String(item.rollbackRuleTemplate || "").trim();
      if (name && template) {
        upsertRollbackTemplate(name, template);
        item.rollbackLibraryName = name;
        renderTxWorkflowBuilder();
      }
    }
    const txRollbackDeleteBtn = e.target.closest(
      ".js-tx-workflow-rollback-template-delete"
    );
    if (txRollbackDeleteBtn) {
      const blockId = txRollbackDeleteBtn.getAttribute("data-tx-block-id") || "";
      const item = txWorkflowBlocks.find((b) => b.id === blockId);
      if (!item) return;
      const nameEl = document.querySelector(
        `.js-tx-workflow-rollback-template-name[data-tx-block-id="${blockId}"]`
      );
      const name = nameEl ? nameEl.value.trim() : "";
      if (name) {
        deleteRollbackTemplate(name);
        if (item.rollbackLibraryName === name) {
          item.rollbackLibraryName = "";
        }
        renderTxWorkflowBuilder();
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
    if (e.key === "Escape" && byId("record-drawer").classList.contains("open")) {
      closeRecordDrawer();
    }
    if (e.key === "Escape" && byId("history-drawer").classList.contains("open")) {
      closeHistoryDrawer();
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

  byId("interactive-start-btn").onclick = () => {
    startInteractive();
  };
  byId("interactive-stop-btn").onclick = () => {
    stopInteractive();
  };
  byId("interactive-send-btn").onclick = () => {
    sendInteractiveCommand();
  };
  byId("interactive-clear-btn").onclick = () => {
    byId("interactive-out").textContent = "";
    if (interactiveSessionId) {
      setInteractiveStatus(`${t("interactiveStatusReady")} · ${interactiveSessionId}`);
    } else {
      setInteractiveStatus(t("interactiveStatusIdle"));
    }
  };
  byId("interactive-command").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendInteractiveCommand();
    }
  });

  byId("record-fab").onclick = () => {
    openRecordDrawer();
  };
  byId("record-drawer-close").onclick = () => {
    closeRecordDrawer();
  };
  byId("record-drawer-backdrop").onclick = () => {
    closeRecordDrawer();
  };
  byId("history-drawer-close").onclick = () => {
    closeHistoryDrawer();
  };
  byId("history-drawer-backdrop").onclick = () => {
    closeHistoryDrawer();
  };

  ["host", "saved-conn-name", "device_profile"].forEach((id) => {
    const el = byId(id);
    if (!el) return;
    el.addEventListener("input", updateRecordFabVisibility);
    el.addEventListener("change", updateRecordFabVisibility);
  });

  for (const tab of ["ops", "interactive", "replay", "prompts", "templates", "backup"]) {
    byId(`tab-${tab}`).onclick = () => {
      currentTab = tab;
      applyTabs();
      if (tab === "replay") {
        renderReplayView();
      }
      if (tab === "prompts") {
        loadProfilesOverview();
        currentPromptMode = "view";
        applyPromptMode();
      }
      if (tab === "templates") {
        loadTemplates();
      }
      if (tab === "backup") {
        loadBackups();
      }
    };
  }

  byId("op-kind-exec").onclick = () => {
    currentOpKind = "exec";
    applyOperationKind();
  };
  byId("op-kind-tx").onclick = () => {
    currentOpKind = "tx";
    applyOperationKind();
  };
  byId("op-exec-direct").onclick = () => {
    currentExecMode = "direct";
    applyExecMode();
  };
  byId("op-exec-template").onclick = () => {
    currentExecMode = "template";
    applyExecMode();
  };
  byId("history-drawer-refresh-btn").onclick = loadConnectionHistory;
  byId("history-filter-query").oninput = () => {
    historyFilterQuery = byId("history-filter-query").value || "";
    saveHistoryFilterPrefs();
    renderHistoryDrawer();
  };
  byId("history-filter-operation").onchange = () => {
    historyFilterOperation = byId("history-filter-operation").value || "all";
    saveHistoryFilterPrefs();
    renderHistoryDrawer();
  };
  byId("history-filter-limit").onchange = () => {
    const raw = Number(byId("history-filter-limit").value || 30);
    historyFilterLimit = Number.isFinite(raw) ? raw : 30;
    saveHistoryFilterPrefs();
    loadConnectionHistory();
  };
  byId("history-filter-clear-btn").onclick = () => {
    historyFilterQuery = "";
    historyFilterOperation = "all";
    byId("history-filter-query").value = "";
    byId("history-filter-operation").value = "all";
    saveHistoryFilterPrefs();
    renderHistoryDrawer();
  };
  byId("tx-advanced-toggle-btn").onclick = () => {
    txAdvancedExpanded = !txAdvancedExpanded;
    applyTxLayoutState();
  };
  byId("tx-stage-block").onclick = () => {
    currentTxStage = "block";
    applyTxStage();
  };
  byId("tx-stage-workflow").onclick = () => {
    currentTxStage = "workflow";
    applyTxStage();
  };
  byId("tx-workflow-more-btn").onclick = () => {
    txWorkflowMoreExpanded = !txWorkflowMoreExpanded;
    applyTxWorkflowMoreActionsState();
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
  byId("saved-conn-history-btn").onclick = () => {
    openHistoryDrawer();
    loadConnectionHistory();
  };
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

  byId("tx-plan-btn").onclick = async () => {
    const out = byId("tx-plan-out");
    out.textContent = t("running");
    try {
      const data = await request("POST", "/api/tx/block", txPayload(true));
      out.textContent = JSON.stringify(data.tx_block || {}, null, 2);
    } catch (e) {
      out.textContent = e.message;
    }
  };

  byId("tx-exec-btn").onclick = async () => {
    const out = byId("tx-exec-out");
    out.textContent = t("running");
    try {
      const data = await request("POST", "/api/tx/block", txPayload(false));
      out.textContent = JSON.stringify(data.tx_result || {}, null, 2);
      applyRecordingFromResponse(data);
    } catch (e) {
      out.textContent = e.message;
    }
  };

  byId("tx-workflow-plan-btn").onclick = async () => {
    const out = byId("tx-workflow-plan-out");
    out.textContent = t("running");
    try {
      const data = await request("POST", "/api/tx/workflow", txWorkflowPayload(true));
      out.textContent = JSON.stringify(data.workflow || {}, null, 2);
    } catch (e) {
      out.textContent = e.message;
    }
  };

  byId("tx-workflow-exec-btn").onclick = async () => {
    const out = byId("tx-workflow-exec-out");
    const rawOut = byId("tx-workflow-exec-raw");
    out.textContent = t("running");
    try {
      const data = await request("POST", "/api/tx/workflow", txWorkflowPayload(false));
      const result = data.tx_workflow_result || {};
      out.innerHTML = renderTxWorkflowResult(result);
      rawOut.textContent = JSON.stringify(result, null, 2);
      const hasErrors =
        result &&
        ((Array.isArray(result.rollback_errors) && result.rollback_errors.length > 0) ||
          result.failed_block != null);
      rawOut.hidden = !hasErrors;
      rawOut.style.display = rawOut.hidden ? "none" : "";
      applyRecordingFromResponse(data);
    } catch (e) {
      out.textContent = e.message;
      rawOut.textContent = e.message;
      rawOut.hidden = false;
      rawOut.style.display = "";
    }
  };
  byId("tx-workflow-exec-raw-toggle").onclick = () => {
    const rawOut = byId("tx-workflow-exec-raw");
    rawOut.hidden = !rawOut.hidden;
    rawOut.style.display = rawOut.hidden ? "none" : "";
  };
  byId("tx-workflow-import-block-btn").onclick = importTxBlockIntoWorkflowBuilder;
  byId("tx-workflow-add-block-btn").onclick = () => {
    txWorkflowBlocks.push(createTxWorkflowBlock());
    renderTxWorkflowBuilder();
  };
  byId("tx-workflow-collapse-all-btn").onclick = () => {
    setAllTxWorkflowBlocksCollapsed(true);
  };
  byId("tx-workflow-expand-all-btn").onclick = () => {
    setAllTxWorkflowBlocksCollapsed(false);
  };
  byId("tx-workflow-filter-kind").onchange = () => {
    txWorkflowFilterKind = byId("tx-workflow-filter-kind").value || "all";
    renderTxWorkflowBuilder();
  };
  byId("tx-workflow-filter-rollback").onchange = () => {
    txWorkflowFilterRollback = byId("tx-workflow-filter-rollback").value || "all";
    renderTxWorkflowBuilder();
  };
  byId("tx-workflow-filter-query").oninput = () => {
    txWorkflowFilterQuery = byId("tx-workflow-filter-query").value || "";
    renderTxWorkflowBuilder();
  };
  byId("tx-workflow-filter-clear-btn").onclick = () => {
    txWorkflowFilterKind = "all";
    txWorkflowFilterRollback = "all";
    txWorkflowFilterQuery = "";
    byId("tx-workflow-filter-kind").value = "all";
    byId("tx-workflow-filter-rollback").value = "all";
    byId("tx-workflow-filter-query").value = "";
    renderTxWorkflowBuilder();
  };
  byId("tx-rollback-mode").onchange = () => {
    applyTxRollbackMode();
  };
  byId("tx-rollback-input-text").onclick = () => {
    txRollbackInputMode = "text";
    applyTxRollbackInputMode();
  };
  byId("tx-rollback-input-pairs").onclick = () => {
    txRollbackInputMode = "pairs";
    applyTxRollbackInputMode();
  };
  byId("tx-commands").addEventListener("change", () => {
    renderTxRollbackPairs();
  });
  byId("tx-rollback-commands").addEventListener("input", () => {
    if (txRollbackInputMode === "pairs") {
      renderTxRollbackPairs();
    }
  });
  byId("tx-rollback-pairs").addEventListener("input", (e) => {
    const pairEl = e.target.closest(".js-tx-rollback-pair");
    if (!pairEl) return;
    const idxRaw = pairEl.getAttribute("data-index");
    const idx = idxRaw ? Number(idxRaw) : NaN;
    if (!Number.isFinite(idx)) return;
    const lines = parseRollbackLinesRaw(byId("tx-rollback-commands").value || "");
    while (lines.length <= idx) lines.push("");
    lines[idx] = pairEl.value || "";
    byId("tx-rollback-commands").value = lines.join("\n");
  });
  byId("tx-rollback-auto-btn").onclick = () => {
    const rule = byId("tx-rollback-rule").value || "no_prefix";
    const tpl = byId("tx-rollback-template").value || "";
    const commands = parseTxCommands();
    const rollbacks = commands.map((cmd) => buildRollbackCommand(rule, cmd, tpl));
    byId("tx-rollback-commands").value = rollbacks.join("\n");
    txRollbackInputMode = "pairs";
    applyTxRollbackInputMode();
  };
  byId("tx-rollback-rule").onchange = () => {
    applyTxRollbackRuleVisibility();
  };
  byId("tx-rollback-template-pick").onchange = () => {
    const name = byId("tx-rollback-template-pick").value || "";
    const found = rollbackTemplateLibrary.find((t) => t.name === name);
    if (found) {
      byId("tx-rollback-rule").value = "custom";
      byId("tx-rollback-template").value = found.template;
      byId("tx-rollback-template-name").value = found.name;
      byId("tx-rollback-template").hidden = false;
      byId("tx-rollback-template").style.display = "";
    }
  };
  byId("tx-rollback-template-save").onclick = () => {
    const name = byId("tx-rollback-template-name").value || "";
    const template = byId("tx-rollback-template").value || "";
    upsertRollbackTemplate(name, template);
    byId("tx-rollback-template-pick").innerHTML = rollbackTemplateOptionsHtml(name);
  };
  byId("tx-rollback-template-delete").onclick = () => {
    const name = byId("tx-rollback-template-name").value || "";
    deleteRollbackTemplate(name);
    byId("tx-rollback-template-pick").innerHTML = rollbackTemplateOptionsHtml("");
  };
  byId("tx-workflow-generate-btn").onclick = () => {
    try {
      generateTxWorkflowJsonFromBuilder();
    } catch (e) {
      byId("tx-workflow-plan-out").textContent = e.message;
    }
  };
  byId("tx-workflow-load-btn").onclick = () => {
    try {
      loadTxWorkflowBuilderFromJson();
    } catch (e) {
      byId("tx-workflow-plan-out").textContent = e.message;
    }
  };
  byId("tx-workflow-download-btn").onclick = () => {
    try {
      downloadTxWorkflowJsonFromBuilder();
      byId("tx-workflow-plan-out").textContent = t("txWorkflowDownloadDone");
    } catch (e) {
      byId("tx-workflow-plan-out").textContent = e.message;
    }
  };
  byId("tx-workflow-import-file-btn").onclick = () => {
    byId("tx-workflow-import-file-input").click();
  };
  byId("tx-workflow-import-file-input").onchange = async () => {
    try {
      await importTxWorkflowBuilderFromFile();
    } catch (e) {
      byId("tx-workflow-plan-out").textContent = e.message;
    }
  };
  const txWorkflowBlocksWrap = byId("tx-workflow-blocks");
  txWorkflowBlocksWrap.addEventListener("input", (e) => {
    const pairEl = e.target.closest(".js-tx-workflow-rollback-pair");
    if (pairEl) {
      const id = pairEl.getAttribute("data-tx-block-id");
      const idxRaw = pairEl.getAttribute("data-index");
      const idx = idxRaw ? Number(idxRaw) : NaN;
      if (!id || !Number.isFinite(idx)) return;
      const item = txWorkflowBlocks.find((b) => b.id === id);
      if (!item) return;
      const lines = parseRollbackLinesRaw(item.rollbackCommandsText);
      while (lines.length <= idx) lines.push("");
      lines[idx] = pairEl.value || "";
      item.rollbackCommandsText = lines.join("\n");
      return;
    }

    const ruleEl = e.target.closest(".js-tx-workflow-rollback-rule");
    if (ruleEl) {
      const id = ruleEl.getAttribute("data-tx-block-id");
      const item = txWorkflowBlocks.find((b) => b.id === id);
      if (item) {
        item.rollbackRule = ruleEl.value || "no_prefix";
        renderTxWorkflowBuilder();
      }
      return;
    }

    const tplEl = e.target.closest(".js-tx-workflow-rollback-template");
    if (tplEl) {
      const id = tplEl.getAttribute("data-tx-block-id");
      const item = txWorkflowBlocks.find((b) => b.id === id);
      if (item) {
        item.rollbackRuleTemplate = tplEl.value || "";
      }
      return;
    }

    const el = e.target;
    const id = el.getAttribute("data-tx-block-id");
    const field = el.getAttribute("data-field");
    if (!id || !field) return;
    const item = txWorkflowBlocks.find((b) => b.id === id);
    if (!item) return;
    item[field] = el.type === "checkbox" ? el.checked : el.value;
  });
  txWorkflowBlocksWrap.addEventListener("change", (e) => {
    const fieldEl = e.target.closest(".js-tx-workflow-field");
    if (fieldEl) {
      const id = fieldEl.getAttribute("data-tx-block-id");
      const field = fieldEl.getAttribute("data-field");
      const item = txWorkflowBlocks.find((b) => b.id === id);
      if (item && (field === "commandsText" || field === "rollbackPolicy")) {
        if (field === "rollbackPolicy") {
          item.rollbackPolicy = fieldEl.value;
          renderTxWorkflowBuilder();
          return;
        }
        if (field === "commandsText" && item.rollbackInputMode === "pairs") {
          renderTxWorkflowBuilder();
          return;
        }
      }
    }
    const pickEl = e.target.closest(".js-tx-workflow-rollback-template-pick");
    if (!pickEl) return;
    const id = pickEl.getAttribute("data-tx-block-id");
    const item = txWorkflowBlocks.find((b) => b.id === id);
    if (!item) return;
    const name = pickEl.value || "";
    item.rollbackLibraryName = name;
    const found = rollbackTemplateLibrary.find((t) => t.name === name);
    if (found) {
      item.rollbackRule = "custom";
      item.rollbackRuleTemplate = found.template;
    }
    renderTxWorkflowBuilder();
  });
  txWorkflowBlocksWrap.addEventListener("dragstart", (e) => {
    const handle = e.target.closest(".js-tx-workflow-drag-block");
    if (!handle) return;
    txWorkflowDragBlockId = handle.getAttribute("data-tx-block-id") || "";
    if (!txWorkflowDragBlockId) return;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", txWorkflowDragBlockId);
  });
  txWorkflowBlocksWrap.addEventListener("dragover", (e) => {
    const card = e.target.closest("[data-tx-block-id]");
    if (!card) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    autoScrollDuringDrag(e, txWorkflowBlocksWrap);
    clearTxWorkflowDropMarkers(txWorkflowBlocksWrap);
    const rect = card.getBoundingClientRect();
    const after = e.clientY > rect.top + rect.height / 2;
    card.classList.add("tx-workflow-drop-target");
    card.classList.add(after ? "tx-workflow-drop-after" : "tx-workflow-drop-before");
  });
  txWorkflowBlocksWrap.addEventListener("dragleave", (e) => {
    if (e.target === txWorkflowBlocksWrap) {
      clearTxWorkflowDropMarkers(txWorkflowBlocksWrap);
    }
  });
  txWorkflowBlocksWrap.addEventListener("drop", (e) => {
    const card = e.target.closest("[data-tx-block-id]");
    if (!card) return;
    e.preventDefault();
    const rect = card.getBoundingClientRect();
    const insertAfter = e.clientY > rect.top + rect.height / 2;
    const targetId = card.getAttribute("data-tx-block-id") || "";
    const sourceId =
      txWorkflowDragBlockId ||
      (e.dataTransfer ? e.dataTransfer.getData("text/plain") : "");
    if (!sourceId || !targetId || sourceId === targetId) {
      clearTxWorkflowDropMarkers(txWorkflowBlocksWrap);
      return;
    }
    const from = txWorkflowBlocks.findIndex((b) => b.id === sourceId);
    const to = txWorkflowBlocks.findIndex((b) => b.id === targetId);
    if (from < 0 || to < 0) {
      clearTxWorkflowDropMarkers(txWorkflowBlocksWrap);
      return;
    }
    const [moved] = txWorkflowBlocks.splice(from, 1);
    let insertAt = to + (insertAfter ? 1 : 0);
    if (from < insertAt) {
      insertAt -= 1;
    }
    txWorkflowBlocks.splice(insertAt, 0, moved);
    txWorkflowDragBlockId = "";
    clearTxWorkflowDropMarkers(txWorkflowBlocksWrap);
    renderTxWorkflowBuilder();
  });
  txWorkflowBlocksWrap.addEventListener("dragend", () => {
    txWorkflowDragBlockId = "";
    clearTxWorkflowDropMarkers(txWorkflowBlocksWrap);
  });

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

  byId("backup-create-btn").onclick = createBackupFromWeb;
  byId("backup-refresh-btn").onclick = loadBackups;
  byId("backup-download-btn").onclick = downloadBackupFromWeb;
  byId("backup-restore-merge-btn").onclick = () => restoreBackupFromWeb(false);
  byId("backup-restore-replace-btn").onclick = () => restoreBackupFromWeb(true);
  byId("backup-restore-archive").oninput = (e) => {
    renderBackupOptions(e.target.value || "");
    updateSelectedBackupMeta();
    renderBackupList();
  };
  byId("backup-restore-archive").onchange = () => {
    updateSelectedBackupMeta();
    renderBackupList();
  };
  byId("backup-list").addEventListener("click", (e) => {
    const downloadBtn = e.target.closest(".js-backup-download");
    if (downloadBtn) {
      const path = downloadBtn.getAttribute("data-backup-path") || "";
      selectBackupPath(path);
      downloadBackupFromWeb();
      return;
    }
    const restoreMergeBtn = e.target.closest(".js-backup-restore-merge");
    if (restoreMergeBtn) {
      const path = restoreMergeBtn.getAttribute("data-backup-path") || "";
      selectBackupPath(path);
      restoreBackupFromWeb(false);
      return;
    }
    const restoreReplaceBtn = e.target.closest(".js-backup-restore-replace");
    if (restoreReplaceBtn) {
      const path = restoreReplaceBtn.getAttribute("data-backup-path") || "";
      selectBackupPath(path);
      restoreBackupFromWeb(true);
      return;
    }
    const row = e.target.closest(".js-backup-row");
    if (!row) return;
    const path = row.getAttribute("data-backup-path") || "";
    if (!path) return;
    selectBackupPath(path);
  });
}

normalizeFilterPrefs();
normalizeHistoryFilters();
saveFilterPrefs();
saveHistoryFilterPrefs();
bindEvents();
initTopLevelAutocomplete();
initCollapsibleGroups();
loadRollbackTemplateLibrary();
txWorkflowBlocks = [createTxWorkflowBlock()];
byId("tx-workflow-name").value = "tx-workflow";
byId("tx-workflow-fail-fast").checked = true;
applyI18n();
applyTabs();
applyOperationKind();
applyPromptMode();
resetDiagnoseView();
updateInteractiveButtons();
updateRecordFabVisibility();
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
loadBackups();
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
