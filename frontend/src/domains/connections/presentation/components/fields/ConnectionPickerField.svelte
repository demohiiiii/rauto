<script lang="ts">
  import { onDestroy, tick } from "svelte";
  import { Combobox } from "bits-ui";
  import ServerIcon from "@lucide/svelte/icons/server";
  import LayersIcon from "@lucide/svelte/icons/layers";
  import TagIcon from "@lucide/svelte/icons/tag";
  import TerminalIcon from "@lucide/svelte/icons/terminal";
  import SearchIcon from "@lucide/svelte/icons/search";
  import SearchXIcon from "@lucide/svelte/icons/search-x";
  import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
  import CheckIcon from "@lucide/svelte/icons/check";
  import XIcon from "@lucide/svelte/icons/x";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import ArrowDownUpIcon from "@lucide/svelte/icons/arrow-down-up";
  import CornerDownLeftIcon from "@lucide/svelte/icons/corner-down-left";
  import { createConnectionPickerFieldWorkspace } from "../../../application/connectionFieldState.js";
  import { connectionPickerState } from "../../../application/connectionFieldStoreState.js";
  import { currentLanguageState, t } from "$lib/i18n.js";

  interface ConnectionPickerFieldProps {
    active?: boolean;
    keyName: string;
    labelText: string;
    onSelectionChange?: (values: string[]) => void;
    pickerPlaceholder: string;
    selectedItemClass?: string;
    selectedRemoveButtonClass?: string;
  }

  let {
    active = true,
    keyName,
    labelText,
    onSelectionChange,
    pickerPlaceholder,
    selectedItemClass = "",
    selectedRemoveButtonClass = "",
  }: ConnectionPickerFieldProps = $props();
  const componentId = $props.id();
  const inputId = `${componentId}-input`;
  const hintId = `${inputId}-hint`;
  const menuId = `${inputId}-listbox`;
  const workspace = createConnectionPickerFieldWorkspace();
  const { pickerDisplayStateStore, commitKeysStateStore } = workspace;
  let pickerStateStore = $derived(connectionPickerState(keyName));
  let pickerDisplay = $derived($pickerDisplayStateStore);
  let selectedValues = $derived($pickerStateStore.values || []);
  let selectedSet = $derived(new Set(selectedValues));
  let shell: HTMLDivElement | undefined = $state();
  let input: HTMLInputElement | null = $state(null);
  let width = $state(0);
  let visibleValues = $derived(selectedValues.slice(0, width >= 440 ? 2 : 1));
  let extraCount = $derived(selectedValues.length - visibleValues.length);
  let EntityIcon = $derived(
    pickerDisplay.kind === "devices"
      ? ServerIcon
      : pickerDisplay.kind === "groups"
        ? LayersIcon
        : pickerDisplay.kind === "show-objects"
          ? TerminalIcon
          : TagIcon,
  );
  let labels = $derived.by(() => {
    $currentLanguageState;
    return {
      selected: t("connectionPickerSelected").replace(
        "{count}",
        String(selectedValues.length),
      ),
      clear: t("connectionPickerClear"),
      clearLabel: t("connectionPickerClearLabel").replace("{label}", labelText),
      more: t("connectionPickerMore").replace("{count}", String(extraCount)),
      browse: t("connectionPickerBrowse").replace("{label}", labelText),
      heading: t(
        pickerDisplay.normalizedQuery
          ? "connectionPickerResults"
          : "connectionPickerAvailable",
      ),
      hint: t(
        pickerDisplay.kind === "devices"
          ? "connectionPickerSearchDevices"
          : "connectionPickerSearch",
      ),
      emptyHint: t("connectionPickerEmptyHint"),
      move: t("connectionPickerMove"),
      select: t("connectionPickerSelect"),
      close: t("connectionPickerClose"),
    };
  });

  $effect(() => {
    workspace.setFieldContext({
      active,
      keyName,
      labelText,
      onSelectionChange,
      pickerPlaceholder,
      pickerState: $pickerStateStore,
    });
  });
  $effect(() => {
    if (!active && pickerDisplay.open) workspace.setOpen(false);
  });

  function openAndFocus() {
    workspace.openPicker();
    input?.focus();
  }

  function removeValue(value: string) {
    workspace.removePickerValueAction(value)();
    void tick().then(() => input?.focus());
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.isComposing) return;
    // Arrow keys, Enter, Escape and active-descendant tracking belong to Combobox.
    if (
      event.key === "Backspace" ||
      (event.key === "," && $commitKeysStateStore.includes(","))
    ) {
      workspace.handleKeydown(event);
    }
  }

  onDestroy(() => workspace.setOpen(false));
</script>

