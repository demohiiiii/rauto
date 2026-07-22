<script>
  import RadarIcon from "@lucide/svelte/icons/radar";
  import MiniActionButton from "../../components/fragments/MiniActionButton.svelte";
  import PlainCheckboxField from "../../components/fragments/PlainCheckboxField.svelte";
  import PlainInputField from "../../components/fragments/PlainInputField.svelte";
  import { createCustomProfileDetectPanelWorkspace } from "../../modules/profiles/profiles.js";
  import ProfileDetectProbeCard from "./ProfileDetectProbeCard.svelte";

  let { active } = $props();
  const customProfileDetectPanelWorkspace =
    createCustomProfileDetectPanelWorkspace();
  const {
    addInitialRule,
    addProbe,
    changeInitialRulePattern,
    changeInitialRuleWeight,
    detectDisplayStateStore,
    removeInitialRuleHandler,
    setDetectEnabled,
  } = customProfileDetectPanelWorkspace;
  let detectDisplay = $derived($detectDisplayStateStore);
  let initialRuleEditorDisplay = $derived(
    detectDisplay.initialRuleEditorDisplay,
  );

  $effect(() => {
    customProfileDetectPanelWorkspace.setPanelContext({ active });
  });
</script>

<section class="overflow-hidden rounded-lg border border-border bg-card/50">
  <header class="flex items-start gap-3 border-b border-border px-4 py-4">
    <div
      class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
    >
      <RadarIcon class="size-4" aria-hidden="true" />
    </div>
    <div class="min-w-0 flex-1">
      <PlainCheckboxField
        checked={detectDisplay.enabled}
        labelText={detectDisplay.label}
        title={detectDisplay.label}
        class="font-semibold"
        onCheckedChange={setDetectEnabled}
      />
      <div class="mt-1 text-xs leading-5 text-muted-foreground">
        {detectDisplay.hint}
      </div>
    </div>
  </header>
  <div class="grid gap-4 p-4">
    {#if !detectDisplay.enabled}
      <div
        class="rounded-lg border border-dashed border-border px-4 py-5 text-xs text-muted-foreground"
      >
        {detectDisplay.hint}
      </div>
    {/if}
    {#if detectDisplay.enabled}
      <div class="grid gap-2">
        <div class="flex items-center justify-between">
          <span class="text-xs font-semibold text-foreground">
            {initialRuleEditorDisplay.title}
          </span>
          <MiniActionButton
            labelText={initialRuleEditorDisplay.addButtonLabel}
            variant="add"
            onClick={addInitialRule}
          />
        </div>
        <div class="grid gap-2">
          {#each detectDisplay.initialRuleRows as detectRuleRow}
            <div
              class="grid gap-2 rounded-lg border border-border bg-muted/40 p-3 md:grid-cols-[1fr_120px_auto]"
            >
              <PlainInputField
                type={initialRuleEditorDisplay.patternInputDisplay.type}
                min={initialRuleEditorDisplay.patternInputDisplay.min}
                step={initialRuleEditorDisplay.patternInputDisplay.step}
                aria-label={initialRuleEditorDisplay.patternInputDisplay
                  .placeholder}
                placeholderText={initialRuleEditorDisplay.patternInputDisplay
                  .placeholder}
                value={detectRuleRow.pattern}
                onValueInput={changeInitialRulePattern(detectRuleRow.index)}
              />
              <PlainInputField
                type={initialRuleEditorDisplay.weightInputDisplay.type}
                min={initialRuleEditorDisplay.weightInputDisplay.min}
                step={initialRuleEditorDisplay.weightInputDisplay.step}
                aria-label={initialRuleEditorDisplay.weightInputDisplay
                  .placeholder}
                placeholderText={initialRuleEditorDisplay.weightInputDisplay
                  .placeholder}
                value={detectRuleRow.weight}
                onValueInput={changeInitialRuleWeight(detectRuleRow.index)}
              />
              <div class="flex items-start justify-end">
                <MiniActionButton
                  labelText={initialRuleEditorDisplay.deleteButtonLabel}
                  variant="delete"
                  onClick={removeInitialRuleHandler(detectRuleRow.index)}
                />
              </div>
            </div>
          {/each}
        </div>
      </div>
      <div class="grid gap-2">
        <div class="flex items-center justify-between">
          <span class="text-xs font-semibold text-foreground">
            {detectDisplay.probesLabel}
          </span>
          <MiniActionButton
            labelText={detectDisplay.addButtonLabel}
            variant="add"
            onClick={addProbe}
          />
        </div>
        <div class="grid gap-2">
          {#each detectDisplay.probeRows as detectProbeRow, probeIndex}
            <ProfileDetectProbeCard
              {detectDisplay}
              {detectProbeRow}
              {probeIndex}
            />
          {/each}
        </div>
      </div>
    {/if}
  </div>
</section>
