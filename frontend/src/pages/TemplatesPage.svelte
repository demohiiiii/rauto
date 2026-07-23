<script>
  import * as Card from "$lib/components/ui/card";
  import * as Tabs from "$lib/components/ui/tabs";
  import {
    BlocksIcon,
    BracesIcon,
    FileCode2Icon,
    GitBranchIcon,
    Layers3Icon,
    Link2Icon,
    NetworkIcon,
    SlidersHorizontalIcon,
    SparklesIcon,
  } from "@lucide/svelte";
  import DashboardTabPanel from "../components/layout/DashboardTabPanel.svelte";
  import WorkspaceActionHeader from "../components/fragments/WorkspaceActionHeader.svelte";
  import { currentLanguageState, t } from "../lib/i18n.js";
  import {
    TEMPLATE_MANAGER_KIND,
    contentTemplateKinds,
    createContentTemplateWorkspace,
    createShowObjectWorkspace,
    createTextfsmMappingWorkspace,
    templateManagerSections,
  } from "../modules/templates/templateManagerState.js";
  import ShowObjectWorkspace from "./templates/ShowObjectWorkspace.svelte";
  import TemplateCatalogPanel from "./templates/TemplateCatalogPanel.svelte";
  import TextfsmMappingWorkspace from "./templates/TextfsmMappingWorkspace.svelte";

  let { active } = $props();
  const contentWorkspace = createContentTemplateWorkspace();
  const mappingWorkspace = createTextfsmMappingWorkspace();
  const showObjectWorkspace = createShowObjectWorkspace();
  let currentLanguage = $derived($currentLanguageState);
  let activeSectionKey = $state(TEMPLATE_MANAGER_KIND.command);
  let mappingLoaded = $state(false);
  let showObjectsLoaded = $state(false);
  let initialized = $state(false);

  let activeDefinition = $derived(
    templateManagerSections.find(
      (section) => section.key === activeSectionKey,
    ) || templateManagerSections[0],
  );
  let pageLabels = $derived.by(() => {
    currentLanguage;
    return {
      title: t("templateManagerWorkspaceTitle"),
      description: t("templateManagerWorkspaceDescription"),
    };
  });
  let localizedSections = $derived.by(() => {
    currentLanguage;
    return templateManagerSections.map((section) => ({
      ...section,
      label: t(section.labelKey),
    }));
  });

  async function selectSection(sectionKey) {
    if (sectionKey === activeSectionKey) return;
    if (contentTemplateKinds.has(sectionKey)) {
      const activated = await contentWorkspace.activate(sectionKey);
      if (!activated) return;
    }
    activeSectionKey = sectionKey;
    if (
      sectionKey === TEMPLATE_MANAGER_KIND.textfsmMappings &&
      !mappingLoaded
    ) {
      mappingLoaded = true;
      await mappingWorkspace.load();
    }
    if (
      sectionKey === TEMPLATE_MANAGER_KIND.showObjects &&
      !showObjectsLoaded
    ) {
      showObjectsLoaded = true;
      await showObjectWorkspace.load();
    }
  }

  $effect(() => {
    if (!active || initialized) return;
    initialized = true;
    void contentWorkspace.activate(TEMPLATE_MANAGER_KIND.command);
  });
</script>

<DashboardTabPanel {active}>
  <Card.Root class="gap-0 overflow-hidden border-border/80 py-0 shadow-sm">
    <WorkspaceActionHeader
      title={pageLabels.title}
      description={pageLabels.description}
      icon={SparklesIcon}
    />

    <Card.Content class="min-w-0 p-0">
      <Tabs.Root
        value={activeSectionKey}
        onValueChange={selectSection}
        class="min-w-0 gap-0"
      >
        <div class="border-b bg-muted/15 px-3 py-2 sm:px-5">
          <Tabs.List
            variant="line"
            aria-label={t("templatesTitle")}
            class="!grid !h-auto w-full grid-cols-2 gap-1 md:grid-cols-4"
          >
            {#each localizedSections as section (section.key)}
              <Tabs.Trigger
                value={section.key}
                class="h-10 min-w-0 justify-start rounded-lg border-border/70 bg-card/70 px-2 text-xs hover:border-primary/30 hover:bg-primary/5 hover:text-primary data-active:!border-primary/60 data-active:!bg-primary/10 data-active:!text-primary after:inset-x-3 after:bottom-0 after:rounded-full after:bg-primary sm:justify-center"
              >
                {#if section.key === TEMPLATE_MANAGER_KIND.command}
                  <FileCode2Icon aria-hidden="true" />
                {:else if section.key === TEMPLATE_MANAGER_KIND.flow}
                  <GitBranchIcon aria-hidden="true" />
                {:else if section.key === TEMPLATE_MANAGER_KIND.txBlock}
                  <BlocksIcon aria-hidden="true" />
                {:else if section.key === TEMPLATE_MANAGER_KIND.txWorkflow}
                  <Layers3Icon aria-hidden="true" />
                {:else if section.key === TEMPLATE_MANAGER_KIND.orchestration}
                  <NetworkIcon aria-hidden="true" />
                {:else if section.key === TEMPLATE_MANAGER_KIND.textfsm}
                  <BracesIcon aria-hidden="true" />
                {:else if section.key === TEMPLATE_MANAGER_KIND.textfsmMappings}
                  <Link2Icon aria-hidden="true" />
                {:else}
                  <SlidersHorizontalIcon aria-hidden="true" />
                {/if}
                <span>{section.label}</span>
              </Tabs.Trigger>
            {/each}
          </Tabs.List>
        </div>

        <section class="min-w-0 p-4 sm:p-5 lg:p-6">
          {#if contentTemplateKinds.has(activeSectionKey)}
            <TemplateCatalogPanel
              definition={activeDefinition}
              workspace={contentWorkspace}
            />
          {:else if activeSectionKey === TEMPLATE_MANAGER_KIND.textfsmMappings}
            <TextfsmMappingWorkspace
              definition={activeDefinition}
              workspace={mappingWorkspace}
            />
          {:else}
            <ShowObjectWorkspace
              definition={activeDefinition}
              workspace={showObjectWorkspace}
            />
          {/if}
        </section>
      </Tabs.Root>
    </Card.Content>
  </Card.Root>
</DashboardTabPanel>
