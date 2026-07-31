<script>
  import { Badge } from "$lib/components/ui/badge/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import * as DropdownMenu from "$lib/components/ui/dropdown-menu/index.js";
  import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
  import { classNames } from "../../lib/ui.js";
  import {
    profileModeExpressionFromSelection,
    profileModeExpressionOptions,
    profileModeExpressionSelectedOptions,
    profileModeExpressionSuggestions,
    profileModeExpressionUnmatchedCandidates,
  } from "../../modules/profiles/profileModeExpressions.js";
  import PlainInputField from "./PlainInputField.svelte";

  let {
    value = "",
    optionValues = [],
    placeholderText = "",
    "aria-label": ariaLabel = "",
    title = "",
    disabled = false,
    hidden = false,
    class: inputClass = "",
    onChange,
    onInput,
    onValueChange,
    onValueInput,
  } = $props();

  const listId = `mode-expression-${Math.random().toString(36).slice(2)}`;
  let modeOptions = $derived(profileModeExpressionOptions(optionValues));
  let selectedOptions = $derived(
    profileModeExpressionSelectedOptions(value, modeOptions),
  );
  let unmatchedCandidates = $derived(
    profileModeExpressionUnmatchedCandidates(value, modeOptions),
  );
  let suggestions = $derived(
    profileModeExpressionSuggestions(modeOptions, value),
  );
  let selectedTags = $derived([...selectedOptions, ...unmatchedCandidates]);
  let rootClassName = $derived(classNames("grid min-w-0 gap-2", inputClass));
  let inputClassName = $derived(
    classNames(modeOptions.length ? "h-8 text-xs" : "", inputClass),
  );
  let triggerTitle = $derived(ariaLabel || title || placeholderText);

  function inputEvent(nextValue = "") {
    return {
      currentTarget: { value: nextValue },
      target: { value: nextValue },
    };
  }

  function emitValue(nextValue = "") {
    onValueInput?.(nextValue);
    onValueChange?.(nextValue);
    onInput?.(inputEvent(nextValue));
    onChange?.(inputEvent(nextValue));
  }

  function updateSelectedOptions(nextSelectedValues = []) {
    emitValue(
      profileModeExpressionFromSelection(
        nextSelectedValues,
        value,
        modeOptions,
      ),
    );
  }

  function handleValueInput(nextValue = "") {
    emitValue(nextValue);
  }
</script>

<div class={rootClassName} {hidden}>
  {#if modeOptions.length}
    <DropdownMenu.Root>
      <DropdownMenu.Trigger>
        {#snippet child({ props })}
          <Button
            {...props}
            type="button"
            variant="outline"
            data-mode-expression-trigger
            class="min-h-9 w-full justify-between px-2 py-1.5"
            {disabled}
            aria-label={triggerTitle}
            title={triggerTitle}
          >
            <span class="flex min-w-0 flex-1 flex-wrap items-center gap-1">
              {#if selectedTags.length}
                {#each selectedTags as selectedTag (selectedTag)}
                  <Badge
                    variant="secondary"
                    class="max-w-full rounded-md font-mono"
                  >
                    {selectedTag}
                  </Badge>
                {/each}
              {:else}
                <span class="truncate text-muted-foreground">
                  {placeholderText || triggerTitle}
                </span>
              {/if}
            </span>
            <ChevronDownIcon aria-hidden="true" />
          </Button>
        {/snippet}
      </DropdownMenu.Trigger>
      <DropdownMenu.Content class="max-h-72 w-64" align="start">
        <DropdownMenu.CheckboxGroup
          value={selectedOptions}
          onValueChange={updateSelectedOptions}
        >
          {#each modeOptions as modeOption (modeOption)}
            <DropdownMenu.CheckboxItem
              data-mode-expression-option={modeOption}
              value={modeOption}
              closeOnSelect={false}
            >
              <span class="font-mono">{modeOption}</span>
            </DropdownMenu.CheckboxItem>
          {/each}
        </DropdownMenu.CheckboxGroup>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  {/if}

  {#if !modeOptions.length || unmatchedCandidates.length}
    <PlainInputField
      class={inputClassName}
      aria-label={ariaLabel || title || placeholderText}
      {title}
      {value}
      {placeholderText}
      autocomplete="off"
      list={suggestions.length ? listId : undefined}
      {disabled}
      onValueInput={handleValueInput}
    />
  {/if}
</div>

{#if suggestions.length}
  <datalist id={listId}>
    {#each suggestions as suggestion (suggestion)}
      <option value={suggestion}></option>
    {/each}
  </datalist>
{/if}
