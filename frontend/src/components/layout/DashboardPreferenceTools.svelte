<script>
  import LanguagesIcon from "@lucide/svelte/icons/languages";
  import PaletteIcon from "@lucide/svelte/icons/palette";
  import { Button } from "$lib/components/ui/button";
  import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
  import { createDashboardPreferenceToolsWorkspace } from "../../modules/dashboard/dashboardShell.js";

  const dashboardPreferenceToolsWorkspace =
    createDashboardPreferenceToolsWorkspace();
  const {
    chooseLanguageAction,
    chooseThemeMode,
    langMenuOpenStateStore,
    preferenceDisplayStateStore,
  } = dashboardPreferenceToolsWorkspace;
  let themeMenuOpen = $state(false);
  let preferenceDisplay = $derived($preferenceDisplayStateStore);
  const chooseEnglishLanguage = chooseLanguageAction("en");
  const chooseChineseLanguage = chooseLanguageAction("zh");
  const preferenceToolGroupClass =
    "inline-flex min-h-10 items-center gap-0.5 rounded-2xl border border-border bg-card p-1";
  const preferenceToolButtonClass =
    "min-h-8 justify-start gap-1.5 rounded-xl px-3 text-[0.82rem] font-semibold text-muted-foreground hover:bg-muted hover:text-foreground";
  const preferenceToolMetaClass =
    "text-[0.7rem] font-bold text-muted-foreground max-lg:hidden";

  function closeThemeMenu() {
    themeMenuOpen = false;
  }

  function chooseThemeOption(actionFactory, value) {
    return () => {
      actionFactory(value)();
      closeThemeMenu();
    };
  }
</script>

<div class={preferenceToolGroupClass}>
  <DropdownMenu.Root bind:open={themeMenuOpen}>
    <DropdownMenu.Trigger>
      {#snippet child({ props })}
        <Button
          {...props}
          class={preferenceToolButtonClass}
          variant="ghost"
          size="sm"
          title={preferenceDisplay.themeToggleTitle}
          aria-label={preferenceDisplay.themeToggleTitle}
        >
          <PaletteIcon data-icon="inline-start" aria-hidden="true" />
          <span class="leading-none">
            {preferenceDisplay.themeToggleTitle}
          </span>
          <span class={preferenceToolMetaClass}>
            {preferenceDisplay.themePreferenceLabel}
          </span>
        </Button>
      {/snippet}
    </DropdownMenu.Trigger>
    <DropdownMenu.Content class="w-56" align="end">
      <DropdownMenu.Group>
        <DropdownMenu.Label>
          {preferenceDisplay.themeModeLabel}
        </DropdownMenu.Label>
        <DropdownMenu.RadioGroup value={preferenceDisplay.themeSettings.mode}>
          {#each preferenceDisplay.themeModeRows as row (row.value)}
            <DropdownMenu.RadioItem
              value={row.value}
              onclick={chooseThemeOption(chooseThemeMode, row.value)}
            >
              {row.label}
            </DropdownMenu.RadioItem>
          {/each}
        </DropdownMenu.RadioGroup>
      </DropdownMenu.Group>
    </DropdownMenu.Content>
  </DropdownMenu.Root>

  <DropdownMenu.Root bind:open={$langMenuOpenStateStore}>
    <DropdownMenu.Trigger>
      {#snippet child({ props })}
        <Button
          {...props}
          class={preferenceToolButtonClass}
          variant="ghost"
          size="sm"
          aria-label={preferenceDisplay.languageMenuLabel}
          title={preferenceDisplay.languageMenuLabel}
        >
          <LanguagesIcon data-icon="inline-start" aria-hidden="true" />
          <span class="leading-none">
            {preferenceDisplay.languageMenuLabel}
          </span>
          <span class={preferenceToolMetaClass}>
            {preferenceDisplay.languageShortLabel}
          </span>
        </Button>
      {/snippet}
    </DropdownMenu.Trigger>
    <DropdownMenu.Content class="w-40" align="end">
      <DropdownMenu.Group>
        <DropdownMenu.Item onclick={chooseEnglishLanguage}>
          {preferenceDisplay.languageOptionEnglishLabel}
        </DropdownMenu.Item>
        <DropdownMenu.Item onclick={chooseChineseLanguage}>
          {preferenceDisplay.languageOptionChineseLabel}
        </DropdownMenu.Item>
      </DropdownMenu.Group>
    </DropdownMenu.Content>
  </DropdownMenu.Root>
</div>
