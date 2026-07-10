<script>
  import PlainInputField from "../fragments/PlainInputField.svelte";
  import {
    createConnectionPickerFieldWorkspace,
    connectionPickerState,
  } from "../../modules/connectionFields.js";

  let {
    active = true,
    keyName,
    labelText,
    onSelectionChange,
    pickerPlaceholder,
    selectedItemClass = "border-border bg-muted text-muted-foreground",
    selectedRemoveButtonClass = "text-muted-foreground transition hover:bg-accent hover:text-accent-foreground",
  } = $props();
  const connectionPickerFieldWorkspace = createConnectionPickerFieldWorkspace();
  const {
    addPickerValueAction,
    handleFocusOut,
    handleKeydown,
    handleQueryInput,
    openPicker,
    pickerDisplayStateStore,
    removePickerValueAction,
    setFieldContext,
  } = connectionPickerFieldWorkspace;
  let pickerStateStore = $derived(connectionPickerState(keyName));
  let pickerState = $derived($pickerStateStore);
  let pickerDisplay = $derived($pickerDisplayStateStore);

  $effect(() => {
    setFieldContext({
      active,
      keyName,
      labelText,
      onSelectionChange,
      pickerPlaceholder,
      pickerState,
    });
  });
</script>

<div class="grid min-w-0 gap-1.5">
  <span
    class="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
    >{labelText}</span
  >
  <div class="relative w-full" onfocusout={handleFocusOut}>
    <div
      class="flex min-h-10 flex-wrap items-center gap-2 rounded-xl border border-border bg-card px-3 py-1.5 transition focus-within:border-primary/40 focus-within:ring-[3px] focus-within:ring-ring/20"
    >
      <div class="flex flex-wrap items-center gap-2">
        {#each pickerDisplay.selectedRows as selectedConnectionRow}
          <span
            class={[
              "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium",
              selectedItemClass,
            ]}
          >
            <span>{selectedConnectionRow.selectedValue}</span>
            <button
              type="button"
              class={[
                "inline-flex size-4 items-center justify-center rounded-full",
                selectedRemoveButtonClass,
              ]}
              aria-label={pickerDisplay.removeItemLabel}
              title={pickerDisplay.removeItemLabel}
              onclick={removePickerValueAction(
                selectedConnectionRow.selectedValue,
              )}
            >
              x
            </button>
          </span>
        {/each}
      </div>
      <PlainInputField
        class="h-8 min-w-32 flex-1 border-0 bg-transparent px-0 py-1 text-sm text-foreground shadow-none outline-none placeholder:text-muted-foreground focus-visible:ring-0"
        aria-label={pickerDisplay.pickerField.ariaLabelText}
        placeholderText={pickerDisplay.pickerField.placeholder}
        value={pickerDisplay.query}
        onFocus={openPicker}
        onValueInput={handleQueryInput}
        onKeydown={handleKeydown}
      />
    </div>
    <div
      aria-label={labelText}
      hidden={!pickerDisplay.open}
      class:connection-show-object-menu={pickerDisplay.showObjectMenu}
      class="bg-popover text-popover-foreground absolute left-0 top-full z-50 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-border p-2 shadow-lg"
    >
      {#if pickerDisplay.showNoMatch}
        <li>
          <span class="px-3 py-2 text-xs text-muted-foreground">
            {pickerDisplay.noMatchText}
          </span>
        </li>
      {:else}
        {#if pickerDisplay.canAddCustom}
          <li>
            <button
              type="button"
              class="justify-between"
              onclick={addPickerValueAction(pickerDisplay.normalizedQuery)}
            >
              <span>{pickerDisplay.addCustomLabel}</span>
              <span class="font-medium">{pickerDisplay.normalizedQuery}</span>
            </button>
          </li>
        {/if}
        {#each pickerDisplay.optionRows as optionRow}
          <li>
            <button
              type="button"
              class:connection-show-object-option={optionRow.isShowObject}
              onclick={addPickerValueAction(optionRow.value)}
            >
              {#if optionRow.isShowObject}
                <span class="connection-show-object-option-head">
                  <span class="connection-show-object-name">
                    {optionRow.nameText}
                  </span>
                  <span class="connection-show-object-add">+</span>
                </span>
              {:else}
                <span>{optionRow.label}</span>
              {/if}
            </button>
          </li>
        {/each}
      {/if}
    </div>
  </div>
</div>

<style>
  .connection-show-object-menu {
    display: grid !important;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    align-items: start;
    gap: 0.35rem;
    width: 100%;
    min-width: 0;
    max-width: 100%;
    max-height: 18rem !important;
    overflow-x: hidden !important;
    overflow-y: auto !important;
    overscroll-behavior: contain;
    padding: 0.45rem;
    border-radius: 1rem;
    box-shadow:
      0 18px 44px color-mix(in oklab, var(--foreground) 14%, transparent),
      inset 0 1px 0 color-mix(in oklab, white 18%, transparent);
  }

  .connection-show-object-menu :global(li) {
    display: block !important;
    margin: 0;
    min-width: 0;
    width: 100%;
  }

  .connection-show-object-option {
    display: grid !important;
    box-sizing: border-box;
    min-width: 0;
    max-width: 100%;
    width: 100%;
    gap: 0.38rem;
    padding: 0.68rem 0.78rem;
    border: 1px solid color-mix(in oklab, var(--foreground) 8%, transparent);
    border-radius: 0.85rem;
    background: linear-gradient(
      180deg,
      color-mix(in oklab, var(--card) 96%, white 4%),
      color-mix(in oklab, var(--card) 92%, var(--primary) 3%)
    );
    color: var(--foreground);
    text-align: left;
    transition:
      border-color 0.16s ease,
      background-color 0.16s ease,
      box-shadow 0.16s ease,
      transform 0.12s ease;
  }

  .connection-show-object-option:hover,
  .connection-show-object-option:focus-visible {
    border-color: color-mix(in oklab, var(--primary) 36%, transparent);
    background: linear-gradient(
      180deg,
      color-mix(in oklab, var(--primary) 10%, var(--card)),
      color-mix(in oklab, var(--primary) 5%, var(--card))
    );
    box-shadow: 0 10px 24px color-mix(in oklab, var(--primary) 16%, transparent);
    transform: translateY(-1px);
  }

  .connection-show-object-option-head {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: flex-start;
    gap: 0.75rem;
    min-width: 0;
    max-width: 100%;
  }

  .connection-show-object-name {
    display: block;
    min-width: 0;
    max-width: 100%;
    color: color-mix(in oklab, var(--foreground) 90%, transparent);
    font-size: 0.88rem;
    font-weight: 760;
    line-height: 1.2;
    overflow-wrap: anywhere;
  }

  .connection-show-object-add {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: none;
    width: 1.45rem;
    height: 1.45rem;
    border: 1px solid color-mix(in oklab, var(--primary) 24%, transparent);
    border-radius: 999px;
    background: color-mix(in oklab, var(--primary) 9%, transparent);
    color: color-mix(in oklab, var(--primary) 68%, var(--foreground));
    font-size: 0.88rem;
    font-weight: 800;
    line-height: 1;
  }

  @media (max-width: 768px) {
    .connection-show-object-menu {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
