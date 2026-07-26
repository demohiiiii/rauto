<script>
  import * as Card from "$lib/components/ui/card";
  import { Input } from "$lib/components/ui/input";
  import { Badge } from "$lib/components/ui/badge";
  import { Textarea } from "$lib/components/ui/textarea";
  import GitBranchIcon from "@lucide/svelte/icons/git-branch";
  import ConnectionPickerField from "../../components/connections/ConnectionPickerField.svelte";
  import LoadingButton from "../../components/fragments/LoadingButton.svelte";
  import OutputBlock from "../../components/fragments/OutputBlock.svelte";
  import ParsedOutputBlock from "../../components/fragments/ParsedOutputBlock.svelte";
  import StatusCard from "../../components/fragments/StatusCard.svelte";
  import ValueTextSelectField from "../../components/fragments/ValueTextSelectField.svelte";
  import WorkspaceActionHeader from "../../components/fragments/WorkspaceActionHeader.svelte";
  import { t } from "../../lib/i18n.js";
  import { batchFlowTargetPickerFields } from "../../modules/connections/connections.js";
  import { parsedOutputBlockDisplayFromItem } from "../../modules/operations/results.js";
  import {
    batchFlowFormState,
    batchFlowResultState,
    batchFlowTemplateOptionsState,
    executeBatchFlow,
    loadBatchFlowTemplateOptions,
    setBatchFlowField,
  } from "../../modules/standard/batchFlowState.js";

  let { active } = $props();
  let initialized = false;
  let form = $derived($batchFlowFormState);
  let result = $derived($batchFlowResultState);
  let templateOptions = $derived($batchFlowTemplateOptionsState);
  let running = $derived(result.kind === "running");
  let resultRows = $derived(
    result.kind === "result" && Array.isArray(result.resultPayload?.results)
      ? result.resultPayload.results
      : [],
  );
  let statusMessage = $derived(
    result.kind === "error"
      ? result.message
      : result.kind === "running"
        ? t("running")
        : "",
  );
  let statusTone = $derived(result.kind === "error" ? "error" : "running");

  $effect(() => {
    if (!active || initialized) return;
    initialized = true;
    void loadBatchFlowTemplateOptions();
  });
</script>

<div hidden={!active} class="grid gap-3 p-4 sm:p-5">
  <Card.Root class="gap-0 overflow-hidden border-border/80 py-0 shadow-sm">
    <WorkspaceActionHeader
      title={t("batchFlowTitle")}
      description={t("batchFlowHint")}
      icon={GitBranchIcon}
    />
    <Card.Content class="flex flex-col gap-5 p-4 sm:p-5">
      <div class="grid gap-4 md:grid-cols-2">
        <label class="grid gap-1 text-sm font-medium text-foreground">
          {t("batchFlowTemplateLabel")}
          <ValueTextSelectField
            value={form.template}
            optionRows={templateOptions}
            placeholderText={t("batchFlowTemplatePlaceholder")}
            aria-label={t("batchFlowTemplateLabel")}
            onValueChange={(value) => setBatchFlowField("template", value)}
          />
        </label>
        <label class="grid gap-1 text-sm font-medium text-foreground">
          {t("batchFlowVarsLabel")}
          <Textarea
            rows={3}
            class="font-mono text-xs"
            placeholder={t("batchFlowVarsPlaceholder")}
            value={form.varsJson}
            oninput={(event) =>
              setBatchFlowField("varsJson", event.currentTarget.value)}
          />
        </label>
      </div>

      <div class="rounded-2xl border border-border bg-muted/30 p-4">
        <div
          class="grid gap-4 md:grid-cols-2"
          role="group"
          aria-label={t("batchFlowTitle")}
        >
          {#each batchFlowTargetPickerFields as targetField (targetField.key)}
            <ConnectionPickerField
              keyName={targetField.keyName}
              labelText={t(targetField.labelKey)}
              pickerPlaceholder={t(targetField.placeholderKey)}
            />
          {/each}
        </div>
      </div>

      <div
        class="flex items-center justify-between gap-3 rounded-2xl border border-border bg-muted/30 px-4 py-3"
      >
        <p class="text-xs text-muted-foreground">
          {t("batchFlowFooterHint")}
        </p>
        <div class="flex items-center gap-3">
          <label
            class="flex items-center gap-2 text-xs whitespace-nowrap text-muted-foreground"
            for="batch-flow-max-parallel"
          >
            {t("batchExecMaxParallelLabel")}
            <Input
              id="batch-flow-max-parallel"
              type="number"
              min="1"
              step="1"
              placeholder="4"
              class="h-8 w-20"
              value={form.maxParallel}
              oninput={(event) =>
                setBatchFlowField("maxParallel", event.currentTarget.value)}
            />
          </label>
          <LoadingButton size="lg" loading={running} onclick={executeBatchFlow}>
            <span>{t("batchFlowRunBtn")}</span>
          </LoadingButton>
        </div>
      </div>
    </Card.Content>
  </Card.Root>

  <StatusCard message={statusMessage} tone={statusTone} />

  {#each resultRows as row, index (row.target || index)}
    <Card.Root class="gap-0 overflow-hidden border-border/80 py-0 shadow-sm">
      <Card.Content class="grid gap-3 p-4">
        <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <span class="font-medium text-foreground">{row.target}</span>
          <span class="text-muted-foreground">{row.host}</span>
          <span class="text-muted-foreground">{row.profile}</span>
          {#if row.success !== null && row.success !== undefined}
            <Badge variant={row.success ? "secondary" : "destructive"}>
              {row.success ? t("flowResultSuccess") : t("flowResultFailed")}
            </Badge>
          {/if}
        </div>
        {#if row.error}
          <StatusCard message={row.error} tone="error" />
        {:else}
          {#each row.outputs ?? [] as output, stepIndex (stepIndex)}
            <OutputBlock title={`${stepIndex + 1}. ${output.command}`}>
              {output.output ?? ""}
            </OutputBlock>
            {#if output.parsed_output || output.parse_error}
              <ParsedOutputBlock
                parsedOutputBlock={parsedOutputBlockDisplayFromItem(output)}
              />
            {/if}
          {/each}
        {/if}
      </Card.Content>
    </Card.Root>
  {/each}
</div>
