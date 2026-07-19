<script>
  import MiniActionButton from "../../components/fragments/MiniActionButton.svelte";
  import PlainCheckboxField from "../../components/fragments/PlainCheckboxField.svelte";
  import PlainInputField from "../../components/fragments/PlainInputField.svelte";
  import { createProfileListRowEditorWorkspace } from "../../modules/profiles/profiles.js";
  let {
    kind,
    onAddPattern,
    onPatternChange,
    onPatternStateChange,
    onProfileListRowChange,
    onRemovePattern,
    onRemoveRow,
    onRemoveSimpleValue,
    onSimpleValueChange,
    profileListRow,
    rowIndex,
  } = $props();
  function handleAddPattern(currentRowIndex) {
    if (typeof onAddPattern === "function") {
      return onAddPattern(currentRowIndex);
    }
    return undefined;
  }

  function handlePatternChange(currentRowIndex, patternIndex, patternValue) {
    if (typeof onPatternChange === "function") {
      return onPatternChange(currentRowIndex, patternIndex, patternValue);
    }
    return undefined;
  }

  function handlePatternStateChange(currentRowIndex, patternState) {
    if (typeof onPatternStateChange === "function") {
      return onPatternStateChange(currentRowIndex, patternState);
    }
    return undefined;
  }

  function handleProfileListRowChange(currentRowIndex, patch) {
    if (typeof onProfileListRowChange === "function") {
      return onProfileListRowChange(currentRowIndex, patch);
    }
    return undefined;
  }

  function handleRemovePattern(currentRowIndex, patternIndex) {
    if (typeof onRemovePattern === "function") {
      return onRemovePattern(currentRowIndex, patternIndex);
    }
    return undefined;
  }

  function handleRemoveRow(currentRowIndex) {
    if (typeof onRemoveRow === "function") {
      return onRemoveRow(currentRowIndex);
    }
    return undefined;
  }

  function handleRemoveSimpleValue(currentRowIndex) {
    if (typeof onRemoveSimpleValue === "function") {
      return onRemoveSimpleValue(currentRowIndex);
    }
    return undefined;
  }

  function handleSimpleValueChange(currentRowIndex, simpleValue) {
    if (typeof onSimpleValueChange === "function") {
      return onSimpleValueChange(currentRowIndex, simpleValue);
    }
    return undefined;
  }

  const profileListRowWorkspace = createProfileListRowEditorWorkspace({
    onAddPattern: handleAddPattern,
    onPatternChange: handlePatternChange,
    onPatternStateChange: handlePatternStateChange,
    onProfileListRowChange: handleProfileListRowChange,
    onRemovePattern: handleRemovePattern,
    onRemoveRow: handleRemoveRow,
    onRemoveSimpleValue: handleRemoveSimpleValue,
    onSimpleValueChange: handleSimpleValueChange,
  });
  const {
    addPatternHandler,
    editorDisplayStateStore,
    interactionDynamicChangeHandler,
    interactionInputChangeHandler,
    interactionRecordInputChangeHandler,
    patternChangeHandler,
    patternStateChangeHandler,
    removePatternHandler,
    removeRowHandler,
    removeSimpleValueHandler,
    simpleValueChangeHandler,
    sysPromptNameGroupChangeHandler,
    sysPromptPatternChangeHandler,
    sysPromptStateChangeHandler,
    transitionCommandChangeHandler,
    transitionExitChangeHandler,
    transitionFormatSysChangeHandler,
    transitionFromChangeHandler,
    transitionToChangeHandler,
    setRowContext,
  } = profileListRowWorkspace;
  let derivedEditorDisplayStateStore = $derived(editorDisplayStateStore);
  let editorDisplay = $derived($derivedEditorDisplayStateStore);
  let sysPromptDisplay = $derived(editorDisplay.sysPromptDisplay);
  let promptPatternDisplay = $derived(editorDisplay.promptPatternDisplay);
  let promptPatternEditorDisplay = $derived(
    editorDisplay.promptPatternEditorDisplay,
  );
  let interactionEditorDisplay = $derived(
    editorDisplay.interactionEditorDisplay,
  );
  let interactionDisplay = $derived(
    interactionEditorDisplay.interactionDisplay,
  );
  let patternListDisplay = $derived(editorDisplay.patternListDisplay);
  let transitionEditorDisplay = $derived(editorDisplay.transitionEditorDisplay);
  let transitionDisplay = $derived(transitionEditorDisplay.transitionDisplay);

  $effect(() => {
    setRowContext({
      kind,
      profileListRow,
      rowIndex,
    });
  });
</script>

