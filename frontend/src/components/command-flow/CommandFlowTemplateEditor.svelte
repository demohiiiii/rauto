<script>
  import PlainCheckboxField from "../fragments/PlainCheckboxField.svelte";
  import PlainInputField from "../fragments/PlainInputField.svelte";
  import StringSelectField from "../fragments/StringSelectField.svelte";
  import { t } from "../../lib/i18n.js";
  import { defaultCommandFlowTemplateStepModel } from "../../modules/commandFlowTemplateModel.js";
  import CommandFlowSettings from "./CommandFlowSettings.svelte";
  import CommandFlowStepsEditor from "./CommandFlowStepsEditor.svelte";
  import CommandFlowTemplateStepEditor from "./CommandFlowTemplateStepEditor.svelte";

  let {
    addStepPlacement = "header",
    modeOptions = [],
    model = {},
    onChange,
    settingsIndexText = "",
    showNameField = true,
    stepsIndexText = "",
    surfaceVariant = "section",
  } = $props();

  let stepRows = $derived(
    (Array.isArray(model.steps) ? model.steps : []).map(
      (flowStep, stepIndex) => ({
        flowStep,
        stepIndex,
        titleText: `${t("txBlockFormFlowStep")} ${stepIndex + 1}`,
      }),
    ),
  );

  function patchModel(patch) {
    onChange?.({ ...model, ...patch });
  }

  function addStep() {
    patchModel({
      steps: [...(model.steps || []), defaultCommandFlowTemplateStepModel()],
    });
  }

  function removeStep(stepIndex) {
    const steps = [...(model.steps || [])];
    steps.splice(stepIndex, 1);
    patchModel({ steps });
  }

  function duplicateStep(stepIndex) {
    const steps = structuredClone(model.steps || []);
    steps.splice(stepIndex + 1, 0, structuredClone(steps[stepIndex]));
    patchModel({ steps });
  }

  function moveStep(fromIndex, toIndex) {
    const steps = [...(model.steps || [])];
    const [step] = steps.splice(fromIndex, 1);
    steps.splice(toIndex, 0, step);
    patchModel({ steps });
  }

  function updateStep(stepIndex, step) {
    const steps = [...(model.steps || [])];
    steps[stepIndex] = step;
    patchModel({ steps });
  }
</script>

<div
  class={surfaceVariant === "workbench-section" ? "grid min-w-0" : "grid gap-5"}
>
  <CommandFlowSettings
    title={t("commandFlowDefinitionTitle")}
    description={t("commandFlowDefinitionHint")}
    indexText={settingsIndexText}
    {surfaceVariant}
  >
    <div class="grid gap-3 md:grid-cols-2">
      {#if showNameField}
        <label class="grid gap-2">
          <span class="text-sm font-medium text-foreground">
            {t("txBlockFormTemplateName")}
          </span>
          <PlainInputField
            value={model.name || ""}
            placeholderText={t("commandFlowNamePlaceholder")}
            onValueInput={(name) => patchModel({ name })}
          />
        </label>
      {/if}

      <div class="grid gap-2">
        <PlainCheckboxField
          controlKind="switch"
          checked={!!model.hasDefaultMode}
          labelText={t("commandFlowUseDefaultMode")}
          onCheckedChange={(hasDefaultMode) =>
            patchModel({
              hasDefaultMode,
              defaultMode: hasDefaultMode ? (model.defaultMode ?? "") : null,
            })}
        />
        <StringSelectField
          value={model.defaultMode || ""}
          optionValues={modeOptions}
          includeEmptyOption={true}
          placeholderText={t("txBlockFormDefaultMode")}
          disabled={!model.hasDefaultMode}
          onValueChange={(defaultMode) =>
            patchModel({ defaultMode, hasDefaultMode: true })}
        />
      </div>

      <PlainCheckboxField
        class="md:col-span-2"
        controlKind="switch"
        checked={model.stopOnError !== false}
        labelText={t("txBlockFormStopOnError")}
        onCheckedChange={(stopOnError) => patchModel({ stopOnError })}
      />
    </div>
  </CommandFlowSettings>

  <CommandFlowStepsEditor
    title={t("txBlockFormFlowSteps")}
    description={t("commandFlowTemplateStepsHint")}
    addLabel={t("txBlockFormAddFlowStep")}
    {addStepPlacement}
    emptyText={t("txBlockFormFlowStepsEmpty")}
    removeLabel={t("deleteBtn")}
    duplicateLabel={t("txBlockTimelineDuplicateStep")}
    moveUpLabel={t("txBlockTimelineMoveUp")}
    moveDownLabel={t("txBlockTimelineMoveDown")}
    indexText={stepsIndexText}
    {stepRows}
    {surfaceVariant}
    onAddStep={addStep}
    onRemoveStep={removeStep}
    onDuplicateStep={duplicateStep}
    onMoveStep={moveStep}
  >
    {#snippet renderStep(stepRow)}
      <CommandFlowTemplateStepEditor
        step={stepRow.flowStep}
        accentIndex={stepRow.accentIndex}
        {modeOptions}
        onChange={(step) => updateStep(stepRow.stepIndex, step)}
      />
    {/snippet}
  </CommandFlowStepsEditor>
</div>
