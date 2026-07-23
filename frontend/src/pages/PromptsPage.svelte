<script>
  import * as Card from "$lib/components/ui/card";
  import * as Dialog from "$lib/components/ui/dialog/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import {
    ActivityIcon,
    BookOpenIcon,
    ChevronRightIcon,
    CopyIcon,
    ListTreeIcon,
    PanelLeftCloseIcon,
    PanelLeftOpenIcon,
    PencilLineIcon,
    PlusIcon,
    SearchIcon,
    StethoscopeIcon,
    UserCogIcon,
  } from "@lucide/svelte";
  import DashboardTabPanel from "../components/layout/DashboardTabPanel.svelte";
  import StatusCard from "../components/fragments/StatusCard.svelte";
  import WorkspaceActionHeader from "../components/fragments/WorkspaceActionHeader.svelte";
  import { currentLanguageState, t } from "../lib/i18n.js";
  import { cn } from "$lib/utils.js";
  import {
    changeBuiltinProfileSelection,
    createCustomProfileDraft,
    createPromptProfilesPageWorkspace,
    customProfileOptionsState,
    loadSelectedCustomProfile,
    setProfileDiagnoseSelected,
  } from "../modules/profiles/profiles.js";
  import BuiltinProfileDetailsPanel from "./prompts/BuiltinProfileDetailsPanel.svelte";
  import CustomProfilesEditorPanel from "./prompts/CustomProfilesEditorPanel.svelte";
  import ProfileDiagnosePanel from "./prompts/ProfileDiagnosePanel.svelte";

  let { active } = $props();
  const promptPageWorkspace = createPromptProfilesPageWorkspace();
  const { builtinPanelDisplayStateStore, pageDisplayStateStore } =
    promptPageWorkspace;
  let profileSearch = $state("");
  let catalogCollapsed = $state(false);
  let diagnoseDialogOpen = $state(false);
  let selectedProfileKind = $state("");
  let selectedProfileName = $state("");
  let currentLanguage = $derived($currentLanguageState);
  let pageDisplay = $derived($pageDisplayStateStore);
  let builtinPanelDisplay = $derived($builtinPanelDisplayStateStore);
  let customProfileOptions = $derived($customProfileOptionsState);
  let activeModeLabel = $derived.by(() => {
    currentLanguage;
    return t("promptModeProfiles");
  });
  let profileRows = $derived.by(() => {
    currentLanguage;
    const builtinRows = (builtinPanelDisplay.overview.profileRows || []).map(
      (row) => ({
        ...row,
        key: `builtin:${row.name}`,
        kind: "builtin",
        typeLabel: t("profileTypeBuiltin"),
      }),
    );
    const customNames = [...(customProfileOptions.names || [])];
    if (
      selectedProfileKind === "custom" &&
      selectedProfileName &&
      !customNames.includes(selectedProfileName)
    ) {
      customNames.push(selectedProfileName);
    }
    const customRows = customNames.map((name) => ({
      aliases: [],
      key: `custom:${name}`,
      kind: "custom",
      name,
      summary: t("profileCustomRowSummary"),
      typeLabel: t("profileTypeCustom"),
    }));
    return [...builtinRows, ...customRows].sort((left, right) =>
      left.name.localeCompare(right.name),
    );
  });
  let filteredProfileRows = $derived.by(() => {
    const query = profileSearch.trim().toLowerCase();
    if (!query) return profileRows;
    return profileRows.filter((row) =>
      [row.name, row.summary, row.typeLabel, ...(row.aliases || [])]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  });
  let selectedProfileRow = $derived(
    profileRows.find(
      (row) =>
        row.kind === selectedProfileKind && row.name === selectedProfileName,
    ) || null,
  );

  function updateProfileSearch(event) {
    profileSearch = event.currentTarget.value;
  }

  function toggleProfileCatalog() {
    catalogCollapsed = !catalogCollapsed;
  }

  function openDiagnoseDialog() {
    if (selectedProfileName) {
      setProfileDiagnoseSelected(selectedProfileName);
    }
    diagnoseDialogOpen = true;
  }

  function setDiagnoseDialogOpen(open) {
    diagnoseDialogOpen = open;
  }

  async function selectProfile(profileRow) {
    if (!profileRow?.name || !profileRow?.kind) return;
    if (profileRow.kind === "builtin") {
      selectedProfileKind = profileRow.kind;
      selectedProfileName = profileRow.name;
      await changeBuiltinProfileSelection(profileRow.name);
      return;
    }
    await loadSelectedCustomProfile(profileRow.name);
    selectedProfileKind = profileRow.kind;
    selectedProfileName = profileRow.name;
  }

  async function copyBuiltinProfile() {
    const copiedName =
      await promptPageWorkspace.copyBuiltinProfileToCustomAndEdit();
    if (!copiedName) return;
    selectedProfileKind = "custom";
    selectedProfileName = copiedName;
  }

  async function createCustomProfile() {
    const createdName = await createCustomProfileDraft();
    if (!createdName) return;
    selectedProfileKind = "custom";
    selectedProfileName = createdName;
  }

  function syncCustomProfileIdentity(profileName = "") {
    const normalizedName = String(profileName || "").trim();
    selectedProfileKind = normalizedName ? "custom" : "";
    selectedProfileName = normalizedName;
  }

  $effect(() => {
    promptPageWorkspace.setPageContext({ active });
  });
</script>

<DashboardTabPanel {active}>
  <Card.Root class="gap-0 overflow-visible border-border/80 py-0 shadow-sm">
    <WorkspaceActionHeader
      class="rounded-t-xl"
      title={t("promptProfilesTitle")}
      description={t("promptProfilesDescription")}
      icon={UserCogIcon}
    />

    <Card.Content class="min-w-0 p-0">
      <div
        class="grid border-b bg-muted/10 sm:grid-cols-3 sm:divide-x sm:divide-border"
      >
        <div class="flex items-center gap-3 px-4 py-3 sm:px-5">
          <BookOpenIcon
            class="size-4 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <div class="min-w-0">
            <div class="text-xs text-muted-foreground">
              {t("profileBuiltinCount")}
            </div>
            <div class="font-mono text-base font-semibold tabular-nums">
              {builtinPanelDisplay.overview.profileNames.length}
            </div>
          </div>
        </div>
        <div class="flex items-center gap-3 px-4 py-3 sm:px-5">
          <PencilLineIcon
            class="size-4 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <div class="min-w-0">
            <div class="text-xs text-muted-foreground">
              {t("profileCustomCount")}
            </div>
            <div class="font-mono text-base font-semibold tabular-nums">
              {customProfileOptions.names.length}
            </div>
          </div>
        </div>
        <div class="flex items-center gap-3 px-4 py-3 sm:px-5">
          <ActivityIcon
            class="size-4 shrink-0 text-primary"
            aria-hidden="true"
          />
          <div class="min-w-0">
            <div class="text-xs text-muted-foreground">
              {t("profileWorkspaceStatus")}
            </div>
            <div class="truncate text-sm font-semibold">{activeModeLabel}</div>
          </div>
        </div>
      </div>

      <section class="min-w-0 p-4 sm:p-5 lg:p-6">
        <div
          class={cn(
            "grid min-w-0 gap-5 transition-[grid-template-columns] duration-200 motion-reduce:transition-none",
            catalogCollapsed
              ? "lg:grid-cols-[4rem_minmax(0,1fr)]"
              : "lg:grid-cols-[19rem_minmax(0,1fr)]",
          )}
        >
          <aside
            class={cn(
              "z-10 min-w-0 self-start rounded-lg border border-border bg-card/95 shadow-sm lg:sticky lg:top-[-1.5rem] lg:flex lg:max-h-[calc(100dvh-5rem)] lg:flex-col",
              catalogCollapsed ? "p-2" : "p-4",
            )}
            aria-label={t("profileCatalogTitle")}
          >
            {#if catalogCollapsed}
              <div
                class="flex min-h-11 items-center justify-between gap-2 lg:min-h-24 lg:flex-col lg:justify-start"
              >
                <div
                  class="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary"
                  title={t("profileCatalogTitle")}
                >
                  <ListTreeIcon class="size-4" aria-hidden="true" />
                  <span class="sr-only">{t("profileCatalogTitle")}</span>
                </div>
                <span
                  class="flex min-w-6 items-center justify-center rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
                >
                  {profileRows.length}
                </span>
                <Button
                  class="size-10 lg:mt-auto"
                  variant="ghost"
                  size="icon-sm"
                  type="button"
                  title={`${t("expand")} ${t("profileCatalogTitle")}`}
                  aria-label={`${t("expand")} ${t("profileCatalogTitle")}`}
                  aria-expanded="false"
                  onclick={toggleProfileCatalog}
                >
                  <PanelLeftOpenIcon class="size-4" aria-hidden="true" />
                </Button>
              </div>
            {:else}
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <h2 class="text-sm font-semibold">
                    {t("profileCatalogTitle")}
                  </h2>
                  <p class="mt-1 text-xs leading-5 text-muted-foreground">
                    {t("profileCatalogDescription")}
                  </p>
                </div>
                <div class="flex shrink-0 items-center gap-1">
                  <Button
                    class="size-10 sm:size-9"
                    variant="outline"
                    size="icon-sm"
                    type="button"
                    title={t("newBtn")}
                    aria-label={t("newBtn")}
                    onclick={createCustomProfile}
                  >
                    <PlusIcon aria-hidden="true" />
                  </Button>
                  <Button
                    class="size-10 sm:size-9"
                    variant="ghost"
                    size="icon-sm"
                    type="button"
                    title={`${t("collapse")} ${t("profileCatalogTitle")}`}
                    aria-label={`${t("collapse")} ${t("profileCatalogTitle")}`}
                    aria-expanded="true"
                    onclick={toggleProfileCatalog}
                  >
                    <PanelLeftCloseIcon class="size-4" aria-hidden="true" />
                  </Button>
                </div>
              </div>
              <div class="relative mt-4">
                <SearchIcon
                  class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  class="h-10 pl-9"
                  value={profileSearch}
                  aria-label={t("profileCatalogSearchPlaceholder")}
                  placeholder={t("profileCatalogSearchPlaceholder")}
                  oninput={updateProfileSearch}
                />
              </div>

              <div
                class="mt-3 grid max-h-[calc(100dvh-18rem)] min-h-24 gap-1 overflow-y-auto pr-1 lg:max-h-none lg:min-h-0 lg:flex-1"
                aria-label={t("profileCatalogTitle")}
              >
                {#each filteredProfileRows as profileRow (profileRow.key)}
                  <button
                    type="button"
                    class={cn(
                      "group flex min-h-16 w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                      profileRow.kind === selectedProfileKind &&
                        profileRow.name === selectedProfileName
                        ? "border-primary/40 bg-primary/10 text-foreground"
                        : "border-transparent text-muted-foreground hover:border-border hover:bg-muted/60 hover:text-foreground",
                    )}
                    aria-current={profileRow.kind === selectedProfileKind &&
                    profileRow.name === selectedProfileName
                      ? "true"
                      : undefined}
                    onclick={() => selectProfile(profileRow)}
                  >
                    <div class="min-w-0 flex-1">
                      <div class="flex min-w-0 items-center gap-2">
                        <span
                          class="truncate font-mono text-xs font-semibold text-foreground"
                        >
                          {profileRow.name}
                        </span>
                        <span
                          class={cn(
                            "shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold",
                            profileRow.kind === "builtin"
                              ? "bg-muted text-muted-foreground"
                              : "bg-primary/10 text-primary",
                          )}
                        >
                          {profileRow.typeLabel}
                        </span>
                      </div>
                      <div class="mt-1 line-clamp-2 text-xs leading-4">
                        {profileRow.summary || "-"}
                      </div>
                    </div>
                    <ChevronRightIcon
                      class="size-4 shrink-0 opacity-50 transition-transform group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </button>
                {/each}
                {#if filteredProfileRows.length === 0}
                  <div
                    class="rounded-lg border border-dashed border-border px-3 py-8 text-center text-xs text-muted-foreground"
                  >
                    {t("profileCatalogNoMatch")}
                  </div>
                {/if}
              </div>
            {/if}
          </aside>

          <div class="min-w-0">
            <div
              class="flex min-w-0 flex-wrap items-start justify-between gap-3 border-b border-border pb-4"
            >
              <div class="min-w-0">
                <div
                  class="flex items-center gap-2 text-xs font-medium text-muted-foreground"
                >
                  <span>{t("profileBuiltinDetailTitle")}</span>
                  {#if selectedProfileRow}
                    <span
                      class={cn(
                        "rounded-md px-1.5 py-0.5 text-[10px] font-semibold",
                        selectedProfileRow.kind === "builtin"
                          ? "bg-muted text-muted-foreground"
                          : "bg-primary/10 text-primary",
                      )}
                    >
                      {selectedProfileRow.typeLabel}
                    </span>
                  {/if}
                </div>
                <h2 class="mt-1 break-words font-mono text-lg font-semibold">
                  {selectedProfileName || "-"}
                </h2>
              </div>
              {#if selectedProfileRow}
                <div class="flex flex-wrap items-center justify-end gap-2">
                  <div class="group relative">
                    <Button
                      class="min-h-10"
                      variant="outline"
                      type="button"
                      title={t("profileDiagnoseButtonHint")}
                      aria-describedby="profile-diagnose-button-hint"
                      onclick={openDiagnoseDialog}
                    >
                      <StethoscopeIcon
                        data-icon="inline-start"
                        aria-hidden="true"
                      />
                      {t("promptModeDiagnose")}
                    </Button>
                    <div
                      id="profile-diagnose-button-hint"
                      role="tooltip"
                      class="pointer-events-none invisible absolute top-full right-0 z-30 mt-2 w-64 max-w-[calc(100vw-2rem)] rounded-md border border-border bg-popover px-3 py-2 text-left text-xs leading-5 text-popover-foreground opacity-0 shadow-md transition-opacity duration-150 group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100 motion-reduce:transition-none"
                    >
                      {t("profileDiagnoseButtonHint")}
                    </div>
                  </div>
                  {#if selectedProfileKind === "builtin"}
                    <Button
                      class="min-h-10"
                      variant="primary-outline"
                      type="button"
                      onclick={copyBuiltinProfile}
                    >
                      <CopyIcon data-icon="inline-start" aria-hidden="true" />
                      {builtinPanelDisplay.copyButtonLabel}
                    </Button>
                  {/if}
                </div>
              {/if}
            </div>

            {#if selectedProfileKind === "builtin" && builtinPanelDisplay.status.show}
              <div class="mt-4">
                <StatusCard
                  message={builtinPanelDisplay.status.message}
                  tone={builtinPanelDisplay.status.tone}
                />
              </div>
            {/if}

            {#if selectedProfileKind === "builtin"}
              <BuiltinProfileDetailsPanel
                profileDetail={builtinPanelDisplay.detail}
              />
            {:else if selectedProfileKind === "custom"}
              <div class="mt-5">
                <CustomProfilesEditorPanel
                  active={active && pageDisplay.profilesActive}
                  customStatusMessage={pageDisplay.customStatus.message}
                  customStatusTone={pageDisplay.customStatus.tone}
                  customTitle={pageDisplay.customTitle}
                  hooksHint={pageDisplay.hooksHint}
                  hooksTitle={pageDisplay.hooksTitle}
                  onProfileIdentityChange={syncCustomProfileIdentity}
                  showProfilePicker={false}
                  showCustomStatus={pageDisplay.customStatus.show}
                />
              </div>
            {:else}
              <div
                class="flex min-h-72 flex-col items-center justify-center px-6 text-center"
              >
                <div
                  class="flex size-11 items-center justify-center rounded-xl bg-muted text-muted-foreground"
                >
                  <BookOpenIcon aria-hidden="true" />
                </div>
                <h3 class="mt-4 text-sm font-semibold">
                  {t("profileSelectEmptyTitle")}
                </h3>
                <p
                  class="mt-1 max-w-md text-sm leading-6 text-muted-foreground"
                >
                  {t("profileSelectEmptyDescription")}
                </p>
              </div>
            {/if}
          </div>
        </div>
      </section>
    </Card.Content>
  </Card.Root>
</DashboardTabPanel>

<Dialog.Root open={diagnoseDialogOpen} onOpenChange={setDiagnoseDialogOpen}>
  <Dialog.Content
    class="flex h-[min(90dvh,54rem)] max-h-[90dvh] w-[calc(100vw-2rem)] flex-col gap-0 overflow-hidden border-border bg-card p-0 shadow-2xl sm:max-w-5xl"
  >
    <Dialog.Header
      class="shrink-0 border-b border-border bg-muted/15 px-5 py-4 pr-14"
    >
      <div class="flex min-w-0 items-start gap-3 text-left">
        <span
          class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/15"
        >
          <StethoscopeIcon aria-hidden="true" />
        </span>
        <div class="min-w-0">
          <Dialog.Title>{t("profileDiagnoseTitle")}</Dialog.Title>
          <Dialog.Description
            >{t("profileDiagnoseDescription")}</Dialog.Description
          >
        </div>
      </div>
    </Dialog.Header>
    <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6">
      <ProfileDiagnosePanel embedded />
    </div>
  </Dialog.Content>
</Dialog.Root>
