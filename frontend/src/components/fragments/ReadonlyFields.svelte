<script lang="ts">
  import { getContext, setContext } from "svelte";
  import type { Snippet } from "svelte";
  import { readonlyFieldsContextKey } from "$lib/svelte.js";

  let {
    disabled = false,
    scopeOnly = false,
    class: cssClass = "min-w-0",
    children,
  }: {
    disabled?: boolean;
    scopeOnly?: boolean;
    class?: string;
    children: Snippet;
  } = $props();
  const parentReadonly = getContext<(() => boolean) | undefined>(
    readonlyFieldsContextKey,
  );
  let locked = $derived(disabled || !!parentReadonly?.());
  setContext(readonlyFieldsContextKey, () => locked);
</script>

{#if scopeOnly}
  <div class={cssClass}>{@render children()}</div>
{:else}
  <fieldset disabled={locked} class={cssClass}>
    {@render children()}
  </fieldset>
{/if}
