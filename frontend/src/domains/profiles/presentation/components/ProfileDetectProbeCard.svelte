<script lang="ts">
  import MiniActionButton from "$components/fragments/MiniActionButton.svelte";
  import PlainInputField from "$components/fragments/PlainInputField.svelte";
  import { createProfileDetectProbeCardWorkspace } from "$domains/profiles/application/profilePanelWorkspaces.js";
  import { customProfileDetectPanelDisplay } from "$domains/profiles/presentation/profileDiagnosticsPresentation.js";

  type DetectDisplay = ReturnType<typeof customProfileDetectPanelDisplay>;

  let {
    detectDisplay,
    detectProbeRow,
    probeIndex,
  }: {
    detectDisplay: DetectDisplay;
    detectProbeRow: DetectDisplay["probeRows"][number];
    probeIndex: number;
  } = $props();
  const profileDetectProbeCardWorkspace =
    createProfileDetectProbeCardWorkspace();
  const {
    addErrorPatternHandler,
    addRuleHandler,
    commandChangeHandler,
    errorPatternChangeHandler,
    removeErrorPatternHandler,
    removeProbeHandler,
    removeRuleHandler,
    ruleFieldChangeHandler,
  } = profileDetectProbeCardWorkspace;
  let detectRuleEditorDisplay = $derived(detectDisplay.probeRuleEditorDisplay);

  $effect(() => {
    profileDetectProbeCardWorkspace.setProbeIndex(probeIndex);
  });
</script>

<div class="grid gap-3 rounded-lg border border-border bg-muted/40 p-3">
  <div class="grid gap-2 md:grid-cols-[1fr_auto]">
    <PlainInputField
      value={detectProbeRow.command}
      placeholderText={detectDisplay.commandPlaceholder}
      onValueInput={commandChangeHandler()}
    />
    <div class="flex items-start justify-end">
      <MiniActionButton
        labelText={detectDisplay.deleteButtonLabel}
        variant="delete"
        onClick={removeProbeHandler()}
      />
    </div>
  </div>
  <div class="grid gap-2">
    <div class="flex items-center justify-between">
      <span class="text-xs font-semibold text-slate-600">
        {detectRuleEditorDisplay.title}
      </span>
      <MiniActionButton
        labelText={detectRuleEditorDisplay.addButtonLabel}
        variant="add"
        onClick={addRuleHandler()}
      />
    </div>
    <div class="grid gap-2">
      {#each detectProbeRow.ruleRows as detectRuleRow}
        <div
          class="grid gap-2 rounded-lg border border-border bg-muted/40 p-3 md:grid-cols-[1fr_120px_auto]"
        >
          <PlainInputField
            value={detectRuleRow.pattern}
            placeholderText={detectRuleEditorDisplay.patternInputDisplay
              .placeholder}
            type={detectRuleEditorDisplay.patternInputDisplay.type}
            onValueInput={ruleFieldChangeHandler(
              detectRuleRow.index,
              "pattern",
            )}
          />
          <PlainInputField
            value={detectRuleRow.weight}
            placeholderText={detectRuleEditorDisplay.weightInputDisplay
              .placeholder}
            type={detectRuleEditorDisplay.weightInputDisplay.type}
            min={detectRuleEditorDisplay.weightInputDisplay.min}
            step={detectRuleEditorDisplay.weightInputDisplay.step}
            onValueInput={ruleFieldChangeHandler(detectRuleRow.index, "weight")}
          />
          <div class="flex items-start justify-end">
            <MiniActionButton
              labelText={detectRuleEditorDisplay.deleteButtonLabel}
              variant="delete"
              onClick={removeRuleHandler(detectRuleRow.index)}
            />
          </div>
        </div>
      {/each}
    </div>
  </div>
  <div class="grid gap-2">
    <div class="flex items-center justify-between">
      <span class="text-xs font-semibold text-slate-600">
        {detectDisplay.errorPatternsDisplay.title}
      </span>
      <MiniActionButton
        labelText={detectDisplay.errorPatternsDisplay.addButtonLabel}
        variant="add"
        onClick={addErrorPatternHandler()}
      />
    </div>
    <div class="grid gap-2">
      {#each detectProbeRow.errorPatternRows as errorPatternRow}
        <div class="rounded-lg border border-border bg-muted/40 p-3">
          <div class="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2.5">
            <PlainInputField
              value={errorPatternRow.pattern}
              placeholderText=""
              onValueInput={errorPatternChangeHandler(
                errorPatternRow.patternIndex,
              )}
            />
            <MiniActionButton
              labelText={detectDisplay.errorPatternsDisplay.deleteButtonLabel}
              variant="delete"
              onClick={removeErrorPatternHandler(errorPatternRow.patternIndex)}
            />
          </div>
        </div>
      {/each}
    </div>
  </div>
</div>
