<script>
  import CollapsibleGroup from "../../components/fragments/CollapsibleGroup.svelte";
  import ReadonlyCheckboxField from "../../components/fragments/ReadonlyCheckboxField.svelte";
  import ReadonlyInputField from "../../components/fragments/ReadonlyInputField.svelte";
  import ReadonlyTextAreaField from "../../components/fragments/ReadonlyTextAreaField.svelte";
  import { createBuiltinProfileHooksSectionWorkspace } from "../../modules/profiles.js";

  let { profileDetail } = $props();
  const hooksWorkspace = createBuiltinProfileHooksSectionWorkspace();
  let hooksDisplayStateStore = $derived(hooksWorkspace.hooksDisplayStateStore);
  let hooksDisplay = $derived($hooksDisplayStateStore);
</script>

{#snippet readonlyHookStep(hookStep)}
  <div class="grid gap-2 md:grid-cols-[80px_160px_1fr_120px]">
    <ReadonlyInputField value={hookStep.stepNumberText} />
    <ReadonlyInputField value={hookStep.mode} />
    <ReadonlyTextAreaField
      class="min-h-16 font-mono"
      value={hookStep.command}
    />
    <ReadonlyInputField value={hookStep.timeout} />
  </div>
{/snippet}

{#snippet readonlyHookCommand(operation)}
  <div class="grid gap-2 md:grid-cols-[160px_1fr_120px]">
    <ReadonlyInputField value={operation.mode} />
    <ReadonlyTextAreaField
      class="min-h-20 font-mono"
      value={operation.command}
    />
    <ReadonlyInputField value={operation.timeout} />
  </div>
{/snippet}

{#snippet hookReadonlyRow(hookRow)}
  <div class="grid gap-2 rounded-lg border border-border bg-muted/40 p-3">
    <div class="grid gap-2 md:grid-cols-4">
      <ReadonlyInputField value={hookRow.trigger} />
      <ReadonlyInputField value={hookRow.stateText} />
      <ReadonlyInputField value={hookRow.name} />
      <ReadonlyInputField value={hookRow.failurePolicy} />
    </div>
    <ReadonlyCheckboxField
      checked={hookRow.recordOutput}
      labelText={hooksDisplay.recordOutputLabel}
    />
    <ReadonlyInputField value={hookRow.kind} />
    {#if hookRow.showFlowSteps}
      <div class="grid gap-2">
        {#each hookRow.flowSteps as hookStep}
          {@render readonlyHookStep(hookStep)}
        {/each}
      </div>
    {:else}
      {@render readonlyHookCommand(hookRow.command)}
    {/if}
  </div>
{/snippet}

<CollapsibleGroup persistenceKey="builtin-hooks-list" body-class="grid gap-2">
  {#snippet header()}
    <span class="text-sm font-semibold text-slate-700">
      {hooksDisplay.title}
    </span>
  {/snippet}

  <div role="group" aria-label={hooksDisplay.ariaLabelText}>
    {#if !profileDetail.hasHookRows}
      <div
        class="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground"
      >
        -
      </div>
    {:else}
      {#each profileDetail.hookRows as hookRow}
        {@render hookReadonlyRow(hookRow)}
      {/each}
    {/if}
  </div>
</CollapsibleGroup>
