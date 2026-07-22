<script>
  import * as Card from "$lib/components/ui/card";
  import { Button } from "$lib/components/ui/button/index.js";
  import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
  import { collapsibleGroupBindings } from "../../lib/events.js";
  import { t } from "../../lib/i18n.js";
  import {
    classNames,
    collapsibleGroupDisplay,
    readCollapsedPreference,
    writeCollapsedPreference,
  } from "../../lib/ui.js";

  let {
    "body-class": bodyClass,
    children,
    class: rootClass,
    header,
    "header-class": headerClass,
    hidden,
    label = "",
    persistenceKey,
    "toggle-mode": toggleMode = "text",
    variant = "card",
  } = $props();

  let collapsed = $state(false);
  let mounted = $state(false);
  let appliedPersistenceKey = $state(null);
  let bindings = $derived(
    collapsibleGroupBindings({
      onReadCollapsedPreference: readCollapsedPreference,
      onSetCollapsed: (nextCollapsed) => {
        collapsed = nextCollapsed;
      },
      onWriteCollapsedPreference: writeCollapsedPreference,
    }),
  );

  let collapsibleDisplay = $derived(
    collapsibleGroupDisplay({
      bodyClass,
      collapsed,
      headerClass,
      mounted,
      rootClass,
    }),
  );
  let bodyId = $derived(collapsibleBodyId(persistenceKey));
  let resolvedLabel = $derived(
    String(label || "").trim() || t("txBlockFormAdvancedFields"),
  );
  let buttonAriaLabel = $derived(
    `${resolvedLabel}: ${collapsibleDisplay.buttonLabelText}`,
  );

  function collapsibleBodyId(value = "") {
    const encodedKey = Array.from(String(value || "section"))
      .map((character) =>
        /[A-Za-z0-9_-]/.test(character)
          ? character
          : `_${character.codePointAt(0).toString(16)}_`,
      )
      .join("");
    return `collapsible-body-${encodedKey || "section"}`;
  }

  $effect(() => {
    const nextPersistenceKey = String(persistenceKey || "");
    if (appliedPersistenceKey === nextPersistenceKey) return;
    const initialState = bindings.initialState(nextPersistenceKey);
    appliedPersistenceKey = nextPersistenceKey;
    collapsed = initialState.collapsed;
    mounted = initialState.mounted;
  });
</script>

{#if variant === "section"}
  <section
    class={classNames(
      "border-b border-border pb-4 last:border-0",
      collapsibleDisplay.rootClass,
    )}
    {hidden}
  >
    <header class={collapsibleDisplay.headerClass}>
      {#if typeof header === "function"}
        {@render header()}
      {/if}
      <Button
        class={toggleMode === "icon" ? "size-10 sm:size-8" : undefined}
        type="button"
        variant="ghost"
        size={toggleMode === "icon" ? "icon-sm" : "xs"}
        title={toggleMode === "icon"
          ? collapsibleDisplay.buttonLabelText
          : undefined}
        aria-expanded={collapsibleDisplay.buttonAriaExpandedText}
        aria-controls={bodyId}
        aria-label={buttonAriaLabel}
        onclick={bindings.toggleHandler(collapsed, persistenceKey)}
      >
        {#if toggleMode === "icon"}
          <ChevronDownIcon
            class={collapsed
              ? "size-4 -rotate-90 transition-transform duration-200"
              : "size-4 transition-transform duration-200"}
            aria-hidden="true"
          />
        {:else}
          {collapsibleDisplay.buttonLabelText}
        {/if}
      </Button>
    </header>
    <div
      id={bodyId}
      class={collapsibleDisplay.bodyClass}
      hidden={collapsibleDisplay.bodyHidden}
    >
      {@render children()}
    </div>
  </section>
{:else}
  <Card.Root class={collapsibleDisplay.rootClass} {hidden}>
    <Card.Header class={collapsibleDisplay.headerClass}>
      {#if typeof header === "function"}
        {@render header()}
      {/if}
      <Button
        class={toggleMode === "icon" ? "size-10 sm:size-8" : undefined}
        type="button"
        variant={toggleMode === "icon" ? "ghost" : "outline"}
        size={toggleMode === "icon" ? "icon-sm" : "xs"}
        title={toggleMode === "icon"
          ? collapsibleDisplay.buttonLabelText
          : undefined}
        aria-expanded={collapsibleDisplay.buttonAriaExpandedText}
        aria-controls={bodyId}
        aria-label={buttonAriaLabel}
        onclick={bindings.toggleHandler(collapsed, persistenceKey)}
      >
        {#if toggleMode === "icon"}
          <ChevronDownIcon
            class={collapsed
              ? "size-4 -rotate-90 transition-transform duration-200"
              : "size-4 transition-transform duration-200"}
            aria-hidden="true"
          />
        {:else}
          {collapsibleDisplay.buttonLabelText}
        {/if}
      </Button>
    </Card.Header>
    <Card.Content
      id={bodyId}
      class={collapsibleDisplay.bodyClass}
      hidden={collapsibleDisplay.bodyHidden}
    >
      {@render children()}
    </Card.Content>
  </Card.Root>
{/if}
