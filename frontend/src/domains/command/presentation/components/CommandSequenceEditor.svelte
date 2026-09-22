<script lang="ts" generics="TStep, TModel extends { steps: TStep[] }">
  import type { Snippet } from "svelte";
  import { t } from "$lib/i18n.js";
  import CommandSettings from "./CommandSettings.svelte";
  import CommandSequenceStepsEditor from "./CommandSequenceStepsEditor.svelte";

  type AddStepPlacement = "footer" | "header";
  type SurfaceVariant = "section" | "workbench-header" | "workbench-section";
  interface ModelPatch {
    steps?: TStep[];
  }

  interface StepRow {
    commandStep: TStep;
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
    model: TModel;
    onChange?: (model: TModel) => void;
    renderSettings?: Snippet<[SettingsContext]>;
    renderStepContent: Snippet<[RenderStepRow]>;
    settingsIndexText?: string;
    stepsIndexText?: string;
    surfaceVariant?: SurfaceVariant;
  }

  let {
    addStepPlacement = "header",
    createStep,
    model,
    onChange,
    renderSettings = undefined,
    renderStepContent,
    settingsIndexText = "",
    stepsIndexText = "",
    surfaceVariant = "section",
  }: Props = $props();

  let stepRows = $derived(
    (Array.isArray(model.steps) ? model.steps : []).map(
      (commandStep, stepIndex) => ({
        commandStep,
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
  <CommandSettings
    title={t("txBlockFormFlowSettings")}
    description={t("txBlockFormFlowSettingsHint")}
    indexText={settingsIndexText}
    {surfaceVariant}
  >
    {@render renderSettings?.({ model, patchModel })}
  </CommandSettings>

  <CommandSequenceStepsEditor
    title={t("txBlockFormFlowSteps")}
    description={t("txBlockFormFlowStepsHint")}
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
  </CommandSequenceStepsEditor>
</div>
