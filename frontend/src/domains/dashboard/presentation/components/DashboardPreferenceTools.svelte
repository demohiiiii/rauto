<script lang="ts">
  import LanguagesIcon from "@lucide/svelte/icons/languages";
  import LogOutIcon from "@lucide/svelte/icons/log-out";
  import PaletteIcon from "@lucide/svelte/icons/palette";
  import { Button, buttonVariants } from "$lib/components/ui/button/index.js";
  import * as DropdownMenu from "$lib/components/ui/dropdown-menu/index.js";
  import * as Tooltip from "$lib/components/ui/tooltip/index.js";
  import { cn } from "$lib/utils.js";
  import { createDashboardPreferenceToolsWorkspace } from "$domains/dashboard/index.js";
  import type { DashboardThemeMode } from "$domains/dashboard/index.js";

  const dashboardPreferenceToolsWorkspace =
    createDashboardPreferenceToolsWorkspace();
  const {
    chooseLanguageAction,
    chooseThemeMode,
    langMenuOpenStateStore,
    logoutWebSession,
    preferenceDisplayStateStore,
  } = dashboardPreferenceToolsWorkspace;
  let themeMenuOpen = $state(false);
  let preferenceDisplay = $derived($preferenceDisplayStateStore);
  const chooseEnglishLanguage = chooseLanguageAction("en");
  const chooseChineseLanguage = chooseLanguageAction("zh");
  const preferenceToolGroupClass =
    "inline-flex min-h-10 items-center gap-0.5 rounded-2xl border border-border bg-card p-1 max-sm:border-0 max-sm:bg-transparent max-sm:p-0";
  const preferenceToolButtonClass =
    "min-h-8 justify-start gap-1.5 rounded-xl px-3 text-[0.82rem] font-semibold text-muted-foreground hover:bg-muted hover:text-foreground max-lg:size-8 max-lg:justify-center max-lg:px-0";
  const preferenceToolIconButtonClass =
    "size-8 shrink-0 rounded-xl p-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive";
  const preferenceToolMetaClass =
    "text-[0.7rem] font-bold text-muted-foreground max-lg:hidden";

  function closeThemeMenu() {
    themeMenuOpen = false;
  }

  function chooseThemeOption(
    actionFactory: (value: DashboardThemeMode) => () => void,
    value: DashboardThemeMode,
  ) {
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
          <span class="leading-none max-lg:sr-only">
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
          <span class="leading-none max-lg:sr-only">
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
        <DropdownMenu.Item
          class=""
          inset={false}
          onclick={chooseEnglishLanguage}
        >
          {preferenceDisplay.languageOptionEnglishLabel}
        </DropdownMenu.Item>
        <DropdownMenu.Item
          class=""
          inset={false}
          onclick={chooseChineseLanguage}
        >
          {preferenceDisplay.languageOptionChineseLabel}
        </DropdownMenu.Item>
      </DropdownMenu.Group>
    </DropdownMenu.Content>
  </DropdownMenu.Root>

  <Tooltip.Provider delayDuration={100} skipDelayDuration={0}>
    <Tooltip.Root>
      <Tooltip.Trigger>
        {#snippet child({ props })}
          <a
            {...props}
            data-slot="button"
            class={cn(
              buttonVariants({ variant: "ghost", size: "icon-sm" }),
              "size-8 shrink-0 rounded-xl p-0 text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
            href="https://github.com/demohiiiii/rauto"
            target="_blank"
            rel="noopener noreferrer"
            aria-label={preferenceDisplay.githubRepositoryLabel}
          >
            <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path
                d="M6.766 11.328c-2.063-.25-3.516-1.734-3.516-3.656 0-.781.281-1.625.75-2.188-.203-.515-.172-1.609.063-2.062.625-.078 1.468.25 1.968.703.594-.187 1.219-.281 1.985-.281.765 0 1.39.094 1.953.265.484-.437 1.344-.765 1.969-.687.218.422.25 1.515.046 2.047.5.593.766 1.39.766 2.203 0 1.922-1.453 3.375-3.547 3.64.531.344.89 1.094.89 1.954v1.625c0 .468.391.734.86.547C13.781 14.359 16 11.53 16 8.03 16 3.61 12.406 0 7.984 0 3.563 0 0 3.61 0 8.031a7.88 7.88 0 0 0 5.172 7.422c.422.156.828-.125.828-.547v-1.25c-.219.094-.5.156-.75.156-1.031 0-1.64-.562-2.078-1.609-.172-.422-.36-.672-.719-.719-.187-.015-.25-.093-.25-.187 0-.188.313-.328.625-.328.453 0 .844.281 1.25.86.313.452.64.655 1.031.655s.641-.14 1-.5c.266-.265.47-.5.657-.656"
              />
            </svg>
          </a>
        {/snippet}
      </Tooltip.Trigger>
      <Tooltip.Content side="bottom" sideOffset={8}>
        {preferenceDisplay.githubRepositoryLabel}
      </Tooltip.Content>
    </Tooltip.Root>
  </Tooltip.Provider>

  {#if preferenceDisplay.showWebLogout}
    <Button
      class={preferenceToolIconButtonClass}
      variant="ghost"
      size="icon-sm"
      type="button"
      aria-label={preferenceDisplay.logoutLabel}
      title={preferenceDisplay.logoutLabel}
      onclick={logoutWebSession}
    >
      <LogOutIcon aria-hidden="true" />
    </Button>
  {/if}
</div>
