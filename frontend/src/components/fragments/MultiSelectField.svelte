<script>
  import { Badge } from "$lib/components/ui/badge";
  import { Button } from "$lib/components/ui/button";
  import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
  import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";

  let {
    disabled = false,
    labelText = "",
    maxSelected = 0,
    onValueChange,
    optionRows = [],
    placeholderText = "",
    value = [],
  } = $props();

  let selectedValues = $derived(
    Array.isArray(value) ? value.filter(Boolean) : [],
  );
  let normalizedOptions = $derived(
    (Array.isArray(optionRows) ? optionRows : [])
      .map((option) => ({
        label: String(option?.label ?? option?.value ?? ""),
        value: String(option?.value ?? ""),
      }))
      .filter((option) => option.value),
  );
  let selectedRows = $derived(
    selectedValues.map((selectedValue) => ({
      label:
        normalizedOptions.find((option) => option.value === selectedValue)
          ?.label || selectedValue,
      value: selectedValue,
    })),
  );
  let selectedSummary = $derived(
    selectedRows.map((selectedRow) => selectedRow.label).join(", "),
  );

  function updateSelection(nextValues = []) {
    const normalized = Array.from(new Set(nextValues.filter(Boolean)));
    if (maxSelected > 0 && normalized.length > maxSelected) return;
    onValueChange?.(normalized);
  }
</script>

<label class="grid min-w-0 gap-1.5">
  <span class="text-sm font-medium text-foreground">{labelText}</span>
  <DropdownMenu.Root>
    <DropdownMenu.Trigger>
      {#snippet child({ props })}
        <Button
          {...props}
          type="button"
          variant="outline"
          class="h-10 min-w-0 w-full justify-between px-2.5"
          {disabled}
          aria-label={labelText}
          title={selectedSummary || placeholderText}
        >
          <span
            class="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden"
          >
            {#if selectedRows.length}
              <span class="min-w-0 flex-1 truncate text-left">
                {selectedRows[0].label}
              </span>
              {#if selectedRows.length > 1}
                <Badge variant="secondary" class="shrink-0 rounded-md">
                  +{selectedRows.length - 1}
                </Badge>
              {/if}
            {:else}
              <span class="truncate text-muted-foreground">
                {placeholderText}
              </span>
            {/if}
          </span>
          <ChevronDownIcon aria-hidden="true" />
        </Button>
      {/snippet}
    </DropdownMenu.Trigger>
    <DropdownMenu.Content class="max-h-72 w-72" align="start">
      <DropdownMenu.CheckboxGroup
        value={selectedValues}
        onValueChange={updateSelection}
      >
        {#each normalizedOptions as option (option.value)}
          <DropdownMenu.CheckboxItem
            value={option.value}
            closeOnSelect={false}
            disabled={maxSelected > 0 &&
              selectedValues.length >= maxSelected &&
              !selectedValues.includes(option.value)}
          >
            <span class="min-w-0 truncate">{option.label}</span>
          </DropdownMenu.CheckboxItem>
        {/each}
      </DropdownMenu.CheckboxGroup>
    </DropdownMenu.Content>
  </DropdownMenu.Root>
</label>
