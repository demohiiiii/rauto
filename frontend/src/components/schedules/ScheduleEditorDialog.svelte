<script>
  import CalendarClockIcon from "@lucide/svelte/icons/calendar-clock";
  import SaveIcon from "@lucide/svelte/icons/save";
  import * as Dialog from "$lib/components/ui/dialog";
  import { Button } from "$lib/components/ui/button";
  import { Label } from "$lib/components/ui/label";
  import { Switch } from "$lib/components/ui/switch";
  import { Textarea } from "$lib/components/ui/textarea";
  import LoadingButton from "../fragments/LoadingButton.svelte";
  import MultiSelectField from "../fragments/MultiSelectField.svelte";
  import PlainInputField from "../fragments/PlainInputField.svelte";
  import PlainSelectField from "../fragments/PlainSelectField.svelte";
  import StatusCard from "../fragments/StatusCard.svelte";
  import { tr } from "../../lib/i18n.js";

  let { display, workspace } = $props();
  let dialogOpen = $state(false);
  let lastDisplayOpen = $state(false);
  let form = $derived(display.form);

  const actionOptions = $derived([
    {
      optionValue: "orchestrate",
      optionLabel: tr("scheduleActionOrchestrate", "Orchestration"),
    },
    {
      optionValue: "config_fetch",
      optionLabel: tr("scheduleActionConfigFetch", "Configuration fetch"),
    },
    {
      optionValue: "tx_workflow",
      optionLabel: tr("scheduleActionTxWorkflow", "Transaction workflow"),
    },
  ]);
  const overlapOptions = $derived([
    { optionValue: "skip", optionLabel: tr("scheduleOverlapSkip", "Skip") },
    {
      optionValue: "allow",
      optionLabel: tr("scheduleOverlapAllow", "Allow"),
    },
  ]);
  const misfireOptions = $derived([
    {
      optionValue: "fire_once",
      optionLabel: tr("scheduleMisfireOnce", "Run once"),
    },
    { optionValue: "skip", optionLabel: tr("scheduleMisfireSkip", "Skip") },
  ]);

  $effect(() => {
    const nextOpen = Boolean(display.dialogOpen);
    if (nextOpen === lastDisplayOpen) return;
    lastDisplayOpen = nextOpen;
    dialogOpen = nextOpen;
  });

  $effect(() => {
    if (dialogOpen === lastDisplayOpen) return;
    lastDisplayOpen = dialogOpen;
    if (!dialogOpen) workspace.closeEditor();
  });
</script>

