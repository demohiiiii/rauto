<script>
  import CollapsibleGroup from "../../components/fragments/CollapsibleGroup.svelte";
  import ReadonlyInputField from "../../components/fragments/ReadonlyInputField.svelte";

  let { profileDetail } = $props();
  let detailDisplay = $derived(profileDetail.detailDisplay);
</script>

{#snippet readonlyFieldCard(readonlyValue)}
  <div class="rounded-lg border border-border bg-muted/40 p-3">
    <ReadonlyInputField value={readonlyValue} />
  </div>
{/snippet}

{#snippet readonlySectionHeader(titleText)}
  <span class="min-w-0 break-words text-xs font-semibold sm:text-sm">
    {titleText}
  </span>
{/snippet}

{#each detailDisplay.simpleSections as profileDetailSection (profileDetailSection.listId)}
  <CollapsibleGroup
    variant="section"
    class="px-4 py-4"
    label={profileDetailSection.titleText}
    persistenceKey={profileDetailSection.listId}
    toggle-mode="icon"
    body-class="mt-3 grid gap-2"
  >
    {#snippet header()}
      <div class="flex min-w-0 flex-1 items-center gap-2">
        {@render readonlySectionHeader(profileDetailSection.titleText)}
        <span
          class="flex min-w-6 items-center justify-center rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
        >
          {profileDetailSection.values.length}
        </span>
      </div>
    {/snippet}

    {#each profileDetailSection.values as sectionValue}
      {@render readonlyFieldCard(sectionValue)}
    {/each}
    {#if profileDetailSection.values.length === 0}
      <div
        class="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground"
      >
        {detailDisplay.rulesEmpty}
      </div>
    {/if}
  </CollapsibleGroup>
{/each}
