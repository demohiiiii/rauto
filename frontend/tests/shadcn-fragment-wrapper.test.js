import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function read(path) {
  return readFileSync(path, "utf8");
}

test("LoadingButton composes shadcn Button and exposes busy state", () => {
  const source = read("frontend/src/components/fragments/LoadingButton.svelte");
  assert.match(source, /from "\$lib\/components\/ui\/button/);
  assert.match(source, /<Button/);
  assert.match(source, /aria-busy=/);
  assert.doesNotMatch(source, /btn-disabled/);
  assert.doesNotMatch(source, /loading-spinner/);
});

test("execution results expose status in navigation and the output frame", () => {
  const panelSource = read(
    "frontend/src/components/fragments/ExecutionResultsPanel.svelte",
  );
  const outputSource = read(
    "frontend/src/components/fragments/OutputBlock.svelte",
  );

  assert.match(panelSource, /circle-check/);
  assert.match(panelSource, /circle-x/);
  assert.doesNotMatch(panelSource, /role="status"/);
  assert.match(outputSource, /circle-x/);
  assert.match(outputSource, /tone === "error"/);
  assert.match(outputSource, /border-destructive/);
  assert.match(outputSource, /text-destructive/);
});

test("plain text field wrappers compose shadcn form controls", () => {
  const controls = [
    ["frontend/src/components/fragments/PlainInputField.svelte", "ui/input"],
    [
      "frontend/src/components/fragments/PlainTextAreaField.svelte",
      "ui/textarea",
    ],
  ];

  for (const [path, importPath] of controls) {
    const source = read(path);
    assert.match(source, new RegExp(importPath));
  }

  const textAreaField = read(
    "frontend/src/components/fragments/TextAreaField.svelte",
  );
  assert.match(textAreaField, /onValueInput/);
  assert.match(textAreaField, /\{onValueInput\}/);
});

test("select and checkbox wrappers compose shadcn controls", () => {
  const controls = [
    {
      path: "frontend/src/components/fragments/PlainSelectField.svelte",
      daisyClasses: [/"select"/],
      semanticClasses: [/ui\/select/, /<Select\.Root/, /<Select\.Trigger/],
      forbiddenMarkup: [/<select\b/],
    },
    {
      path: "frontend/src/components/fragments/PlainCheckboxField.svelte",
      daisyClasses: [/"check-label"/, /"check-input"/],
      semanticClasses: [/ui\/checkbox/, /ui\/switch/, /inline-flex/],
      forbiddenMarkup: [],
    },
  ];

  for (const {
    path,
    daisyClasses,
    semanticClasses,
    forbiddenMarkup,
  } of controls) {
    const source = read(path);
    for (const daisyClass of daisyClasses) {
      assert.doesNotMatch(source, daisyClass);
    }
    for (const forbiddenPattern of forbiddenMarkup) {
      assert.doesNotMatch(source, forbiddenPattern);
    }
    for (const semanticClass of semanticClasses) {
      assert.match(source, semanticClass);
    }
  }
});

test("plain select trigger fits responsive form grids", () => {
  const source = read(
    "frontend/src/components/fragments/PlainSelectField.svelte",
  );

  assert.match(source, /defaultRootClass = "w-full min-w-0"/);
  assert.match(source, /!w-full max-w-full min-w-0 justify-between/);
  assert.match(source, /class=\{rootClassName\}/);
  assert.match(
    source,
    /<span class="min-w-0 flex-1 truncate text-left">\{selectedLabel\}<\/span>/,
  );
});

test("shared select menus stay inside the viewport and scroll long lists", () => {
  const source = read(
    "frontend/src/lib/components/ui/select/select-content.svelte",
  );

  assert.match(
    source,
    /max-h-\[min\(20rem,var\(--bits-select-content-available-height\)\)\]/,
  );
  assert.match(source, /relative isolate z-50 overflow-hidden/);
  assert.match(source, /h-\(--bits-select-anchor-height\) min-h-0/);
});

test("action wrappers compose shadcn buttons without Daisy defaults", () => {
  const controls = [
    "frontend/src/components/fragments/FilePickerButton.svelte",
    "frontend/src/components/fragments/MiniActionButton.svelte",
  ];

  for (const path of controls) {
    const source = read(path);
    assert.match(source, /from "\$lib\/components\/ui\/button/);
    assert.match(source, /<Button/);
    assert.doesNotMatch(source, /"btn btn-sm"/);
    assert.doesNotMatch(source, /mini-btn/);
  }
});

test("collapsible group supports card and plain section variants", () => {
  const source = read(
    "frontend/src/components/fragments/CollapsibleGroup.svelte",
  );
  const uiSource = read("frontend/src/lib/ui.ts");

  assert.match(source, /ui\/card/);
  assert.match(source, /<Card\.Root/);
  assert.match(source, /<Card\.Header/);
  assert.match(source, /<Card\.Content/);
  assert.match(source, /variant = "card"/);
  assert.match(source, /variant === "section"/);
  assert.match(source, /<section/);
  assert.match(source, /border-b/);
  assert.doesNotMatch(uiSource, /group-card/);
  assert.doesNotMatch(uiSource, /group-body/);
  assert.doesNotMatch(uiSource, /field-tools/);
  assert.doesNotMatch(read("frontend/src/app.css"), /group-card|group-body/);
});

test("connection picker dropdown renders above following form controls", () => {
  const source = read(
    "frontend/src/domains/connections/presentation/components/fields/ConnectionPickerField.svelte",
  );
  const jobEditor = read(
    "frontend/src/domains/orchestration/presentation/components/editor/OrchestrationJobEditor.svelte",
  );
  const targetsEditor = read(
    "frontend/src/domains/orchestration/presentation/components/editor/OrchestrationJobTargetsEditor.svelte",
  );

  assert.match(source, /absolute left-0 top-full z-\[80\]/);
  assert.match(source, /hover:bg-accent/);
  assert.match(source, /class:connection-show-object-menu/);
  assert.match(jobEditor, /relative z-20 overflow-visible/);
  assert.match(jobEditor, /relative z-10 overflow-hidden/);
  assert.match(targetsEditor, /@container/);
  assert.match(targetsEditor, /@2xl:grid-cols-3/);
});

test("editor panels use component-local toolbar layout instead of field-tools", () => {
  const panelPaths = [
    "frontend/src/components/fragments/ObjectFieldsEditor.svelte",
    "frontend/src/domains/orchestration/presentation/components/editor/OrchestrationJobEditor.svelte",
    "frontend/src/domains/orchestration/presentation/components/editor/OrchestrationJobTargetsEditor.svelte",
    "frontend/src/domains/orchestration/presentation/components/editor/OrchestrationStageEditor.svelte",
    "frontend/src/domains/orchestration/presentation/components/editor/OrchestrationStagesPanel.svelte",
    "frontend/src/domains/transactions/presentation/components/block/TxBlockCommandDynParamsEditor.svelte",
    "frontend/src/domains/transactions/presentation/components/block/TxBlockCommandInteractionEditor.svelte",
    "frontend/src/domains/transactions/presentation/components/block/TxBlockFlowEditor.svelte",
    "frontend/src/domains/command/presentation/components/CommandFlowTemplateEditor.svelte",
    "frontend/src/domains/command/presentation/components/CommandFlowStepsEditor.svelte",
    "frontend/src/domains/transactions/presentation/components/block/TxBlockVisualEditor.svelte",
    "frontend/src/domains/transactions/presentation/components/workflow/TxWorkflowVisualEditor.svelte",
  ];

  for (const path of panelPaths) {
    const source = read(path);

    assert.doesNotMatch(source, /field-tools/);
  }

  assert.doesNotMatch(read("frontend/src/app.css"), /field-tools/);
});

test("form sections use semantic local layout instead of Daisy field classes", () => {
  const panelPaths = [
    "frontend/src/components/fragments/PresenceFieldGrid.svelte",
    "frontend/src/components/fragments/PresenceToggle.svelte",
    "frontend/src/components/fragments/StringListEditor.svelte",
    "frontend/src/components/fragments/TextAreaField.svelte",
    "frontend/src/domains/inventory/presentation/components/InventoryCollectionPanel.svelte",
    "frontend/src/domains/orchestration/presentation/components/editor/OrchestrationJobActionEditor.svelte",
    "frontend/src/domains/orchestration/presentation/components/editor/OrchestrationJobTargetsEditor.svelte",
    "frontend/src/domains/orchestration/presentation/components/editor/OrchestrationTxWorkflowSourceEditor.svelte",
    "frontend/src/domains/transactions/presentation/components/block/TxBlockCommandDynParamsEditor.svelte",
    "frontend/src/domains/transactions/presentation/components/block/TxBlockRollbackPolicyEditor.svelte",
    "frontend/src/domains/transactions/presentation/components/workflow/TxWorkflowTemplateRefSourceEditor.svelte",
  ];

  for (const path of panelPaths) {
    const source = read(path);

    assert.doesNotMatch(source, /form-control/);
    assert.doesNotMatch(source, /label-text/);
  }

  assert.doesNotMatch(read("frontend/src/app.css"), /form-control|label-text/);
});

test("prompt editors use local field surfaces instead of field-card globals", () => {
  const panelPaths = [
    "frontend/src/domains/profiles/presentation/components/BuiltinProfileDetectSection.svelte",
    "frontend/src/domains/profiles/presentation/components/BuiltinProfileHooksSection.svelte",
    "frontend/src/domains/profiles/presentation/components/BuiltinProfileSimpleSections.svelte",
    "frontend/src/domains/profiles/presentation/components/BuiltinProfileStateListsSection.svelte",
    "frontend/src/domains/profiles/presentation/components/CustomProfileDetectPanel.svelte",
    "frontend/src/domains/profiles/presentation/components/ProfileDetectProbeCard.svelte",
    "frontend/src/domains/profiles/presentation/components/ProfileHookRowEditor.svelte",
    "frontend/src/domains/profiles/presentation/components/ProfileListRowEditor.svelte",
  ];

  for (const path of panelPaths) {
    const source = read(path);

    assert.doesNotMatch(source, /field-card/);
  }

  assert.doesNotMatch(read("frontend/src/app.css"), /field-card/);
});

test("connection editor panels compose shadcn Card instead of group-card shells", () => {
  const panelPaths = [
    "frontend/src/domains/connections/presentation/components/SavedConnectionEditorForm.svelte",
    "frontend/src/domains/connections/presentation/components/TemporaryConnectionPanel.svelte",
  ];

  for (const path of panelPaths) {
    const source = read(path);

    assert.match(source, /ui\/card/);
    assert.match(source, /<Card\.Root/);
    assert.match(source, /<Card\.Header/);
    assert.match(source, /<Card\.Title/);
    assert.match(source, /<Card\.Content/);
    assert.doesNotMatch(source, /group-card/);
  }
});

test("connection form layout uses component-local shadcn token classes", () => {
  const legacyConnectionLayoutClasses =
    /dashboard-connection-form-grid|connection-form-stack|connection-name-row|connection-extra-grid|connection-tags-grid|connection-field|connection-field-label/;
  const componentPaths = [
    "frontend/src/domains/connections/presentation/components/fields/ConnectionBasicFields.svelte",
    "frontend/src/domains/connections/presentation/components/fields/ConnectionMetadataFields.svelte",
    "frontend/src/domains/connections/presentation/components/fields/ConnectionPickerField.svelte",
    "frontend/src/domains/connections/presentation/components/fields/ConnectionVarsField.svelte",
    "frontend/src/domains/connections/presentation/components/SavedConnectionEditorForm.svelte",
    "frontend/src/domains/connections/presentation/components/TemporaryConnectionPanel.svelte",
    "frontend/src/domains/show/presentation/components/BatchShowInputPanel.svelte",
  ];

  assert.doesNotMatch(
    read("frontend/src/app.css"),
    legacyConnectionLayoutClasses,
  );

  for (const path of componentPaths) {
    assert.doesNotMatch(read(path), legacyConnectionLayoutClasses);
  }
});

test("connection picker dropdown styles stay local to the picker component", () => {
  const appCss = read("frontend/src/app.css");
  const pickerSource = read(
    "frontend/src/domains/connections/presentation/components/fields/ConnectionPickerField.svelte",
  );

  assert.doesNotMatch(appCss, /connection-show-object-/);
  assert.match(pickerSource, /connection-show-object-menu/);
});

test("connection input shells use local semantic token classes", () => {
  const appCss = read("frontend/src/app.css");
  const pickerSource = read(
    "frontend/src/domains/connections/presentation/components/fields/ConnectionPickerField.svelte",
  );
  const temporaryPanelSource = read(
    "frontend/src/domains/connections/presentation/components/TemporaryConnectionPanel.svelte",
  );

  assert.doesNotMatch(appCss, /connection-tags-input|connection-options-row/);
  assert.doesNotMatch(pickerSource, /connection-tags-input/);
  assert.doesNotMatch(temporaryPanelSource, /connection-options-row/);
  assert.match(pickerSource, /border-border/);
  assert.match(temporaryPanelSource, /bg-muted/);
});

test("detail modal composes shadcn Dialog instead of native dialog", () => {
  const modalSource = read(
    "frontend/src/domains/overlays/presentation/components/DetailModal.svelte",
  );
  const workspaceSource = read(
    "frontend/src/domains/overlays/application/detailState.ts",
  );

  assert.match(modalSource, /ui\/dialog/);
  assert.match(modalSource, /<Dialog\.Root/);
  assert.match(modalSource, /<Dialog\.Content/);
  assert.match(modalSource, /<Dialog\.Title/);
  assert.doesNotMatch(modalSource, /<dialog\b/);
  assert.doesNotMatch(workspaceSource, /showModal\(/);
});

test("connection modal shell composes shadcn Dialog instead of dashboard modal globals", () => {
  const source = read(
    "frontend/src/domains/connections/presentation/components/ConnectionModalShell.svelte",
  );
  const uiSource = read("frontend/src/lib/ui.ts");
  const appCss = read("frontend/src/app.css");

  assert.match(source, /ui\/dialog/);
  assert.match(source, /<Dialog\.Root/);
  assert.match(source, /<Dialog\.Content/);
  assert.match(source, /<Dialog\.Title/);
  assert.doesNotMatch(source, /modalShellDisplay/);
  assert.doesNotMatch(source, /dashboard-modal-/);
  assert.doesNotMatch(source, /connection-modal-tabs/);
  assert.doesNotMatch(source, /role="dialog"/);
  assert.doesNotMatch(uiSource, /modalShellDisplay/);
  assert.doesNotMatch(appCss, /dashboard-modal-|connection-modal-tabs/);
});

test("Sonner portals above dialog overlays without changing modal dismissal", () => {
  const modalSource = read(
    "frontend/src/domains/connections/presentation/components/ConnectionModalShell.svelte",
  );
  const dialogSource = read(
    "frontend/src/lib/components/ui/dialog/dialog-content.svelte",
  );
  const overlaySource = read(
    "frontend/src/lib/components/ui/dialog/dialog-overlay.svelte",
  );
  const sonnerSource = read(
    "frontend/src/lib/components/ui/sonner/sonner.svelte",
  );

  assert.match(sonnerSource, /import \{ Portal \} from "bits-ui"/);
  assert.match(sonnerSource, /<Portal>[\s\S]*<Sonner[\s\S]*<\/Portal>/);
  assert.match(
    sonnerSource,
    /<div class="pointer-events-none fixed inset-0 z-\[100\]">/,
  );
  assert.match(sonnerSource, /z-index: 100/);
  assert.match(sonnerSource, /pointer-events: auto/);
  assert.match(overlaySource, /isolate z-40/);
  assert.match(dialogSource, /z-50/);
  assert.doesNotMatch(modalSource, /interactOutsideBehavior="ignore"/);
  assert.doesNotMatch(modalSource, /overlayProps=/);
  assert.doesNotMatch(dialogSource, /overlayProps/);
  assert.match(
    modalSource,
    /function keepOpenForToastInteraction\(event(?:: Event)?\)(?:: void)?/,
  );
  assert.match(
    modalSource,
    /closest\("\[data-sonner-toaster\], \[data-sonner-toast\]"\)/,
  );
  assert.match(modalSource, /event\.preventDefault\(\)/);
  assert.match(
    modalSource,
    /<Dialog\.Content[\s\S]*onInteractOutside=\{keepOpenForToastInteraction\}/,
  );
});

test("connection workbench modal follows the demo wide two-pane design", () => {
  const shellSource = read(
    "frontend/src/domains/connections/presentation/components/ConnectionModalShell.svelte",
  );
  const modalSource = read(
    "frontend/src/domains/connections/presentation/components/ConnectionModal.svelte",
  );
  const savedPanelSource = read(
    "frontend/src/domains/connections/presentation/components/SavedConnectionLibraryPanel.svelte",
  );
  const temporaryPanelSource = read(
    "frontend/src/domains/connections/presentation/components/TemporaryConnectionPanel.svelte",
  );
  const editorModalSource = read(
    "frontend/src/domains/connections/presentation/components/SavedConnectionEditModal.svelte",
  );
  const editorFormSource = read(
    "frontend/src/domains/connections/presentation/components/SavedConnectionEditorForm.svelte",
  );
  const basicFieldsSource = read(
    "frontend/src/domains/connections/presentation/components/fields/ConnectionBasicFields.svelte",
  );
  const enSource = read("frontend/src/i18n/en.ts");
  const zhSource = read("frontend/src/i18n/zh.ts");

  assert.match(shellSource, /sm:max-w-6xl/);
  assert.match(shellSource, /max-h-\[92vh\]/);
  assert.match(shellSource, /rounded-3xl/);
  assert.match(shellSource, /bg-gradient-to-br/);
  assert.match(shellSource, /PlugIcon/);
  assert.match(shellSource, /PencilIcon/);
  assert.match(shellSource, /variant === "editor"/);
  assert.match(shellSource, /XIcon/);
  assert.match(shellSource, /modeControls/);
  assert.match(shellSource, /Dialog\.Description/);
  assert.doesNotMatch(
    shellSource,
    /variant="outline" size="sm" type="button" onclick=\{closeModal\}/,
  );

  assert.match(modalSource, /modeControls=\{connectionModeControls\}/);
  assert.doesNotMatch(modalSource, /PlugIcon/);
  assert.doesNotMatch(modalSource, /headerControls/);
  assert.match(modalSource, /setConnectionModalMode\(tabRow\.valueText\)/);
  assert.match(modalSource, /bg-primary text-primary-foreground shadow/);
  assert.doesNotMatch(modalSource, /TabList/);
  assert.match(modalSource, /bg-muted\/30 px-7 py-3/);
  assert.match(
    modalSource,
    /rounded-full border border-border bg-background p-1/,
  );
  assert.doesNotMatch(modalSource, /class="-mb-0\.5/);

  assert.match(savedPanelSource, /lg:grid-cols-\[17rem_minmax\(0,1fr\)\]/);
  assert.match(savedPanelSource, /border-b border-border p-3/);
  assert.match(savedPanelSource, /h-9 rounded-lg pl-9 text-sm/);
  assert.match(savedPanelSource, /w-full rounded-lg border p-2 text-left/);
  assert.match(savedPanelSource, /ui\/input/);
  assert.match(savedPanelSource, /SearchIcon/);
  assert.match(savedPanelSource, /searchQuery/);
  assert.match(savedPanelSource, /filteredConnectionRows/);
  assert.match(savedPanelSource, /libraryDisplay\.connectionRows/);
  assert.doesNotMatch(savedPanelSource, /PlainSelectField/);
  assert.match(savedPanelSource, /selectedConnectionRow/);
  assert.match(savedPanelSource, /connection-summary-card/);
  assert.match(savedPanelSource, /connection-stat-grid/);
  assert.match(
    savedPanelSource,
    /rounded-3xl border border-border bg-card p-5/,
  );
  assert.doesNotMatch(savedPanelSource, /使用该连接/);
  assert.match(savedPanelSource, /i18nLabels\.applySelected/);
  assert.match(enSource, /savedConnTemplateBtn: "Template"/);
  assert.match(enSource, /savedConnImportBtn: "Import"/);
  assert.match(enSource, /connApplySelected: "Apply connection"/);
  assert.match(zhSource, /savedConnTemplateBtn: "模板"/);
  assert.match(zhSource, /savedConnImportBtn: "导入"/);
  assert.match(zhSource, /connApplySelected: "应用连接"/);
  assert.equal(
    savedPanelSource.match(/onclick=\{useSavedConnectionAction\}/g).length,
    1,
  );
  assert.match(savedPanelSource, /i18nLabels\.applyHint/);

  assert.match(temporaryPanelSource, /i18nLabels\.sessionOnly/);
  assert.match(temporaryPanelSource, /ConnectionSectionTitle/);
  assert.match(temporaryPanelSource, /splitSections=\{true\}/);
  assert.match(temporaryPanelSource, /border-dashed border-primary\/30/);
  assert.match(temporaryPanelSource, /Card\.Footer/);
  assert.doesNotMatch(temporaryPanelSource, /<Card\.Action>/);

  assert.match(editorModalSource, /sm:max-w-3xl/);
  assert.match(editorModalSource, /variant="editor"/);
  assert.match(editorFormSource, /splitSections=\{true\}/);
  assert.match(editorFormSource, /i18nLabels\.sectionCustomVars/);
  assert.match(basicFieldsSource, /splitSections = false/);
  assert.match(basicFieldsSource, /i18nLabels\.sectionPlatform/);
  assert.match(basicFieldsSource, /class="size-4"/);
  assert.match(basicFieldsSource, /platformFieldLabel/);
  assert.match(basicFieldsSource, /min-h-10 items-end/);
  assert.match(basicFieldsSource, /sm:grid-cols-2 lg:grid-cols-4/);
  assert.match(basicFieldsSource, /class="min-w-0 justify-between truncate"/);
  assert.match(temporaryPanelSource, /class="size-4"/);
  assert.match(editorFormSource, /class="size-4"/);
});

test("dashboard drawer shell composes shadcn Sheet instead of custom dialog aside", () => {
  const source = read(
    "frontend/src/domains/overlays/presentation/components/DashboardDrawerShell.svelte",
  );

  assert.match(source, /ui\/sheet/);
  assert.match(source, /<Sheet\.Root/);
  assert.match(source, /<Sheet\.Content/);
  assert.match(source, /<Sheet\.Title/);
  assert.doesNotMatch(source, /<aside\b/);
  assert.doesNotMatch(source, /role="dialog"/);
});

test("entry drawer reuses shadcn-backed dashboard drawer shell", () => {
  const source = read(
    "frontend/src/domains/overlays/presentation/components/EntryDrawer.svelte",
  );

  assert.match(source, /DashboardDrawerShell/);
  assert.doesNotMatch(source, /<aside\b/);
  assert.doesNotMatch(source, /role="dialog"/);
});

test("session records share one shadcn drawer with recent and history tabs", () => {
  const source = read(
    "frontend/src/domains/overlays/presentation/components/RecordDrawer.svelte",
  );
  const dashboardBody = read(
    "frontend/src/domains/dashboard/presentation/components/DashboardBody.svelte",
  );
  const overlayHost = read(
    "frontend/src/domains/dashboard/presentation/components/DashboardOverlayHost.svelte",
  );
  const overlayDefinitions = read(
    "frontend/src/domains/dashboard/model/navigation.ts",
  );

  assert.match(source, /DashboardDrawerShell/);
  assert.match(source, /<Tabs\.Root/);
  assert.match(source, /<Tabs\.List/);
  assert.match(source, /<Tabs\.Trigger/);
  assert.match(source, /<Tabs\.Content/);
  assert.match(source, /HistoryDrawerContent/);
  assert.match(source, /SESSION_RECORDS_VIEW\.recent/);
  assert.match(source, /selectedView === SESSION_RECORDS_VIEW\.history/);
  assert.match(source, /refreshHistory\(\)/);
  assert.doesNotMatch(dashboardBody, /openHistoryDrawerAction|ClockIcon/);
  assert.doesNotMatch(overlayHost, /HistoryDrawerComponent/);
  assert.doesNotMatch(overlayDefinitions, /historyDrawer:/);
});

test("history drawer filters reuse the shadcn select wrapper", () => {
  const source = read(
    "frontend/src/domains/overlays/presentation/components/HistoryDrawerContent.svelte",
  );

  assert.match(source, /PlainSelectField/);
  assert.match(source, /\{onValueChange\}/);
  assert.doesNotMatch(source, /onchange=\{onChange\}/);
  assert.doesNotMatch(source, /<select\b/);
});

test("history drawer and detail modal follow the demo card-based design", () => {
  const drawerSource = read(
    "frontend/src/domains/overlays/presentation/components/HistoryDrawerContent.svelte",
  );
  const drawerShellSource = read(
    "frontend/src/domains/overlays/presentation/components/RecordDrawer.svelte",
  );
  const detailSource = read(
    "frontend/src/domains/overlays/presentation/components/DetailModalContent.svelte",
  );
  const modalSource = read(
    "frontend/src/domains/overlays/presentation/components/DetailModal.svelte",
  );
  const detailStateSource = read(
    "frontend/src/domains/overlays/application/detailState.ts",
  );

  assert.match(drawerShellSource, /data-\[side=right\]:sm:max-w-3xl/);
  assert.match(drawerShellSource, /data-\[side=right\]:xl:max-w-4xl/);
  assert.doesNotMatch(drawerShellSource, /sm:max-w-2xl/);
  assert.match(drawerSource, /variant="ghost"/);
  assert.match(drawerSource, /text-destructive/);
  assert.match(drawerSource, /border-t border-border pt-3/);
  assert.match(
    drawerSource,
    /sm:grid-cols-\[minmax\(0,1fr\)_10rem_8rem_auto\]/,
  );
  assert.match(modalSource, /ListChecksIcon/);
  assert.match(modalSource, /sm:max-w-5xl/);
  assert.doesNotMatch(modalSource, /max-w-3xl/);
  assert.match(modalSource, /rounded-3xl/);
  assert.match(modalSource, /Dialog\.Description/);
  assert.match(detailSource, /metaIconRows/);
  assert.match(detailSource, /md:grid-cols-2 xl:grid-cols-4/);
  assert.match(detailSource, /historyEventCard/);
  assert.match(detailSource, /Prompt/);
  assert.doesNotMatch(detailSource, /EventEntriesTable/);
  assert.match(detailStateSource, /promptBefore/);
  assert.match(detailStateSource, /promptAfter/);
  assert.match(detailStateSource, /success/);
});

test("dashboard overlay host lets shadcn overlays own drawer backdrops", () => {
  const source = read(
    "frontend/src/domains/dashboard/presentation/components/DashboardOverlayHost.svelte",
  );

  assert.doesNotMatch(source, /dashboard-drawer-backdrop/);
});

test("dashboard toast host expands stacked sonner notifications", () => {
  const source = read(
    "frontend/src/domains/dashboard/presentation/components/DashboardOverlayHost.svelte",
  );

  assert.match(source, /<Toaster[\s\S]*\bexpand\b/);
  assert.match(source, /visibleToasts=\{5\}/);
});

test("saved connection editor success updates inline status without duplicate toast", () => {
  const source = read(
    "frontend/src/domains/connections/application/connectionEditorState.ts",
  );
  const saveEditorBody = source.match(
    /export async function saveSavedConnectionEditor[\s\S]*?^}/m,
  )?.[0];

  assert.ok(saveEditorBody);
  assert.match(
    saveEditorBody,
    /setSavedConnectionEditorStatus\(savedMessage,\s*"success",\s*\{\s*toast:\s*false\s*\}\)/,
  );
  assert.doesNotMatch(
    saveEditorBody,
    /setSavedConnectionEditorStatus\(savedMessage,\s*"success"\)/,
  );
});

test("connection test result shows sonner toast feedback", () => {
  const source = read(
    "frontend/src/domains/connections/application/connectionTargetRuntimeState.ts",
  );
  const runConnectionTestBody = source.match(
    /export async function runConnectionTest[\s\S]*?^}/m,
  )?.[0];

  assert.ok(runConnectionTestBody);
  assert.match(runConnectionTestBody, /showToast\(message,\s*"success"\)/);
  assert.match(runConnectionTestBody, /showToast\(message,\s*"error"\)/);
});

test("saved connection profile detection reports its detected profile with toast", () => {
  const source = read(
    "frontend/src/domains/connections/application/connectionEditorState.ts",
  );
  const detectProfileBody = source.match(
    /export async function detectSavedConnectionProfile[\s\S]*?^}/m,
  )?.[0];

  assert.ok(detectProfileBody);
  assert.match(
    detectProfileBody,
    /const detectedProfile =[^;]*detectResult\?\.device_profile/,
  );
  assert.match(
    detectProfileBody,
    /const message =[\s\S]*savedConnAutodetectDetected[\s\S]*detectedProfile/,
  );
  assert.match(detectProfileBody, /showToast\(message,\s*"success"\)/);
  assert.match(detectProfileBody, /showToast\(message,\s*"error"\)/);
});

test("saved connection editor displays detected device facts left of its actions", () => {
  const editorStateSource = read(
    "frontend/src/domains/connections/application/connectionEditorState.ts",
  );
  const displaySource = read(
    "frontend/src/domains/connections/presentation/connectionTargetDisplayState.ts",
  );
  const formSource = read(
    "frontend/src/domains/connections/presentation/components/SavedConnectionEditorForm.svelte",
  );
  const factsSource = read(
    "frontend/src/domains/connections/presentation/components/fields/ConnectionDetectedFacts.svelte",
  );

  assert.match(
    editorStateSource,
    /savedConnectionAutodetectState\.set\(\{[\s\S]*detectedModel:[\s\S]*detectedProfile,[\s\S]*detectedVersion:[\s\S]*warning:/,
  );
  assert.match(
    displaySource,
    /detectedProfileLabel:\s*tr\("savedConnAutodetectDetected"\)/,
  );
  assert.match(
    displaySource,
    /const detectedProfile =[\s\S]*autodetectState\?\.detectedProfile/,
  );
  assert.match(
    displaySource,
    /detectedModel,\s*detectedProfile,\s*detectedVersion,/,
  );
  assert.match(factsSource, /from "\$lib\/components\/ui\/badge/);
  assert.match(
    formSource,
    /<ConnectionDetectedFacts[\s\S]*editorDisplay\.detectedModel[\s\S]*editorDisplay\.detectedProfile[\s\S]*editorDisplay\.detectedVersion[\s\S]*<LoadingButton[\s\S]*detectProfile/,
  );
  assert.doesNotMatch(formSource, /applyDetectedProfile/);
});

test("connection forms test their current drafts beside autodetect", () => {
  const editorSource = read(
    "frontend/src/domains/connections/presentation/components/SavedConnectionEditorForm.svelte",
  );
  const temporarySource = read(
    "frontend/src/domains/connections/presentation/components/TemporaryConnectionPanel.svelte",
  );
  const editorStateSource = read(
    "frontend/src/domains/connections/application/connectionEditorState.ts",
  );
  const panelStateSource = read(
    "frontend/src/domains/connections/application/connectionPanelFormState.ts",
  );
  const runtimeSource = read(
    "frontend/src/domains/connections/application/connectionTargetRuntimeState.ts",
  );

  assert.match(
    editorSource,
    /onclick=\{testConnection\}[\s\S]*onclick=\{detectProfile\}/,
  );
  assert.match(temporarySource, /onclick=\{testConnection\}/);
  assert.match(temporarySource, /onclick=\{detectProfile\}/);
  assert.match(editorStateSource, /savedConnectionEditorTestPayload/);
  assert.match(editorStateSource, /testSavedConnectionDraft/);
  assert.match(
    panelStateSource,
    /testSavedConnectionDraft\(\{ \.\.\.editorDraft \}\)/,
  );
  assert.match(runtimeSource, /function connectionTestPayload\(mode/);
  assert.match(
    runtimeSource,
    /const payload = temporaryConnectionDraftPayload\(\);[\s\S]*payload\.connection_name = null[\s\S]*credentialRequired/,
  );
});

test("saved connection editor saves renamed connections through original route name", () => {
  const source = read(
    "frontend/src/domains/connections/application/connectionEditorState.ts",
  );
  const saveEditorBody = source.match(
    /export async function saveSavedConnectionEditor[\s\S]*?^}/m,
  )?.[0];

  assert.ok(saveEditorBody);
  assert.match(source, /let savedConnectionEditorOriginalName = "";/);
  assert.match(
    saveEditorBody,
    /const originalName = savedConnectionEditorOriginalName \|\| name;/,
  );
  assert.match(
    saveEditorBody,
    /connectionApi\.saveConnection\(\s*originalName,\s*payload/,
  );
});

test("saved connection editor preserves active target before rename refresh", () => {
  const source = read(
    "frontend/src/domains/connections/application/connectionEditorState.ts",
  );
  const saveEditorBody = source.match(
    /export async function saveSavedConnectionEditor[\s\S]*?^}/m,
  )?.[0];

  assert.ok(saveEditorBody);
  assert.match(
    saveEditorBody,
    /const targetBeforeSave = requiredHook\("getActiveConnectionTarget"\)\(\);/,
  );
  assert.match(
    saveEditorBody,
    /await requiredHook\("loadSavedConnections"\)\(\);/,
  );
  assert.match(saveEditorBody, /targetBeforeSave\.kind === "saved"/);
  assert.doesNotMatch(
    saveEditorBody,
    /const target = requiredHook\("getActiveConnectionTarget"\)\(\);/,
  );
});

test("batch show result errors do not render placeholder dashes", () => {
  const source = read(
    "frontend/src/domains/show/application/createShowWorkspaces.ts",
  );
  const batchShowResultRowsBody = source.match(
    /function batchShowResultRows[\s\S]*?^}/m,
  )?.[0];

  assert.ok(batchShowResultRowsBody);
  assert.match(
    batchShowResultRowsBody,
    /const errorText = emptyString\(batchShowResult\?\.error\)\.trim\(\);/,
  );
  assert.doesNotMatch(
    batchShowResultRowsBody,
    /const errorText = safeString\(batchShowResult\?\.error\)/,
  );
});

test("saved connection editor name field is editable and wired to the draft", () => {
  const formSource = read(
    "frontend/src/domains/connections/presentation/components/SavedConnectionEditorForm.svelte",
  );
  const workspaceSource = read(
    "frontend/src/domains/connections/application/connectionPanelFormState.ts",
  );
  const fieldStateSource = read(
    "frontend/src/domains/connections/application/connectionFieldState.ts",
  );

  assert.doesNotMatch(formSource, /ReadonlyInputField/);
  assert.match(formSource, /PlainInputField/);
  assert.match(formSource, /onValueInput=\{onSavedEditorNameInput\}/);
  assert.match(workspaceSource, /function onSavedEditorNameInput/);
  assert.match(workspaceSource, /onSavedEditorNameInput,/);
  assert.match(
    fieldStateSource,
    /onNameInput: \(fieldValue: unknown\) =>\s*update\(\{ name: text\(fieldValue\) \}\)/,
  );
});

test("saved connection deletion requires an accessible confirmation dialog", () => {
  const source = read(
    "frontend/src/domains/connections/presentation/components/SavedConnectionLibraryPanel.svelte",
  );

  assert.match(
    source,
    /import \* as Dialog from "\$lib\/components\/ui\/dialog/,
  );
  assert.match(source, /onclick=\{openDeleteConfirmation\}/);
  assert.match(source, /<Dialog\.Root bind:open=\{deleteDialogOpen\}>/);
  assert.match(source, /<Dialog\.Title>/);
  assert.match(source, /<Dialog\.Description>/);
  assert.match(source, /deleteConfirmationName/);
  assert.match(source, /onclick=\{confirmDeleteSavedConnection\}/);
});

test("record drawer sections use local shadcn-token surfaces", () => {
  const source = read(
    "frontend/src/domains/overlays/presentation/components/RecordDrawerContent.svelte",
  );
  const cssSource = read("frontend/src/app.css");

  assert.doesNotMatch(source, /dashboard-drawer-section/);
  assert.doesNotMatch(cssSource, /dashboard-drawer-section/);
});

test("dashboard drawer layout uses component-local classes", () => {
  const drawerGlobals =
    /dashboard-drawer-(head|body|toolbar|toolbar-left|filter-row|filters)/;
  const shellSource = read(
    "frontend/src/domains/overlays/presentation/components/DashboardDrawerShell.svelte",
  );
  const recordSource = read(
    "frontend/src/domains/overlays/presentation/components/RecordDrawerContent.svelte",
  );

  assert.doesNotMatch(read("frontend/src/app.css"), drawerGlobals);
  assert.doesNotMatch(shellSource, drawerGlobals);
  assert.doesNotMatch(recordSource, drawerGlobals);
  assert.match(shellSource, /border-b border-border/);
  assert.match(recordSource, /overscroll-contain/);
});

test("json text editor owns tx json editor shell styles", () => {
  const appCss = read("frontend/src/app.css");
  const editorSource = read(
    "frontend/src/components/fragments/JsonTextEditor.svelte",
  );

  assert.doesNotMatch(appCss, /tx-json-editor/);
  assert.match(editorSource, /tx-json-editor/);
  assert.match(editorSource, /:global\(\.cm-editor\)/);
});

test("workflow chips use semantic token classes without global chip css", () => {
  const appCss = read("frontend/src/app.css");
  const displaySources = [
    "frontend/src/domains/standard/presentation/standardFlowPresentation.ts",
    "frontend/src/domains/transactions/presentation/transactionExecutionDisplays.ts",
    "frontend/src/domains/orchestration/presentation/orchestrationResultDetailState.ts",
    "frontend/src/domains/orchestration/presentation/orchestrationResultPreviewState.ts",
  ];

  assert.doesNotMatch(appCss, /tx-workflow-chip/);
  for (const path of displaySources) {
    assert.doesNotMatch(read(path), /tx-workflow-chip/);
  }
});

test("output surfaces use OutputBlock instead of global output css", () => {
  const appCss = read("frontend/src/app.css");
  const outputBlockSource = read(
    "frontend/src/components/fragments/OutputBlock.svelte",
  );
  const outputSurfacePaths = [
    "frontend/src/components/fragments/ParsedOutputBlock.svelte",
    "frontend/src/domains/overlays/presentation/components/DetailModalContent.svelte",
    "frontend/src/domains/orchestration/presentation/components/result/OrchestrationExecutionPanel.svelte",
    "frontend/src/domains/transactions/presentation/components/block/TxBlockResultPanel.svelte",
    "frontend/src/domains/transactions/presentation/components/shared/TxOperationStepCard.svelte",
    "frontend/src/domains/transactions/presentation/components/workflow/TxWorkflowBlockResultPanel.svelte",
    "frontend/src/domains/transactions/presentation/components/workflow/TxWorkflowRunPanel.svelte",
    "frontend/src/domains/replay/presentation/components/ReplayResultsPanel.svelte",
    "frontend/src/domains/show/presentation/components/BatchShowResultsPanel.svelte",
    "frontend/src/domains/show/presentation/components/SingleShowPanel.svelte",
    "frontend/src/domains/standard/presentation/components/CommandExecutionPanel.svelte",
    "frontend/src/domains/standard/presentation/components/FlowExecutionPanel.svelte",
    "frontend/src/domains/tasks/presentation/components/TaskDetailOverviewPanel.svelte",
    "frontend/src/domains/tasks/presentation/components/TaskDetailPanel.svelte",
  ];

  assert.doesNotMatch(appCss, /\.output\b/);
  assert.match(outputBlockSource, /ui\/card/);
  assert.match(outputBlockSource, /ui\/scroll-area/);
  assert.match(outputBlockSource, /<Card\.Root/);
  assert.match(outputBlockSource, /<Card\.Header/);
  assert.match(outputBlockSource, /<Card\.Content/);
  assert.match(outputBlockSource, /<ScrollArea\.Root/);
  assert.match(outputBlockSource, /terminal-output/);
  assert.match(outputBlockSource, /terminal-output flex h-9/);
  assert.match(outputBlockSource, /\[\.border-b\]:pb-0/);
  assert.match(outputBlockSource, /title = "Output"/);
  assert.match(outputBlockSource, /\{title\}/);
  assert.doesNotMatch(outputBlockSource, /Command output/);
  assert.match(outputBlockSource, /bg-zinc-950/);
  assert.match(outputBlockSource, /min-w-max p-3/);
  assert.doesNotMatch(outputBlockSource, /bg-muted\/60/);
  for (const path of outputSurfacePaths) {
    const source = read(path);
    assert.match(source, /OutputBlock/);
    assert.doesNotMatch(source, /class="output/);
  }
});

test("show output terminal titles prefer device names from display state", () => {
  const showWorkspaceSource = read(
    "frontend/src/domains/show/application/createShowWorkspaces.ts",
  );
  const singleShowPanelSource = read(
    "frontend/src/domains/show/presentation/components/SingleShowPanel.svelte",
  );
  const batchShowResultsSource = read(
    "frontend/src/domains/show/presentation/components/BatchShowResultsPanel.svelte",
  );

  assert.match(showWorkspaceSource, /outputTitle: deviceName \|\|/);
  assert.match(showWorkspaceSource, /outputTitle: target \|\|/);
  assert.match(singleShowPanelSource, /title=\{showResultRow\.outputTitle\}/);
  assert.match(
    batchShowResultsSource,
    /title=\{activeResultRow\.outputTitle\}/,
  );
  assert.doesNotMatch(singleShowPanelSource, /<StatusCard/);
  assert.doesNotMatch(batchShowResultsSource, /<StatusCard/);
});

test("batch show results flatten device objects into the shared result navigator", () => {
  const source = read(
    "frontend/src/domains/show/presentation/components/BatchShowResultsPanel.svelte",
  );
  const workspaceSource = read(
    "frontend/src/domains/show/application/createShowWorkspaces.ts",
  );

  assert.match(source, /let activeResultKey = \$state\(""\)/);
  assert.match(source, /let resultView = \$state\("output"\)/);
  assert.match(source, /ExecutionResultsPanel/);
  assert.match(source, /deviceRows\.flatMap/);
  assert.match(source, /navigationAriaLabel=\{i18nLabels\.devicesAria\}/);
  assert.match(source, /aria-label=\{i18nLabels\.objectsAria\}/);
  assert.match(source, /i18nLabels\.rawOutputTab/);
  assert.match(source, /i18nLabels\.parsedOutputTab/);
  assert.match(source, /resultView === "output"/);
  assert.doesNotMatch(
    source,
    /#each batchResultsPresentation\.resultRows as batchShowResultRow/,
  );
  assert.match(workspaceSource, /resultCount: resultRows\.length/);
  assert.match(
    workspaceSource,
    /deviceRows: batchShowDeviceRows\(resultRows\)/,
  );
  assert.match(
    workspaceSource,
    /resultKey: `\$\{target\}\|\$\{object\}\|\$\{command\}\|\$\{index\}`/,
  );
});

test("dashboard preference menus compose shadcn DropdownMenu", () => {
  const source = read(
    "frontend/src/domains/dashboard/presentation/components/DashboardPreferenceTools.svelte",
  );

  assert.match(source, /ui\/dropdown-menu/);
  assert.match(source, /<DropdownMenu\.Root/);
  assert.match(source, /<DropdownMenu\.Trigger/);
  assert.match(source, /<DropdownMenu\.Content/);
  assert.match(source, /themeModeRows/);
  assert.doesNotMatch(
    source,
    /themePresetRows|themeRadiusRows|chooseThemePreset|chooseThemeRadius/,
  );
  assert.doesNotMatch(source, /dashboard-menu(?:\b|-)/);
});

test("simple page panels compose shadcn Card instead of group-card shells", () => {
  const pagePaths = [
    "frontend/src/domains/backup/presentation/components/BackupWorkspace.svelte",
    "frontend/src/domains/blacklist/presentation/components/BlacklistWorkspace.svelte",
    "frontend/src/domains/replay/presentation/components/ReplayWorkspace.svelte",
    "frontend/src/domains/transfer/presentation/components/TransferWorkspace.svelte",
    "frontend/src/domains/tasks/presentation/components/TaskRunListPanel.svelte",
  ];

  for (const path of pagePaths) {
    const source = read(path);

    assert.match(source, /ui\/card/);
    assert.match(source, /<Card\.Root/);
    assert.match(source, /WorkspaceActionHeader|ExecutionResultsPanel/);
    assert.match(source, /<Card\.Content/);
    assert.doesNotMatch(source, /group-card/);
  }
});

test("backup archives use a full-width aligned resource list", () => {
  const pageSource = read(
    "frontend/src/domains/backup/presentation/components/BackupWorkspace.svelte",
  );
  const stateSource = read(
    "frontend/src/domains/backup/presentation/backupPresentation.ts",
  );

  assert.match(pageSource, /FileArchiveIcon/);
  assert.match(pageSource, /GitMergeIcon/);
  assert.match(pageSource, /divide-y divide-border/);
  assert.match(
    pageSource,
    /sm:grid-cols-\[minmax\(0,1fr\)_minmax\(13rem,0\.65fr\)\]/,
  );
  assert.match(pageSource, /backupRow\.showPath/);
  assert.doesNotMatch(pageSource, /md:w-225/);
  assert.doesNotMatch(stateSource, /border-teal|bg-teal|text-slate|bg-white/);
  assert.match(stateSource, /showPath: path !== name/);
});

test("template panels compose shadcn Card instead of group-card shells", () => {
  const panelPaths = [
    "frontend/src/domains/templates/presentation/components/TemplateCatalogPanel.svelte",
    "frontend/src/domains/templates/presentation/components/TextfsmMappingWorkspace.svelte",
    "frontend/src/domains/templates/presentation/components/ShowObjectWorkspace.svelte",
  ];

  for (const path of panelPaths) {
    const source = read(path);

    assert.match(source, /ui\/card/);
    assert.match(source, /<Card\.Root/);
    assert.match(source, /<Card\.Header/);
    assert.match(source, /<Card\.Title/);
    assert.match(source, /<Card\.Content/);
    assert.doesNotMatch(source, /group-card/);
  }
});

test("inventory panels compose shadcn Card instead of group-card shells", () => {
  const panelPaths = [
    "frontend/src/domains/inventory/presentation/components/InventoryCollectionPanel.svelte",
  ];

  for (const path of panelPaths) {
    const source = read(path);

    assert.match(source, /ui\/card/);
    assert.match(source, /<Card\.Root/);
    assert.match(source, /WorkspaceActionHeader/);
    assert.match(source, /<Card\.Content/);
    assert.doesNotMatch(source, /group-card/);
    assert.doesNotMatch(source, /group-body/);
  }
});

test("profile workspace uses one shadcn Card with semantic child sections", () => {
  const panelPaths = [
    "frontend/src/domains/profiles/presentation/components/BuiltinProfileOverviewSection.svelte",
    "frontend/src/domains/profiles/presentation/components/CustomProfileDetectPanel.svelte",
    "frontend/src/domains/profiles/presentation/components/CustomProfilesEditorPanel.svelte",
    "frontend/src/domains/profiles/presentation/components/ProfileDiagnosePanel.svelte",
  ];

  for (const path of panelPaths) {
    const source = read(path);

    assert.match(source, /<section/);
    assert.match(source, /border border-border/);
    assert.doesNotMatch(source, /group-card/);
  }

  const pageSource = read(
    "frontend/src/domains/profiles/presentation/components/ProfilesWorkspace.svelte",
  );
  assert.match(pageSource, /ui\/card/);
  assert.match(pageSource, /<Card\.Root/);
  assert.match(pageSource, /WorkspaceActionHeader/);
  assert.match(pageSource, /<Card\.Content/);
});

test("orchestrated panels compose shadcn Card instead of group-card shells", () => {
  const panelPaths = [
    "frontend/src/domains/orchestration/presentation/components/preview/OrchestrationPreviewPanel.svelte",
    "frontend/src/domains/transactions/presentation/components/block/TxBlockRunPanel.svelte",
    "frontend/src/domains/transactions/presentation/components/workflow/TxWorkflowPreviewPanel.svelte",
  ];

  for (const path of panelPaths) {
    const source = read(path);

    assert.match(source, /ui\/card/);
    assert.match(source, /<Card\.Root/);
    assert.match(source, /<Card\.Header/);
    assert.match(source, /<Card\.Title/);
    assert.match(source, /<Card\.Content/);
    assert.doesNotMatch(source, /group-card/);
  }
});

test("workspace entry panels share the theme-aware action header", () => {
  const header = read(
    "frontend/src/components/fragments/WorkspaceActionHeader.svelte",
  );
  const panelPaths = [
    "frontend/src/pages/StandardPage.svelte",
    "frontend/src/domains/transactions/presentation/components/block/TxBlockInputPanel.svelte",
    "frontend/src/domains/transactions/presentation/components/workflow/TxWorkflowInputPanel.svelte",
    "frontend/src/domains/orchestration/presentation/components/editor/OrchestrationEditorSurface.svelte",
  ];

  assert.match(header, /<Card\.Header/);
  assert.match(header, /<Card\.Title/);
  assert.match(header, /<Card\.Description/);
  assert.match(header, /border-primary\/15/);
  assert.match(header, /HeaderIcon/);
  assert.match(header, /bg-primary\/10/);

  for (const path of panelPaths) {
    const source = read(path);
    assert.match(source, /WorkspaceActionHeader/);
    assert.match(source, /<Card\.Root/);
    assert.match(source, /<Card\.Content/);
    assert.doesNotMatch(source, /group-card/);
  }

  const button = read("frontend/src/lib/components/ui/button/button.svelte");
  assert.match(button, /"primary-outline"/);
});

test("top-level workspace cards keep icon-bearing headers", () => {
  const pagePaths = [
    "frontend/src/domains/backup/presentation/components/BackupWorkspace.svelte",
    "frontend/src/domains/blacklist/presentation/components/BlacklistWorkspace.svelte",
    "frontend/src/domains/inventory/presentation/components/InventoryWorkspace.svelte",
    "frontend/src/domains/profiles/presentation/components/ProfilesWorkspace.svelte",
    "frontend/src/domains/replay/presentation/components/ReplayWorkspace.svelte",
    "frontend/src/pages/StandardPage.svelte",
    "frontend/src/domains/templates/presentation/components/TemplateManagerWorkspace.svelte",
    "frontend/src/domains/transfer/presentation/components/TransferWorkspace.svelte",
    "frontend/src/domains/tasks/presentation/components/TaskDetailPanel.svelte",
    "frontend/src/domains/tasks/presentation/components/TaskFiltersPanel.svelte",
    "frontend/src/domains/tasks/presentation/components/TaskRunListPanel.svelte",
    "frontend/src/domains/show/presentation/components/BatchShowInputPanel.svelte",
    "frontend/src/domains/show/presentation/components/BatchShowResultsPanel.svelte",
    "frontend/src/domains/show/presentation/components/SingleShowPanel.svelte",
  ];

  for (const path of pagePaths) {
    const source = read(path);
    assert.match(source, /WorkspaceActionHeader|ExecutionResultsPanel/);
    assert.match(source, /icon=\{\w+Icon\}/);
  }
});

test("query cards share the workspace card treatment", () => {
  const queryPanelPaths = [
    "frontend/src/domains/show/presentation/components/SingleShowPanel.svelte",
    "frontend/src/domains/show/presentation/components/BatchShowInputPanel.svelte",
    "frontend/src/domains/show/presentation/components/BatchShowResultsPanel.svelte",
  ];

  for (const path of queryPanelPaths) {
    const source = read(path);
    assert.match(source, /WorkspaceActionHeader|ExecutionResultsPanel/);
    assert.match(
      source,
      /gap-0 overflow-hidden border-border\/80 py-0|ExecutionResultsPanel/,
    );
    assert.doesNotMatch(source, /rounded-3xl/);
  }

  const showWorkspace = read(
    "frontend/src/domains/show/presentation/components/ShowWorkspace.svelte",
  );
  assert.doesNotMatch(showWorkspace, /max-w-4xl/);

  const orchestrationSurface = read(
    "frontend/src/domains/orchestration/presentation/components/editor/OrchestrationEditorSurface.svelte",
  );
  assert.match(
    orchestrationSurface,
    /Card\.Root class="gap-0 overflow-hidden border-border\/80 py-0/,
  );
});

test("batch delivery owns one outer workspace card", () => {
  const page = read("frontend/src/pages/BatchPage.svelte");
  const commandPanel = read(
    "frontend/src/domains/standard/presentation/components/batch/BatchExecPanel.svelte",
  );
  const modeField = read(
    "frontend/src/components/fragments/ModeExpressionField.svelte",
  );

  assert.match(page, /<Card\.Root/);
  assert.match(page, /WorkspaceActionHeader/);
  assert.match(page, /<Card\.Content/);
  assert.match(
    commandPanel,
    /md:grid-cols-\[minmax\(0,2fr\)_minmax\(16rem,1fr\)\]/,
  );
  assert.match(modeField, /class="min-h-9 min-w-0 w-full/);

  for (const path of [
    "frontend/src/domains/standard/presentation/components/batch/BatchExecPanel.svelte",
    "frontend/src/domains/standard/presentation/components/batch/BatchFlowPanel.svelte",
  ]) {
    const source = read(path);
    assert.doesNotMatch(source, /ui\/card|<Card\.|WorkspaceActionHeader/);
    assert.match(source, /class="grid gap-5 p-4 sm:p-5"/);
  }
});

test("json template workspaces share the four template actions", () => {
  const actions = read(
    "frontend/src/components/fragments/WorkspaceTemplateActions.svelte",
  );
  assert.match(actions, /orchestrationTemplateNew/);
  assert.match(actions, /orchestrationTemplateSave/);
  assert.match(actions, /orchestrationTemplateSaveAs/);
  assert.match(actions, /orchestrationImportFileBtn/);
  assert.match(actions, /primary-outline/);

  for (const path of [
    "frontend/src/domains/orchestration/presentation/components/editor/OrchestrationEditorSurface.svelte",
    "frontend/src/domains/transactions/presentation/components/block/TxBlockInputPanel.svelte",
    "frontend/src/domains/transactions/presentation/components/workflow/TxWorkflowInputPanel.svelte",
  ]) {
    assert.match(read(path), /WorkspaceTemplateActions/);
  }
});

test("framed orchestrated editors compose shadcn Card", () => {
  const panelPaths = [
    "frontend/src/domains/orchestration/presentation/components/editor/OrchestrationStageEditor.svelte",
    "frontend/src/domains/transactions/presentation/components/workflow/TxWorkflowBlockEditor.svelte",
  ];

  for (const path of panelPaths) {
    const source = read(path);

    assert.match(source, /ui\/card/);
    assert.match(source, /<Card\.Root/);
    assert.match(source, /<Card\.Header/);
    assert.match(source, /<Card\.Title/);
    assert.match(source, /<Card\.Content/);
    assert.doesNotMatch(source, /group-card/);
  }
});

test("nested transaction block editors stay unframed", () => {
  const panelPaths = [
    "frontend/src/domains/transactions/presentation/components/block/TxBlockCommandDynParamsEditor.svelte",
    "frontend/src/domains/transactions/presentation/components/block/TxBlockCommandInteractionEditor.svelte",
  ];

  for (const path of panelPaths) {
    const source = read(path);

    assert.doesNotMatch(source, /ui\/card/);
    assert.doesNotMatch(source, /<Card\./);
    assert.doesNotMatch(source, /group-card/);
  }
});

test("tx block visual editor owns the single inspector card shell", () => {
  const visualEditorSource = read(
    "frontend/src/domains/transactions/presentation/components/block/TxBlockVisualEditor.svelte",
  );
  const stepEditorSource = read(
    "frontend/src/domains/transactions/presentation/components/block/TxBlockStepEditor.svelte",
  );
  const rootInspectorSource = read(
    "frontend/src/domains/transactions/presentation/components/block/TxBlockRootInspector.svelte",
  );
  const rollbackEditorSource = read(
    "frontend/src/domains/transactions/presentation/components/block/TxBlockRollbackPolicyEditor.svelte",
  );

  const inspectorComposition = [
    visualEditorSource,
    rootInspectorSource,
    rollbackEditorSource,
    stepEditorSource,
  ].join("\n");

  assert.equal(inspectorComposition.match(/<Card\.Root/g)?.length, 1);
  assert.match(visualEditorSource, /<TxBlockStepEditor/);
  assert.match(visualEditorSource, /<TxBlockRootInspector/);
  assert.match(stepEditorSource, /ui\/card/);
  assert.match(stepEditorSource, /<Card\.Content/);
  assert.doesNotMatch(stepEditorSource, /<Card\.Root/);
  assert.doesNotMatch(stepEditorSource, /<Card\.Header/);
  assert.doesNotMatch(stepEditorSource, /<Card\.Title/);
  assert.doesNotMatch(rootInspectorSource, /<Card\.Root/);
  assert.doesNotMatch(rollbackEditorSource, /ui\/card/);
  assert.doesNotMatch(rollbackEditorSource, /<Card\.(Root|Header|Content)/);
});

test("task page subpanels compose shadcn Card instead of group-card shells", () => {
  const panelPaths = [
    "frontend/src/domains/tasks/presentation/components/TaskDetailPanel.svelte",
    "frontend/src/domains/tasks/presentation/components/TaskFiltersPanel.svelte",
    "frontend/src/domains/tasks/presentation/components/TaskRunListPanel.svelte",
  ];

  for (const path of panelPaths) {
    const source = read(path);

    assert.match(source, /ui\/card/);
    assert.match(source, /<Card\.Root/);
    assert.match(source, /WorkspaceActionHeader/);
    assert.match(source, /<Card\.Content/);
    assert.doesNotMatch(source, /group-card/);
  }
});

test("dashboard shell layout uses component-local classes", () => {
  const appCss = read("frontend/src/app.css");
  const dashboardBody = read(
    "frontend/src/domains/dashboard/presentation/components/DashboardBody.svelte",
  );
  const legacyShellClassPattern =
    /(?:\.|\b)(?:navbar|dashboard-shell|dashboard-header|main-scroll|dashboard-panel)\b/;

  assert.doesNotMatch(appCss, legacyShellClassPattern);
  assert.doesNotMatch(dashboardBody, legacyShellClassPattern);
  assert.match(dashboardBody, /lg:overflow-y-auto/);
  assert.match(dashboardBody, /lg:overscroll-contain/);
});

test("dashboard topbar tools use component-local shadcn classes", () => {
  const appCss = read("frontend/src/app.css");
  const dashboardBody = read(
    "frontend/src/domains/dashboard/presentation/components/DashboardBody.svelte",
  );
  const preferenceTools = read(
    "frontend/src/domains/dashboard/presentation/components/DashboardPreferenceTools.svelte",
  );
  const legacyToolClassPattern =
    /dashboard-(?:header-actions|header-primary|tool(?:-[a-z]+)*)/;

  assert.doesNotMatch(appCss, legacyToolClassPattern);
  assert.doesNotMatch(dashboardBody, legacyToolClassPattern);
  assert.doesNotMatch(preferenceTools, legacyToolClassPattern);
  assert.match(dashboardBody, /<Button/);
  assert.match(preferenceTools, /<Button/);
});

test("global styles do not redefine shadcn drawer shell behavior", () => {
  const source = read("frontend/src/app.css");

  assert.doesNotMatch(source, /\.dashboard-drawer(?:\.|\s|\{)/);
  assert.doesNotMatch(source, /dashboard-drawer-backdrop/);
});

test("global styles do not redefine shadcn preference menu behavior", () => {
  const source = read("frontend/src/app.css");

  assert.doesNotMatch(source, /dashboard-menu(?:\b|-)/);
});
