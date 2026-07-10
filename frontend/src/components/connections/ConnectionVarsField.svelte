<script>
  import { Button } from "$lib/components/ui/button/index.js";
  import PlainInputField from "../fragments/PlainInputField.svelte";
  import StringSelectField from "../fragments/StringSelectField.svelte";
  import TypeValueSelectField from "../fragments/TypeValueSelectField.svelte";
  import {
    connectionVarsState,
    createConnectionVarsFieldWorkspace,
  } from "../../modules/connectionFields.js";

  let { active, keyName, labelTextKey, onVarsChange } = $props();
  const connectionVarsFieldWorkspace = createConnectionVarsFieldWorkspace();
  const {
    addVarRowAction,
    connectionVarNameHandler,
    connectionVarTypeHandler,
    connectionVarValueHandler,
    removeVarRowHandler,
    setFieldContext,
    varsDisplayStateStore,
  } = connectionVarsFieldWorkspace;
  let varsStateStore = $derived(connectionVarsState(keyName));
  let varsState = $derived($varsStateStore);
  let varsDisplay = $derived($varsDisplayStateStore);

  $effect(() => {
    setFieldContext({ active, keyName, labelTextKey, onVarsChange, varsState });
  });
</script>

<div class="grid min-w-0 gap-1.5">
  <div class="connection-vars-head">
    <span
      class="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
    >
      {varsDisplay.labelText}
    </span>
    <Button variant="outline" size="sm" type="button" onclick={addVarRowAction}>
      {varsDisplay.addButtonText}
    </Button>
  </div>
  <div class="connection-vars-form">
    {#if varsDisplay.hasConnectionVarRows}
      {#each varsDisplay.connectionVarRows as connectionVarRow}
        <div class="connection-vars-row">
          <PlainInputField
            value={connectionVarRow.name}
            aria-label={varsDisplay.namePlaceholder}
            placeholderText={varsDisplay.namePlaceholder}
            onInput={connectionVarNameHandler(connectionVarRow)}
          />
          <TypeValueSelectField
            title={varsDisplay.typeLabel}
            aria-label={varsDisplay.typeLabel}
            value={connectionVarRow.type}
            optionRows={varsDisplay.typeOptionRows}
            onChange={connectionVarTypeHandler(connectionVarRow)}
          />
          {#if connectionVarRow.showBooleanSelect}
            <StringSelectField
              title={varsDisplay.valuePlaceholder}
              aria-label={varsDisplay.valuePlaceholder}
              value={connectionVarRow.valueInputValue}
              optionValues={varsDisplay.booleanValueOptions}
              onChange={connectionVarValueHandler(connectionVarRow)}
            />
          {:else}
            <PlainInputField
              value={connectionVarRow.value}
              disabled={connectionVarRow.disableValueInput}
              aria-label={varsDisplay.valuePlaceholder}
              placeholderText={varsDisplay.valuePlaceholder}
              onInput={connectionVarValueHandler(connectionVarRow)}
            />
          {/if}
          <Button
            type="button"
            variant="destructive"
            size="sm"
            title={varsDisplay.deleteLabel}
            aria-label={varsDisplay.deleteLabel}
            onclick={removeVarRowHandler(connectionVarRow)}
          >
            x
          </Button>
        </div>
      {/each}
    {:else}
      <div class="connection-vars-empty">
        {varsDisplay.emptyText}
      </div>
    {/if}
  </div>
</div>

<style>
  .connection-vars-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.65rem;
  }

  .connection-vars-form {
    display: grid;
    gap: 0.5rem;
  }

  .connection-vars-empty {
    min-height: 2.45rem;
    display: flex;
    align-items: center;
    padding: 0.55rem 0.7rem;
    border: 1px dashed color-mix(in oklab, var(--foreground) 16%, transparent);
    border-radius: 0.85rem;
    background: color-mix(in oklab, var(--card) 88%, var(--muted));
    color: color-mix(in oklab, var(--foreground) 48%, transparent);
    font-size: 0.8rem;
  }

  .connection-vars-row {
    display: grid;
    gap: 0.45rem;
    align-items: center;
    grid-template-columns: minmax(0, 1fr);
    padding: 0.45rem;
    border: 1px solid color-mix(in oklab, var(--foreground) 10%, transparent);
    border-radius: 0.85rem;
    background: color-mix(in oklab, var(--card) 94%, transparent);
  }

  @media (min-width: 48rem) {
    .connection-vars-row {
      grid-template-columns: minmax(8rem, 0.75fr) 7.5rem minmax(10rem, 1fr) auto;
    }
  }
</style>
