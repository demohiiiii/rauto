<script
  lang="ts"
  generics="TStep, TModel extends { steps: TStep[]; name?: string; hasDefaultMode?: boolean; defaultMode?: string | null; stopOnError?: boolean }"
>
  import type { Snippet } from "svelte";
  import PlainCheckboxField from "../fragments/PlainCheckboxField.svelte";
  import PlainInputField from "../fragments/PlainInputField.svelte";
  import ModeExpressionField from "../fragments/ModeExpressionField.svelte";
  import { t } from "../../lib/i18n.js";
  import CommandFlowSettings from "./CommandFlowSettings.svelte";
  import CommandFlowStepsEditor from "./CommandFlowStepsEditor.svelte";

  type AddStepPlacement = "footer" | "header";
  type SurfaceVariant = "section" | "workbench-header" | "workbench-section";
  interface ModelPatch {
    defaultMode?: string | null;
    hasDefaultMode?: boolean;
    name?: string;
    steps?: TStep[];
    stopOnError?: boolean;
  }

  interface StepRow {
    flowStep: TStep;
    stepIndex: number;
    titleText: string;
  }

  interface RenderStepRow extends StepRow {
    accentIndex: number;
    onChange: (step: TStep) => void;
  }

  interface SettingsContext {
    model: TModel;
    patchModel: (patch: ModelPatch) => void;
  }

  interface Props {
    addStepPlacement?: AddStepPlacement;
    createStep: () => TStep;
    modeOptions?: string[];
    model: TModel;
    onChange?: (model: TModel) => void;
    renderSettings?: Snippet<[SettingsContext]>;
    renderStepContent: Snippet<[RenderStepRow]>;
    settingsIndexText?: string;
    showDefaultSettings?: boolean;
    showNameField?: boolean;
    stepsIndexText?: string;
    surfaceVariant?: SurfaceVariant;
  }

  let {
    addStepPlacement = "header",
    createStep,
    modeOptions = [],
    model,
    onChange,
    renderSettings = undefined,
    renderStepContent,
    settingsIndexText = "",
    showDefaultSettings = true,
    showNameField = true,
    stepsIndexText = "",
    surfaceVariant = "section",
  }: Props = $props();

  let stepRows = $derived(
    (Array.isArray(model.steps) ? model.steps : []).map(
      (flowStep, stepIndex) => ({
        flowStep,
        stepIndex,
        titleText: `${t("txBlockFormFlowStep")} ${stepIndex + 1}`,
      }),
    ),
  );

  function patchModel(patch: ModelPatch): void {
    onChange?.({ ...model, ...patch });
  }

  function addStep(): void {
    patchModel({
      steps: [...(model.steps || []), createStep()],
    });
  }

  function removeStep(stepIndex: number): void {
    const steps = [...(model.steps || [])];
    steps.splice(stepIndex, 1);
    patchModel({ steps });
  }

  function duplicateStep(stepIndex: number): void {
    const steps = structuredClone(model.steps || []);
    steps.splice(stepIndex + 1, 0, structuredClone(steps[stepIndex]));
    patchModel({ steps });
  }

  function moveStep(fromIndex: number, toIndex: number): void {
    const steps = [...(model.steps || [])];
    const [step] = steps.splice(fromIndex, 1);
    steps.splice(toIndex, 0, step);
    patchModel({ steps });
  }

  function updateStep(stepIndex: number, step: TStep): void {
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
    {#if showDefaultSettings}
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
          <ModeExpressionField
            value={model.defaultMode || ""}
            optionValues={modeOptions}
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
    {/if}
    {@render renderSettings?.({ model, patchModel })}
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
      {@render renderStepContent({
        ...stepRow,
        onChange: (step) => updateStep(stepRow.stepIndex, step),
      })}
    {/snippet}
  </CommandFlowStepsEditor>
</div>