{#snippet patternList(patternRows)}
  <div class="grid gap-2">
    {#each patternRows as patternRow}
      <div class="rounded-lg border border-border bg-muted/40 p-3">
        <div class="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2.5">
          <PlainInputField
            value={patternRow.pattern}
            placeholderText=""
            onValueInput={patternChangeHandler(patternRow.patternIndex)}
          />
          <MiniActionButton
            labelText={patternListDisplay.deleteButtonLabel}
            variant="delete"
            onClick={removePatternHandler(patternRow.patternIndex)}
          />
        </div>
      </div>
    {/each}
  </div>
{/snippet}

{#snippet deleteStructuredRowButton()}
  <div class="flex items-start justify-end">
    <MiniActionButton
      labelText={editorDisplay.deleteButtonLabel}
      variant="delete"
      onClick={removeRowHandler()}
    />
  </div>
{/snippet}

{#if editorDisplay.showSimpleEditor}
  <div class="rounded-lg border border-border bg-muted/40 p-3">
    <div class="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2.5">
      <PlainInputField
        value={profileListRow}
        placeholderText=""
        onValueInput={simpleValueChangeHandler()}
      />
      <MiniActionButton
        labelText={editorDisplay.deleteButtonLabel}
        variant="delete"
        onClick={removeSimpleValueHandler()}
      />
    </div>
  </div>
{:else if editorDisplay.showPromptsEditor}
  <div class="grid gap-2 rounded-lg border border-border bg-muted/40 p-3">
    <div class="grid gap-2 md:grid-cols-[180px_1fr_auto]">
      <PlainInputField
        value={promptPatternDisplay.state}
        placeholderText={promptPatternEditorDisplay.statePlaceholder}
        onValueInput={patternStateChangeHandler()}
      />
      {@render patternList(promptPatternDisplay.patternRows)}
      {@render deleteStructuredRowButton()}
    </div>
    <div class="inline-flex items-center gap-2">
      <MiniActionButton
        labelText={promptPatternEditorDisplay.addPatternButtonLabel}
        variant="add"
        onClick={addPatternHandler()}
      />
    </div>
  </div>
{:else if editorDisplay.showSysPromptsEditor}
  <div
    class="grid gap-2 rounded-lg border border-border bg-muted/40 p-3 md:grid-cols-[1fr_1fr_1.2fr_auto]"
  >
    <PlainInputField
      value={sysPromptDisplay.state}
      placeholderText={editorDisplay.statePlaceholder}
      onValueInput={sysPromptStateChangeHandler()}
    />
    <PlainInputField
      value={sysPromptDisplay.sys_name_group}
      placeholderText={editorDisplay.sysNameGroupPlaceholder}
      onValueInput={sysPromptNameGroupChangeHandler()}
    />
    <PlainInputField
      value={sysPromptDisplay.pattern}
      placeholderText={editorDisplay.patternPlaceholder}
      onValueInput={sysPromptPatternChangeHandler()}
    />
    {@render deleteStructuredRowButton()}
  </div>
{:else if editorDisplay.showInteractionsEditor}
  <div class="grid gap-2 rounded-lg border border-border bg-muted/40 p-3">
    <div class="grid gap-2 md:grid-cols-[180px_1fr_auto]">
      <PlainInputField
        value={interactionDisplay.input}
        placeholderText={interactionEditorDisplay.inputPlaceholder}
        onValueInput={interactionInputChangeHandler()}
      />
      {@render deleteStructuredRowButton()}
    </div>
    <div class="flex flex-wrap items-center gap-3">
      <PlainCheckboxField
        checked={interactionDisplay.isDynamic}
        labelText={interactionEditorDisplay.isDynamicLabel}
        onCheckedChange={interactionDynamicChangeHandler()}
      />
      <PlainCheckboxField
        checked={interactionDisplay.recordInput}
        labelText={interactionEditorDisplay.recordInputLabel}
        onCheckedChange={interactionRecordInputChangeHandler()}
      />
      <MiniActionButton
        labelText={interactionEditorDisplay.addPatternButtonLabel}
        variant="add"
        onClick={addPatternHandler()}
      />
    </div>
    {@render patternList(interactionDisplay.patternRows)}
  </div>
{:else if editorDisplay.showTransitionsEditor}
  <div class="grid gap-2 rounded-lg border border-border bg-muted/40 p-3">
    <div class="grid gap-2 md:grid-cols-[1fr_1.2fr_1fr_auto]">
      <PlainInputField
        value={transitionDisplay.from}
        placeholderText={transitionEditorDisplay.fromPlaceholder}
        onValueInput={transitionFromChangeHandler()}
      />
      <PlainInputField
        value={transitionDisplay.command}
        placeholderText={transitionEditorDisplay.commandPlaceholder}
        onValueInput={transitionCommandChangeHandler()}
      />
      <PlainInputField
        value={transitionDisplay.to}
        placeholderText={transitionEditorDisplay.toPlaceholder}
        onValueInput={transitionToChangeHandler()}
      />
      {@render deleteStructuredRowButton()}
    </div>
    <div class="flex flex-wrap items-center gap-3">
      <PlainCheckboxField
        checked={transitionDisplay.is_exit}
        labelText={transitionEditorDisplay.isExitLabel}
        onCheckedChange={transitionExitChangeHandler()}
      />
      <PlainCheckboxField
        checked={transitionDisplay.format_sys}
        labelText={transitionEditorDisplay.formatSysLabel}
        onCheckedChange={transitionFormatSysChangeHandler()}
      />
    </div>
  </div>
{/if}
