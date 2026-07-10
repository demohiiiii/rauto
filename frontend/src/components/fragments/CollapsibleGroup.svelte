<script>
  import * as Card from "$lib/components/ui/card";
  import { Button } from "$lib/components/ui/button/index.js";
  import { collapsibleGroupBindings } from "../../lib/events.js";
  import {
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
    persistenceKey,
  } = $props();

  let collapsed = $state(false);
  let mounted = $state(false);
  let collapsedPreferenceApplied = $state(false);
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

  $effect(() => {
    if (collapsedPreferenceApplied) return;
    collapsedPreferenceApplied = true;
    const initialState = bindings.initialState(persistenceKey);
    collapsed = initialState.collapsed;
    mounted = initialState.mounted;
  });
</script>

<Card.Root class={collapsibleDisplay.rootClass} {hidden}>
  <Card.Header class={collapsibleDisplay.headerClass}>
    {#if typeof header === "function"}
      {@render header()}
    {/if}
    <Button
      type="button"
      variant="outline"
      size="xs"
      aria-expanded={collapsibleDisplay.buttonAriaExpandedText}
      onclick={bindings.toggleHandler(collapsed, persistenceKey)}
    >
      {collapsibleDisplay.buttonLabelText}
    </Button>
  </Card.Header>
  <Card.Content
    class={collapsibleDisplay.bodyClass}
    hidden={collapsibleDisplay.bodyHidden}
  >
    {@render children()}
  </Card.Content>
</Card.Root>
