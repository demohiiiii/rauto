<script>
  import { Button } from "$lib/components/ui/button/index.js";
  import {
    ArrowRightIcon,
    BracesIcon,
    PlusIcon,
    RegexIcon,
    Trash2Icon,
  } from "@lucide/svelte";
  import PlainCheckboxField from "../../components/fragments/PlainCheckboxField.svelte";
  import PlainInputField from "../../components/fragments/PlainInputField.svelte";
  import { currentLanguageState, t } from "../../lib/i18n.js";
  import { createProfileListRowEditorWorkspace } from "../../modules/profiles/profiles.js";

  let {
    idPrefix = "profile-row",
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
    return typeof onAddPattern === "function"
      ? onAddPattern(currentRowIndex)
      : undefined;
  }

  function handlePatternChange(currentRowIndex, patternIndex, patternValue) {
    return typeof onPatternChange === "function"
      ? onPatternChange(currentRowIndex, patternIndex, patternValue)
      : undefined;
  }

  function handlePatternStateChange(currentRowIndex, patternState) {
    return typeof onPatternStateChange === "function"
      ? onPatternStateChange(currentRowIndex, patternState)
      : undefined;
  }

  function handleProfileListRowChange(currentRowIndex, patch) {
    return typeof onProfileListRowChange === "function"
      ? onProfileListRowChange(currentRowIndex, patch)
      : undefined;
  }

  function handleRemovePattern(currentRowIndex, patternIndex) {
    return typeof onRemovePattern === "function"
      ? onRemovePattern(currentRowIndex, patternIndex)
      : undefined;
  }

  function handleRemoveRow(currentRowIndex) {
    return typeof onRemoveRow === "function"
      ? onRemoveRow(currentRowIndex)
      : undefined;
  }

  function handleRemoveSimpleValue(currentRowIndex) {
    return typeof onRemoveSimpleValue === "function"
      ? onRemoveSimpleValue(currentRowIndex)
      : undefined;
  }

  function handleSimpleValueChange(currentRowIndex, simpleValue) {
    return typeof onSimpleValueChange === "function"
      ? onSimpleValueChange(currentRowIndex, simpleValue)
      : undefined;
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
    interactionStateChangeHandler,
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
  let currentLanguage = $derived($currentLanguageState);
  let rowNumber = $derived(String(rowIndex + 1).padStart(2, "0"));
  let rowId = $derived(`profile-${idPrefix}-${rowIndex}`);
  let addPatternLabel = $derived(
    String(promptPatternEditorDisplay.addPatternButtonLabel).replace(
      /^\+\s*/,
      "",
    ),
  );
  let interactionAddPatternLabel = $derived(
    String(interactionEditorDisplay.addPatternButtonLabel).replace(
      /^\+\s*/,
      "",
    ),
  );
  let labels = $derived.by(() => {
    currentLanguage;
    return {
      options: t("profileOptionsLabel"),
      pattern: t("profilePatternLabel"),
      rule: t("profileRuleLabel"),
      ruleValue: t("profileRuleValueLabel"),
    };
  });

  $effect(() => {
    setRowContext({
      kind,
      profileListRow,
      rowIndex,
    });
  });
</script>

{#snippet iconAction(labelText, handler, variant = "ghost")}
  <Button
    class="size-10 shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive focus-visible:text-destructive sm:size-9"
    {variant}
    size="icon-sm"
    type="button"
    title={labelText}
    aria-label={labelText}
    onclick={handler}
  >
    <Trash2Icon class="size-4" aria-hidden="true" />
  </Button>
{/snippet}

{#snippet patternList(patternRows, patternLabel = labels.pattern)}
  <div class="grid gap-2">
    {#each patternRows as patternRow (patternRow.patternIndex)}
      <div
        class="group/pattern flex min-w-0 items-center gap-2 rounded-md border border-border/80 bg-background px-2 py-1 transition-colors hover:border-primary/35"
      >
        <span
          class="flex size-6 shrink-0 items-center justify-center rounded bg-muted font-mono text-[10px] text-muted-foreground"
        >
          {patternRow.patternIndex + 1}
        </span>
        <label
          class="sr-only"
          for={`${rowId}-pattern-${patternRow.patternIndex}`}
        >
          {patternLabel}
          {patternRow.patternIndex + 1}
        </label>
        <PlainInputField
          id={`${rowId}-pattern-${patternRow.patternIndex}`}
          class="h-9 min-w-0 border-0 bg-transparent px-1 font-mono text-xs shadow-none focus-visible:bg-background focus-visible:ring-2"
          value={patternRow.pattern}
          placeholderText={patternLabel}
          onValueInput={patternChangeHandler(patternRow.patternIndex)}
        />
        {@render iconAction(
          patternListDisplay.deleteButtonLabel,
          removePatternHandler(patternRow.patternIndex),
          "ghost",
        )}
      </div>
    {/each}
  </div>
{/snippet}

{#snippet rowHeader(titleText = labels.rule)}
  <header
    class="flex items-center justify-between gap-3 border-b border-border/70 bg-muted/25 px-3 py-2"
  >
    <div class="flex min-w-0 items-center gap-2">
      <BracesIcon
        class="hidden size-4 shrink-0 text-muted-foreground sm:block"
        aria-hidden="true"
      />
      <span
        class="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 font-mono text-[11px] font-semibold text-primary"
      >
        {rowNumber}
      </span>
      <span class="truncate text-xs font-semibold">{titleText}</span>
    </div>
    {@render iconAction(editorDisplay.deleteButtonLabel, removeRowHandler())}
  </header>
{/snippet}

{#if editorDisplay.showSimpleEditor}
  <article
    class="group flex min-w-0 items-center gap-2 rounded-lg border border-border/80 bg-background px-2 py-1.5 transition-[border-color,box-shadow] hover:border-primary/35 hover:shadow-sm"
  >
    <div
      class="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"
    >
      <RegexIcon class="size-4" aria-hidden="true" />
    </div>
    <span class="sr-only">{labels.rule} {rowNumber}</span>
    <label class="sr-only" for={`${rowId}-value`}>
      {labels.ruleValue}
      {rowNumber}
    </label>
    <PlainInputField
      id={`${rowId}-value`}
      class="h-10 min-w-0 flex-1 border-0 bg-transparent px-1 font-mono text-sm shadow-none focus-visible:bg-background focus-visible:ring-2"
      value={profileListRow}
      placeholderText={labels.ruleValue}
      onValueInput={simpleValueChangeHandler()}
    />
    {@render iconAction(
      editorDisplay.deleteButtonLabel,
      removeSimpleValueHandler(),
    )}
  </article>
{:else if editorDisplay.showPromptsEditor}
  <article
    class="overflow-hidden rounded-lg border border-border/80 bg-background shadow-xs"
  >
    {@render rowHeader()}
    <div
      class="grid gap-4 p-3 md:grid-cols-[minmax(12rem,0.45fr)_minmax(0,1fr)]"
    >
      <div class="grid content-start gap-1.5">
        <label
          class="text-xs font-medium text-muted-foreground"
          for={`${rowId}-state`}
        >
          {promptPatternEditorDisplay.statePlaceholder}
        </label>
        <PlainInputField
          id={`${rowId}-state`}
          class="h-10 font-mono"
          value={promptPatternDisplay.state}
          placeholderText={promptPatternEditorDisplay.statePlaceholder}
          onValueInput={patternStateChangeHandler()}
        />
      </div>
      <div class="grid gap-2">
        <div class="flex items-center justify-between gap-3">
          <span class="text-xs font-medium text-muted-foreground">
            {labels.pattern}
          </span>
          <Button
            class="h-9"
            variant="ghost"
            size="sm"
            type="button"
            onclick={addPatternHandler()}
          >
            <PlusIcon data-icon="inline-start" aria-hidden="true" />
            {addPatternLabel}
          </Button>
        </div>
        {@render patternList(promptPatternDisplay.patternRows)}
      </div>
    </div>
  </article>
{:else if editorDisplay.showSysPromptsEditor}
  <article
    class="overflow-hidden rounded-lg border border-border/80 bg-background shadow-xs"
  >
    {@render rowHeader()}
    <div class="grid gap-3 p-3 md:grid-cols-3">
      <div class="grid gap-1.5">
        <label
          class="text-xs font-medium text-muted-foreground"
          for={`${rowId}-state`}
        >
          {editorDisplay.statePlaceholder}
        </label>
        <PlainInputField
          id={`${rowId}-state`}
          class="h-10 font-mono"
          value={sysPromptDisplay.state}
          placeholderText={editorDisplay.statePlaceholder}
          onValueInput={sysPromptStateChangeHandler()}
        />
      </div>
      <div class="grid gap-1.5">
        <label
          class="text-xs font-medium text-muted-foreground"
          for={`${rowId}-group`}
        >
          {editorDisplay.sysNameGroupPlaceholder}
        </label>
        <PlainInputField
          id={`${rowId}-group`}
          class="h-10 font-mono"
          value={sysPromptDisplay.sys_name_group}
          placeholderText={editorDisplay.sysNameGroupPlaceholder}
          onValueInput={sysPromptNameGroupChangeHandler()}
        />
      </div>
      <div class="grid gap-1.5">
        <label
          class="text-xs font-medium text-muted-foreground"
          for={`${rowId}-pattern`}
        >
          {editorDisplay.patternPlaceholder}
        </label>
        <PlainInputField
          id={`${rowId}-pattern`}
          class="h-10 font-mono"
          value={sysPromptDisplay.pattern}
          placeholderText={editorDisplay.patternPlaceholder}
          onValueInput={sysPromptPatternChangeHandler()}
        />
      </div>
    </div>
  </article>
{:else if editorDisplay.showInteractionsEditor}
  <article
    class="overflow-hidden rounded-lg border border-border/80 bg-background shadow-xs"
  >
    {@render rowHeader()}
    <div class="grid gap-4 p-3">
      <div class="grid gap-3 md:grid-cols-2">
        <div class="grid gap-1.5">
          <label
            class="text-xs font-medium text-muted-foreground"
            for={`${rowId}-state`}
          >
            {editorDisplay.statePlaceholder}
          </label>
          <PlainInputField
            id={`${rowId}-state`}
            class="h-10 font-mono"
            value={interactionDisplay.state}
            placeholderText={editorDisplay.statePlaceholder}
            onValueInput={interactionStateChangeHandler()}
          />
        </div>
        <div class="grid gap-1.5">
          <label
            class="text-xs font-medium text-muted-foreground"
            for={`${rowId}-input`}
          >
            {interactionEditorDisplay.inputPlaceholder}
          </label>
          <PlainInputField
            id={`${rowId}-input`}
            class="h-10 font-mono"
            value={interactionDisplay.input}
            placeholderText={interactionEditorDisplay.inputPlaceholder}
            onValueInput={interactionInputChangeHandler()}
          />
        </div>
      </div>
      <div
        class="grid gap-2 rounded-md bg-muted/35 p-2 sm:flex sm:items-center sm:justify-between"
      >
        <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
          <PlainCheckboxField
            checked={interactionDisplay.isDynamic}
            labelText={interactionEditorDisplay.isDynamicLabel}
            controlKind="switch"
            onCheckedChange={interactionDynamicChangeHandler()}
          />
          <PlainCheckboxField
            checked={interactionDisplay.recordInput}
            labelText={interactionEditorDisplay.recordInputLabel}
            controlKind="switch"
            onCheckedChange={interactionRecordInputChangeHandler()}
          />
        </div>
        <Button
          class="h-9 self-start sm:self-auto"
          variant="ghost"
          size="sm"
          type="button"
          onclick={addPatternHandler()}
        >
          <PlusIcon data-icon="inline-start" aria-hidden="true" />
          {interactionAddPatternLabel}
        </Button>
      </div>
      {@render patternList(interactionDisplay.patternRows)}
    </div>
  </article>
{:else if editorDisplay.showTransitionsEditor}
  <article
    class="overflow-hidden rounded-lg border border-border/80 bg-background shadow-xs"
  >
    {@render rowHeader()}
    <div
      class="grid gap-3 p-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_minmax(0,1fr)]"
    >
      <div class="grid gap-1.5">
        <label
          class="text-xs font-medium text-muted-foreground"
          for={`${rowId}-from`}
        >
          {transitionEditorDisplay.fromPlaceholder}
        </label>
        <PlainInputField
          id={`${rowId}-from`}
          class="h-10 font-mono"
          value={transitionDisplay.from}
          placeholderText={transitionEditorDisplay.fromPlaceholder}
          onValueInput={transitionFromChangeHandler()}
        />
      </div>
      <div class="grid gap-1.5">
        <label
          class="text-xs font-medium text-muted-foreground"
          for={`${rowId}-command`}
        >
          {transitionEditorDisplay.commandPlaceholder}
        </label>
        <PlainInputField
          id={`${rowId}-command`}
          class="h-10 font-mono"
          value={transitionDisplay.command}
          placeholderText={transitionEditorDisplay.commandPlaceholder}
          onValueInput={transitionCommandChangeHandler()}
        />
      </div>
      <div class="grid gap-1.5">
        <label
          class="text-xs font-medium text-muted-foreground"
          for={`${rowId}-to`}
        >
          {transitionEditorDisplay.toPlaceholder}
        </label>
        <PlainInputField
          id={`${rowId}-to`}
          class="h-10 font-mono"
          value={transitionDisplay.to}
          placeholderText={transitionEditorDisplay.toPlaceholder}
          onValueInput={transitionToChangeHandler()}
        />
      </div>
    </div>
    <div
      class="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border/70 bg-muted/25 px-3 py-2"
    >
      <PlainCheckboxField
        checked={transitionDisplay.is_exit}
        labelText={transitionEditorDisplay.isExitLabel}
        controlKind="switch"
        onCheckedChange={transitionExitChangeHandler()}
      />
      <PlainCheckboxField
        checked={transitionDisplay.format_sys}
        labelText={transitionEditorDisplay.formatSysLabel}
        controlKind="switch"
        onCheckedChange={transitionFormatSysChangeHandler()}
      />
      <ArrowRightIcon
        class="ml-auto hidden size-4 text-muted-foreground sm:block"
        aria-hidden="true"
      />
    </div>
  </article>
{/if}
