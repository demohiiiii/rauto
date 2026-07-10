<script>
  import TabList from "../components/fragments/TabList.svelte";
  import DashboardTabPanel from "../components/layout/DashboardTabPanel.svelte";
  import { templatePageSections } from "../config/dashboardModes.js";
  import { createTemplatesPageWorkspace } from "../modules/templates.js";
  import BuiltinFlowTemplatesPanel from "./templates/BuiltinFlowTemplatesPanel.svelte";
  import CustomFlowTemplatesPanel from "./templates/CustomFlowTemplatesPanel.svelte";
  import CustomShowObjectsPanel from "./templates/CustomShowObjectsPanel.svelte";
  import TemplateLibraryPanel from "./templates/TemplateLibraryPanel.svelte";
  import TextfsmMappingsPanel from "./templates/TextfsmMappingsPanel.svelte";
  import TextfsmTemplateEditorPanel from "./templates/TextfsmTemplateEditorPanel.svelte";

  let { active } = $props();
  const templatesWorkspace = createTemplatesPageWorkspace();
  const {
    copyBuiltinFlowTemplateToCustom,
    createFlowTemplateDraft,
    createTemplateDraft,
    createTextfsmTemplateDraft,
    deleteCustomShowObject,
    deleteFlowTemplate,
    deleteTemplate,
    deleteTextfsmMapping,
    deleteTextfsmTemplate,
    handleCustomShowObjectCommandInput: updateCustomShowObjectCommand,
    handleCustomShowObjectMappingChange: updateCustomShowObjectMapping,
    handleCustomShowObjectProfileChange: updateCustomShowObjectProfile,
    handleCustomShowObjectUseMappingChange: updateCustomShowObjectUseMapping,
    handleFlowTemplatePickerChange: updateFlowTemplatePicker,
    handleTemplatePickerChange: updateTemplatePicker,
    handleTextfsmMappingProfileChange: updateTextfsmMappingProfile,
    loadBuiltinFlowTemplateDetail,
    loadTextfsmMappings,
    refreshCustomShowObjects,
    refreshSelectedBuiltinFlowTemplate,
    refreshSelectedTextfsmTemplate,
    saveCustomShowObject,
    saveFlowTemplate,
    saveTemplate,
    saveTextfsmMapping,
    saveTextfsmTemplate,
    selectBuiltinFlowTemplateName,
    selectCustomShowObject,
    selectFlowTemplateName,
    selectTemplateName,
    selectTextfsmMapping,
    selectTextfsmTemplateName,
    destroy,
    currentTemplateSectionState,
    openTemplateSection,
    pageDisplayStateStore,
    setPageContext,
  } = templatesWorkspace;
  let currentTemplateSection = $derived($currentTemplateSectionState);
  let pageDisplay = $derived($pageDisplayStateStore);

  $effect(() => {
    setPageContext({ active });
  });

  $effect(() => {
    return () => {
      destroy();
    };
  });
</script>

<DashboardTabPanel {active} titleKey="templatesTitle">
  <TabList
    tabItems={templatePageSections}
    activeValue={currentTemplateSection}
    aria-label={pageDisplay.sectionAriaLabel}
    class="mt-3 flex-wrap"
    onSelect={openTemplateSection}
  />
  <div class="mt-4 grid gap-3">
    {#if pageDisplay.showJsonTemplates}
      <TemplateLibraryPanel
        onCreateDraft={createTemplateDraft}
        onDelete={deleteTemplate}
        onPickerChange={updateTemplatePicker}
        onSave={saveTemplate}
        onSelect={selectTemplateName}
      />
    {:else if pageDisplay.showFlowTemplates}
      <BuiltinFlowTemplatesPanel
        onCopy={copyBuiltinFlowTemplateToCustom}
        onLoadBuiltinFlowTemplateDetail={loadBuiltinFlowTemplateDetail}
        onPickerChange={refreshSelectedBuiltinFlowTemplate}
        onSelect={selectBuiltinFlowTemplateName}
      />
      <CustomFlowTemplatesPanel
        onCreateDraft={createFlowTemplateDraft}
        onDelete={deleteFlowTemplate}
        onPickerChange={updateFlowTemplatePicker}
        onSave={saveFlowTemplate}
        onSelect={selectFlowTemplateName}
      />
    {:else if pageDisplay.showTextfsm}
      <div class="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.8fr)]">
        <TextfsmTemplateEditorPanel
          onCreateDraft={createTextfsmTemplateDraft}
          onDelete={deleteTextfsmTemplate}
          onPickerChange={refreshSelectedTextfsmTemplate}
          onSave={saveTextfsmTemplate}
          onSelect={selectTextfsmTemplateName}
        />
        <TextfsmMappingsPanel
          onDelete={deleteTextfsmMapping}
          onLoad={loadTextfsmMappings}
          onProfileChange={updateTextfsmMappingProfile}
          onSave={saveTextfsmMapping}
          onSelect={selectTextfsmMapping}
        />
      </div>
    {:else if pageDisplay.showShowObjects}
      <CustomShowObjectsPanel
        onCommandInput={updateCustomShowObjectCommand}
        onDelete={deleteCustomShowObject}
        onMappingChange={updateCustomShowObjectMapping}
        onProfileChange={updateCustomShowObjectProfile}
        onRefresh={refreshCustomShowObjects}
        onSave={saveCustomShowObject}
        onSelect={selectCustomShowObject}
        onUseMappingChange={updateCustomShowObjectUseMapping}
      />
    {/if}
  </div>
</DashboardTabPanel>
