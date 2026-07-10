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
  <span class="text-sm font-semibold text-slate-700">
    {titleText}
  </span>
{/snippet}

{#each detailDisplay.simpleSections as profileDetailSection (profileDetailSection.listId)}
  <CollapsibleGroup
    persistenceKey={profileDetailSection.listId}
    body-class="grid gap-2"
  >
    {#snippet header()}
      {@render readonlySectionHeader(profileDetailSection.titleText)}
    {/snippet}

    {#each profileDetailSection.values as sectionValue}
      {@render readonlyFieldCard(sectionValue)}
    {/each}
  </CollapsibleGroup>
{/each}
