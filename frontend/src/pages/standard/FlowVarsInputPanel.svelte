<script>
  import PlainInputField from "../../components/fragments/PlainInputField.svelte";
  import StatusCard from "../../components/fragments/StatusCard.svelte";
  import StringSelectField from "../../components/fragments/StringSelectField.svelte";
  import TextAreaField from "../../components/fragments/TextAreaField.svelte";

  let { flowVarsDisplay, onFlowVarValueChange, onJsonOverridesChange } =
    $props();
</script>

<div class="grid gap-2">
  <div class="flex flex-wrap items-center justify-between gap-2">
    <div class="text-xs font-semibold text-slate-600">
      {flowVarsDisplay.titleText}
    </div>
    <div class="text-xs text-slate-500">
      {flowVarsDisplay.countMetaText}
    </div>
  </div>
  <div class="grid gap-2">
    {#if flowVarsDisplay.errorMessage}
      <StatusCard
        message={flowVarsDisplay.errorMessage}
        tone={flowVarsDisplay.errorStatus.tone}
      />
    {:else if !flowVarsDisplay.hasFields}
      <div
        class="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-500"
      >
        {flowVarsDisplay.emptyText}
      </div>
    {:else}
      {#each flowVarsDisplay.fieldRows as flowVarFieldRow (flowVarFieldRow.fieldName)}
        <div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
          <div class="mb-2 flex flex-wrap items-center gap-2">
            <div class="text-sm font-semibold text-slate-900">
              {flowVarFieldRow.labelText}
            </div>
            <span class={flowVarFieldRow.requirementBadgeClass}>
              {flowVarFieldRow.requirementLabelText}
            </span>
            <span
              class="inline-flex items-center rounded-full bg-cyan-100 px-2 py-0.5 text-[11px] font-semibold text-cyan-700"
            >
              {flowVarFieldRow.typeBadgeText}
            </span>
          </div>
          {#if flowVarFieldRow.hasDescription}
            <div class="text-xs text-slate-500">
              {flowVarFieldRow.descriptionText}
            </div>
          {/if}
          <div class={flowVarFieldRow.inputContainerClass}>
            {#if flowVarFieldRow.controlKind === "options-select"}
              <StringSelectField
                aria-label={flowVarFieldRow.inputAriaLabel}
                value={flowVarFieldRow.value}
                optionValues={flowVarFieldRow.optionValues}
                includeEmptyOption={flowVarFieldRow.allowsEmpty}
                onChange={onFlowVarValueChange(flowVarFieldRow.fieldName)}
              />
            {:else if flowVarFieldRow.controlKind === "boolean-select"}
              <StringSelectField
                aria-label={flowVarFieldRow.inputAriaLabel}
                value={flowVarFieldRow.value}
                optionValues={flowVarFieldRow.booleanValueOptions}
                onChange={onFlowVarValueChange(flowVarFieldRow.fieldName)}
              />
            {:else if flowVarFieldRow.controlKind === "json-editor"}
              <TextAreaField
                editorKind="json"
                class="min-h-24"
                showLabel={false}
                placeholderText={flowVarFieldRow.placeholderText}
                aria-label={flowVarFieldRow.inputAriaLabel}
                value={flowVarFieldRow.value}
                onChange={onFlowVarValueChange(flowVarFieldRow.fieldName)}
              />
            {:else}
              <PlainInputField
                aria-label={flowVarFieldRow.inputAriaLabel}
                type={flowVarFieldRow.inputType}
                value={flowVarFieldRow.value}
                placeholderText={flowVarFieldRow.placeholderText}
                oninput={onFlowVarValueChange(flowVarFieldRow.fieldName)}
              />
            {/if}
          </div>
        </div>
      {/each}
    {/if}
  </div>
  <div class="text-xs text-slate-500">
    {flowVarsDisplay.hintText}
  </div>
  <TextAreaField
    editorKind="json"
    class="min-h-28"
    placeholderText={flowVarsDisplay.jsonPlaceholder}
    aria-label={flowVarsDisplay.jsonPlaceholder}
    value={flowVarsDisplay.jsonOverridesText}
    hintText={flowVarsDisplay.jsonHintText}
    onChange={onJsonOverridesChange}
  />
</div>