<Dialog.Root bind:open={dialogOpen}>
  <Dialog.Content
    class="!grid max-h-[92vh] w-[calc(100vw-2rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:!max-w-3xl"
  >
    <Dialog.Header class="border-b px-5 py-4 pr-14">
      <div class="flex items-start gap-3">
        <div
          class="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"
        >
          <CalendarClockIcon class="size-5" />
        </div>
        <div>
          <Dialog.Title>
            {display.editingId
              ? tr("scheduleEdit", "Edit schedule")
              : tr("scheduleCreate", "Create schedule")}
          </Dialog.Title>
          <Dialog.Description>
            {tr(
              "scheduleEditorDescription",
              "Configure trigger and task details",
            )}
          </Dialog.Description>
        </div>
      </div>
    </Dialog.Header>

    <div class="min-h-0 overflow-y-auto p-5">
      <div class="grid gap-5">
        {#if display.listStatus}
          <StatusCard
            message={display.listStatus.message}
            tone={display.listStatus.tone}
          />
        {/if}

        <div class="grid gap-4 sm:grid-cols-2">
          <div class="grid gap-2">
            <Label for="schedule-name">{tr("scheduleName", "Name")}</Label>
            <PlainInputField
              id="schedule-name"
              value={form.name}
              onValueInput={(name) => workspace.patchForm({ name })}
            />
          </div>
          <div class="grid gap-2">
            <Label>{tr("scheduleActionType", "Task type")}</Label>
            <PlainSelectField
              value={form.actionType}
              optionRows={actionOptions}
              aria-label={tr("scheduleActionType", "Task type")}
              onValueChange={(actionType) =>
                workspace.patchForm({ actionType })}
            />
          </div>
        </div>

        <section class="grid gap-4 border-y py-5 sm:grid-cols-2">
          {#if form.actionType === "orchestrate"}
            <div class="grid gap-2 sm:col-span-2">
              <Label>{tr("scheduleTemplate", "Orchestration template")}</Label>
              <PlainSelectField
                value={form.orchestrationTemplateName}
                optionRows={display.orchestrationTemplateOptions}
                aria-label={tr("scheduleTemplate", "Orchestration template")}
                onValueChange={(orchestrationTemplateName) =>
                  workspace.patchForm({ orchestrationTemplateName })}
              />
            </div>
          {:else if form.actionType === "tx_workflow"}
            <div class="grid gap-2">
              <Label>{tr("scheduleConnection", "Saved connection")}</Label>
              <PlainSelectField
                value={form.connectionName}
                optionRows={display.connectionOptions}
                aria-label={tr("scheduleConnection", "Saved connection")}
                onValueChange={(connectionName) =>
                  workspace.patchForm({ connectionName })}
              />
            </div>
          {/if}

          {#if form.actionType === "config_fetch"}
            <div class="grid gap-4 sm:col-span-2 md:grid-cols-3">
              <MultiSelectField
                value={form.configTargets}
                optionRows={display.configTargetOptions}
                labelText={tr("scheduleConfigTargets", "Devices")}
                placeholderText={tr(
                  "scheduleConfigTargetsPlaceholder",
                  "Select devices",
                )}
                onValueChange={(configTargets) =>
                  workspace.patchForm({ configTargets })}
              />
              <MultiSelectField
                value={form.configGroups}
                optionRows={display.configGroupOptions}
                labelText={tr("scheduleConfigGroups", "Device groups")}
                placeholderText={tr(
                  "scheduleConfigGroupsPlaceholder",
                  "Select groups",
                )}
                onValueChange={(configGroups) =>
                  workspace.patchForm({ configGroups })}
              />
              <MultiSelectField
                value={form.configLabels}
                optionRows={display.configLabelOptions}
                labelText={tr("scheduleConfigLabels", "Labels")}
                placeholderText={tr(
                  "scheduleConfigLabelsPlaceholder",
                  "Select labels",
                )}
                onValueChange={(configLabels) =>
                  workspace.patchForm({ configLabels })}
              />
            </div>
            <div class="grid gap-2 sm:col-span-2">
              <Label>{tr("scheduleConfigKind", "Configuration type")}</Label>
              <PlainSelectField
                value={form.configKind}
                optionRows={display.configKindOptions}
                aria-label={tr("scheduleConfigKind", "Configuration type")}
                onValueChange={(configKind) =>
                  workspace.patchForm({ configKind })}
              />
            </div>
          {:else if form.actionType === "tx_workflow"}
            <div class="grid gap-2">
              <Label
                >{tr(
                  "scheduleTxTemplate",
                  "Transaction workflow template",
                )}</Label
              >
              <PlainSelectField
                value={form.txWorkflowTemplateName}
                optionRows={display.txWorkflowTemplateOptions}
                aria-label={tr(
                  "scheduleTxTemplate",
                  "Transaction workflow template",
                )}
                onValueChange={(txWorkflowTemplateName) =>
                  workspace.patchForm({ txWorkflowTemplateName })}
              />
            </div>
          {/if}

          {#if form.actionType !== "config_fetch"}
            <div class="grid gap-2 sm:col-span-2">
              <Label for="schedule-vars"
                >{tr("scheduleVars", "Variables JSON")}</Label
              >
              <Textarea
                id="schedule-vars"
                class="min-h-28 font-mono text-xs"
                value={form.varsJson}
                oninput={(event) =>
                  workspace.patchForm({ varsJson: event.currentTarget.value })}
              />
            </div>
          {/if}
        </section>

        <div class="grid gap-4 sm:grid-cols-2">
          <div class="grid gap-2">
            <Label for="schedule-cron">{tr("scheduleCron", "Cron")}</Label>
            <PlainInputField
              id="schedule-cron"
              class="font-mono"
              value={form.cronExpression}
              onValueInput={(cronExpression) =>
                workspace.patchForm({ cronExpression })}
            />
          </div>
          <div class="grid gap-2">
            <Label for="schedule-timezone"
              >{tr("scheduleTimezone", "Timezone")}</Label
            >
            <PlainInputField
              id="schedule-timezone"
              value={form.timezone}
              onValueInput={(timezone) => workspace.patchForm({ timezone })}
            />
          </div>
          <div class="grid gap-2 sm:col-span-2">
            <Label>{tr("scheduleNextFiveRuns", "Next 5 runs")}</Label>
            {#if display.cronPreviewStatus}
              <StatusCard
                message={display.cronPreviewStatus.message}
                tone={display.cronPreviewStatus.tone}
              />
            {:else}
              <ol
                class="grid list-decimal gap-1.5 rounded-md border bg-muted/20 px-4 py-3 pl-9 font-mono text-xs"
              >
                {#each display.cronPreview as nextRun (nextRun)}
                  <li><time>{nextRun}</time></li>
                {/each}
              </ol>
            {/if}
          </div>
          <div class="grid gap-2">
            <Label>{tr("scheduleOverlap", "Overlap")}</Label>
            <PlainSelectField
              value={form.overlapPolicy}
              optionRows={overlapOptions}
              aria-label={tr("scheduleOverlap", "Overlap")}
              onValueChange={(overlapPolicy) =>
                workspace.patchForm({ overlapPolicy })}
            />
          </div>
          <div class="grid gap-2">
            <Label>{tr("scheduleMisfire", "Missed runs")}</Label>
            <PlainSelectField
              value={form.misfirePolicy}
              optionRows={misfireOptions}
              aria-label={tr("scheduleMisfire", "Missed runs")}
              onValueChange={(misfirePolicy) =>
                workspace.patchForm({ misfirePolicy })}
            />
          </div>
          <div class="grid gap-2">
            <Label for="schedule-runtime">
              {tr("scheduleRuntime", "Maximum runtime (seconds)")}
            </Label>
            <PlainInputField
              id="schedule-runtime"
              type="number"
              min="1"
              value={form.maxRuntimeSeconds}
              onValueInput={(maxRuntimeSeconds) =>
                workspace.patchForm({ maxRuntimeSeconds })}
            />
          </div>
          <div
            class="flex items-center justify-between gap-3 rounded-md border p-3"
          >
            <Label for="schedule-enabled">{tr("enabled", "Enabled")}</Label>
            <Switch
              id="schedule-enabled"
              checked={form.enabled}
              onCheckedChange={(enabled) => workspace.patchForm({ enabled })}
            />
          </div>
        </div>
      </div>
    </div>

    <Dialog.Footer class="border-t px-5 py-4">
      <div class="flex justify-end gap-2">
        <Button variant="outline" type="button" onclick={workspace.closeEditor}>
          {tr("cancel", "Cancel")}
        </Button>
        <LoadingButton
          loading={display.busyAction === "save"}
          onclick={workspace.save}
        >
          <SaveIcon data-icon="inline-start" />
          {tr("save", "Save")}
        </LoadingButton>
      </div>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