<div class="connection-picker grid min-w-0 gap-2">
  <div class="flex min-h-5 min-w-0 items-center justify-between gap-2">
    <label for={inputId} class="text-sm font-medium text-foreground"
      >{labelText}</label
    >
    {#if selectedValues.length}
      <div class="flex shrink-0 items-center gap-2.5 text-xs">
        <span class="font-medium tabular-nums text-primary" aria-live="polite"
          >{labels.selected}</span
        >
        <button
          type="button"
          class="picker-clear"
          aria-label={labels.clearLabel}
          disabled={!active}
          onclick={() => workspace.setSelectedValues([])}>{labels.clear}</button
        >
      </div>
    {/if}
  </div>

  <Combobox.Root
    type="multiple"
    value={selectedValues}
    onValueChange={workspace.setSelectedValues}
    open={pickerDisplay.open}
    onOpenChange={workspace.setOpen}
    inputValue={pickerDisplay.query}
    disabled={!active}
    loop
  >
    <div
      bind:this={shell}
      bind:clientWidth={width}
      class="picker-shell"
      class:picker-open={pickerDisplay.open}
      class:picker-filled={selectedValues.length > 0}
      class:picker-disabled={!active}
    >
      <span class="picker-leading" aria-hidden="true">
        {#if pickerDisplay.open}<SearchIcon class="size-4" />{:else}<EntityIcon
            class="size-4"
          />{/if}
      </span>
      <div class="picker-values">
        {#each visibleValues as value (value)}
          <span class={["picker-chip", selectedItemClass]} title={value}>
            <span class="truncate">{value}</span>
            <button
              type="button"
              class={["picker-chip-remove", selectedRemoveButtonClass]}
              disabled={!active}
              aria-label={`${pickerDisplay.removeItemLabel}: ${value}`}
              onclick={() => removeValue(value)}
            >
              <XIcon class="size-3" aria-hidden="true" />
            </button>
          </span>
        {/each}
        {#if extraCount > 0}
          <button
            type="button"
            class="picker-overflow"
            disabled={!active}
            aria-label={labels.more}
            title={selectedValues.slice(visibleValues.length).join(", ")}
            onclick={openAndFocus}>+{extraCount}</button
          >
        {/if}
        <Combobox.Input
          id={inputId}
          bind:ref={input}
          aria-label={pickerDisplay.pickerField.ariaLabelText}
          aria-describedby={pickerDisplay.open ? hintId : undefined}
          aria-controls={pickerDisplay.open ? menuId : undefined}
          placeholder={pickerDisplay.pickerField.placeholder}
          class="picker-input"
          autocomplete="off"
          spellcheck={false}
          onfocus={workspace.openPicker}
          onclick={workspace.openPicker}
          oninput={(event) =>
            workspace.handleQueryInput(event.currentTarget.value)}
          onkeydown={handleKeydown}
        />
      </div>
      <Combobox.Trigger
        class="picker-trigger"
        aria-label={labels.browse}
        title={labels.browse}
      >
        <ChevronDownIcon
          class={[
            "size-4 transition-transform duration-200 motion-reduce:transition-none",
            pickerDisplay.open && "rotate-180",
          ]}
          aria-hidden="true"
        />
      </Combobox.Trigger>
    </div>

    <Combobox.Portal>
      <Combobox.Content
        id={menuId}
        class="picker-menu"
        customAnchor={shell}
        sideOffset={8}
        align="start"
        collisionPadding={12}
        aria-label={labelText}
        preventScroll={false}
      >
        <div class="picker-menu-header" role="presentation">
          <div class="flex items-center justify-between gap-2">
            <span class="text-xs font-semibold text-foreground"
              >{labels.heading}</span
            >
            <span
              class="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground"
            >
              {pickerDisplay.optionRows.length +
                (pickerDisplay.canAddCustom ? 1 : 0)}
            </span>
          </div>
          <p
            id={hintId}
            class="mt-1 text-[11px] leading-relaxed text-muted-foreground"
          >
            {labels.hint}
          </p>
        </div>
        <Combobox.Viewport class="picker-viewport">
          {#if pickerDisplay.showNoMatch}
            <div class="picker-empty" role="status">
              <span
                class="mb-3 flex size-10 items-center justify-center rounded-xl border border-dashed border-border bg-muted/40"
              >
                <SearchXIcon class="size-5" aria-hidden="true" />
              </span>
              <span class="text-sm font-medium text-foreground"
                >{pickerDisplay.noMatchText}</span
              >
              <span class="mt-1 text-xs text-muted-foreground"
                >{labels.emptyHint}</span
              >
            </div>
          {:else}
            <div class:picker-grid={pickerDisplay.showObjectMenu}>
              {#if pickerDisplay.canAddCustom}
                <Combobox.Item
                  value={pickerDisplay.normalizedQuery}
                  label={pickerDisplay.normalizedQuery}
                  class="picker-option picker-create"
                >
                  <span class="picker-option-icon"
                    ><PlusIcon class="size-4" aria-hidden="true" /></span
                  >
                  <span class="min-w-0 flex-1"
                    ><span class="block text-xs text-muted-foreground"
                      >{pickerDisplay.addCustomLabel}</span
                    >
                    <span class="block truncate text-sm font-medium"
                      >{pickerDisplay.normalizedQuery}</span
                    ></span
                  >
                </Combobox.Item>
              {/if}
              {#each pickerDisplay.optionRows as row (row.value)}
                <Combobox.Item
                  value={row.value}
                  label={row.label || row.value}
                  class="picker-option"
                >
                  <span class="picker-option-icon"
                    ><EntityIcon class="size-4" aria-hidden="true" /></span
                  >
                  <span class="min-w-0 flex-1">
                    <span
                      class="block truncate text-sm font-medium"
                      title={row.label || row.value}
                      >{row.label || row.value}</span
                    >
                    {#if row.description}<span
                        class="mt-0.5 block truncate font-mono text-[11px] leading-relaxed text-muted-foreground"
                        title={row.description}>{row.description}</span
                      >{/if}
                  </span>
                  <span class="picker-check" aria-hidden="true"
                    >{#if selectedSet.has(row.value)}<CheckIcon
                        class="size-3"
                        strokeWidth={3}
                      />{/if}</span
                  >
                </Combobox.Item>
              {/each}
            </div>
          {/if}
        </Combobox.Viewport>
        <div class="picker-menu-footer" aria-hidden="true">
          <span><ArrowDownUpIcon class="size-3" />{labels.move}</span>
          <span><CornerDownLeftIcon class="size-3" />{labels.select}</span>
          <span class="ml-auto"><kbd>esc</kbd>{labels.close}</span>
        </div>
      </Combobox.Content>
    </Combobox.Portal>
  </Combobox.Root>
</div>

<style>
  .picker-shell {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-height: 3rem;
    padding: 0.4375rem 0.5rem;
    border: 1px solid var(--input);
    border-radius: 0.875rem;
    background: var(--background);
    box-shadow: 0 1px 2px color-mix(in oklab, var(--foreground) 3%, transparent);
    transition:
      border-color 160ms,
      box-shadow 160ms,
      background-color 160ms;
  }
  .picker-shell:hover {
    border-color: color-mix(in oklab, var(--primary) 35%, var(--input));
  }
  .picker-shell:focus-within,
  .picker-open {
    border-color: color-mix(in oklab, var(--primary) 65%, var(--input));
    box-shadow: 0 0 0 3px color-mix(in oklab, var(--primary) 10%, transparent);
  }
  .picker-disabled {
    opacity: 0.5;
  }
  .picker-leading {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 1.875rem;
    height: 1.875rem;
    border-radius: 0.625rem;
    color: var(--muted-foreground);
    background: color-mix(in oklab, var(--muted) 60%, transparent);
    transition:
      color 160ms,
      background-color 160ms;
  }
  .picker-filled .picker-leading,
  .picker-open .picker-leading {
    color: var(--primary);
    background: color-mix(in oklab, var(--primary) 8%, transparent);
  }
  .picker-values {
    display: flex;
    flex: 1;
    min-width: 0;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.375rem;
  }
  .picker-chip {
    display: inline-flex;
    max-width: min(12rem, 100%);
    min-width: 0;
    align-items: center;
    gap: 0.25rem;
    border: 1px solid color-mix(in oklab, var(--primary) 15%, var(--border));
    border-radius: 0.5rem;
    padding: 0.25rem 0.3rem 0.25rem 0.5rem;
    background: color-mix(in oklab, var(--primary) 6%, var(--background));
    color: var(--foreground);
    font-size: 0.75rem;
    line-height: 1.125rem;
    font-weight: 500;
    animation: picker-chip-in 140ms ease-out;
  }
  .picker-chip-remove {
    display: inline-flex;
    flex-shrink: 0;
    justify-content: center;
    align-items: center;
    width: 1.125rem;
    height: 1.125rem;
    border-radius: 0.25rem;
    color: var(--muted-foreground);
    transition:
      background-color 140ms,
      color 140ms;
  }
  .picker-chip-remove:hover {
    background: color-mix(in oklab, var(--primary) 12%, transparent);
    color: var(--primary);
  }
  .picker-overflow {
    padding: 0.25rem 0.375rem;
    border-radius: 0.375rem;
    font-size: 0.75rem;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    color: var(--primary);
    background: color-mix(in oklab, var(--primary) 8%, transparent);
  }
  .picker-overflow:hover {
    background: color-mix(in oklab, var(--primary) 15%, transparent);
  }
  .picker-clear {
    color: var(--muted-foreground);
    transition: color 140ms;
  }
  .picker-clear:hover {
    color: var(--foreground);
  }
  .picker-chip-remove:focus-visible,
  .picker-overflow:focus-visible,
  .picker-clear:focus-visible {
    outline: 2px solid var(--ring);
    outline-offset: 2px;
  }
  :global(.picker-input) {
    flex: 1 1 3rem;
    width: 3rem;
    min-width: 2rem;
    height: 1.875rem;
    background: transparent;
    border: 0;
    padding: 0;
    font-size: 0.875rem;
    color: var(--foreground);
    outline: none;
  }
  :global(.picker-input::placeholder) {
    color: var(--muted-foreground);
  }
  :global(.picker-trigger) {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.75rem;
    height: 1.75rem;
    flex-shrink: 0;
    border-radius: 0.5rem;
    color: var(--muted-foreground);
    transition:
      background-color 140ms,
      color 140ms;
  }
  :global(.picker-trigger:hover) {
    background: var(--muted);
    color: var(--foreground);
  }
  :global(.picker-trigger:focus-visible) {
    outline: 2px solid var(--ring);
    outline-offset: 2px;
  }
  :global(.picker-menu) {
    z-index: 100;
    width: var(--bits-combobox-anchor-width);
    max-width: calc(100vw - 1.5rem);
    max-height: min(26rem, var(--bits-combobox-content-available-height));
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border: 1px solid var(--border);
    border-radius: 1rem;
    background: var(--popover);
    color: var(--popover-foreground);
    box-shadow:
      0 16px 40px -8px color-mix(in oklab, var(--foreground) 14%, transparent),
      0 3px 8px -2px color-mix(in oklab, var(--foreground) 8%, transparent);
    transform-origin: var(--bits-combobox-content-transform-origin);
    animation: picker-menu-in 140ms ease-out;
    outline: none;
  }
  .picker-menu-header {
    flex-shrink: 0;
    padding: 0.75rem 0.875rem 0.625rem;
    border-bottom: 1px solid var(--border);
  }
  :global(.picker-viewport) {
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 0.375rem;
    scroll-padding-block: 0.375rem;
  }
  :global(.picker-option) {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    min-height: 2.75rem;
    margin-block: 0.125rem;
    padding: 0.5rem;
    border-radius: 0.625rem;
    border: 1px solid transparent;
    outline: none;
    cursor: pointer;
    user-select: none;
    transition:
      background-color 120ms,
      border-color 120ms;
  }
  :global(.picker-option[data-highlighted]) {
    background: var(--accent);
    border-color: color-mix(in oklab, var(--primary) 20%, var(--border));
  }
  :global(.picker-option[data-selected]) {
    background: color-mix(in oklab, var(--primary) 6%, var(--popover));
  }
  :global(.picker-option[data-selected][data-highlighted]) {
    background: color-mix(in oklab, var(--primary) 11%, var(--popover));
  }
  .picker-option-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.875rem;
    height: 1.875rem;
    flex-shrink: 0;
    border: 1px solid var(--border);
    border-radius: 0.5rem;
    color: var(--muted-foreground);
    background: var(--background);
  }
  .picker-check {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1rem;
    height: 1rem;
    flex-shrink: 0;
    border: 1px solid var(--input);
    border-radius: 0.3rem;
    color: transparent;
  }
  :global(.picker-option[data-selected]) .picker-check {
    border-color: var(--primary);
    background: var(--primary);
    color: var(--primary-foreground);
  }
  :global(.picker-option[data-selected]) .picker-option-icon {
    color: var(--primary);
    border-color: color-mix(in oklab, var(--primary) 20%, var(--border));
  }
  .picker-empty {
    display: flex;
    min-height: 10rem;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    color: var(--muted-foreground);
  }
  .picker-menu-footer {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    gap: 0.875rem;
    padding: 0.625rem 0.875rem;
    border-top: 1px solid var(--border);
    background: color-mix(in oklab, var(--muted) 40%, var(--popover));
    font-size: 0.625rem;
    color: var(--muted-foreground);
  }
  .picker-menu-footer span {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
  }
  .picker-menu-footer kbd {
    font-family: inherit;
    font-size: 0.625rem;
    line-height: 1;
  }
  .picker-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.25rem;
  }
  @keyframes picker-chip-in {
    from {
      opacity: 0;
      transform: scale(0.96);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }
  @keyframes picker-menu-in {
    from {
      opacity: 0;
      transform: translateY(-4px) scale(0.985);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }
  @media (max-width: 640px) {
    .picker-grid {
      grid-template-columns: minmax(0, 1fr);
    }
    .picker-menu-footer {
      display: none;
    }
    :global(.picker-option) {
      min-height: 3rem;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .picker-shell,
    .picker-leading,
    .picker-chip,
    .picker-chip-remove,
    .picker-clear,
    :global(.picker-trigger),
    :global(.picker-menu),
    :global(.picker-option) {
      animation: none;
      transition: none;
    }
  }
</style>
