<script>
  import * as Card from "$lib/components/ui/card";
  import { Input } from "$lib/components/ui/input";
  import TerminalIcon from "@lucide/svelte/icons/terminal";
  import ConnectionPickerField from "../../components/connections/ConnectionPickerField.svelte";
  import LoadingButton from "../../components/fragments/LoadingButton.svelte";
  import OutputBlock from "../../components/fragments/OutputBlock.svelte";
  import ParsedOutputBlock from "../../components/fragments/ParsedOutputBlock.svelte";
  import StatusCard from "../../components/fragments/StatusCard.svelte";
  import WorkspaceActionHeader from "../../components/fragments/WorkspaceActionHeader.svelte";
  import { t } from "../../lib/i18n.js";
  import { batchExecTargetPickerFields } from "../../modules/connections/connections.js";
  import { parsedOutputBlockDisplayFromItem } from "../../modules/operations/results.js";
  import {
    batchExecFormState,
    batchExecResultState,
    executeBatchExecCommand,
    setBatchExecField,
  } from "../../modules/standard/batchExecState.js";

  let { active } = $props();
  let form = $derived($batchExecFormState);
  let result = $derived($batchExecResultState);
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
</script>

<div hidden={!active} class="grid gap-3 p-4 sm:p-5">
  <Card.Root class="gap-0 overflow-hidden border-border/80 py-0 shadow-sm">
    <WorkspaceActionHeader
      title={t("batchExecTitle")}
      description={t("batchExecHint")}
      icon={TerminalIcon}
    />
    <Card.Content class="flex flex-col gap-5 p-4 sm:p-5">
      <div class="grid gap-4 md:grid-cols-[1fr_180px]">
        <label class="grid gap-1 text-sm font-medium text-foreground">
          {t("fieldCommand")}
          <Input
            placeholder={t("batchExecCommandPlaceholder")}
            value={form.command}
            oninput={(event) =>
              setBatchExecField("command", event.currentTarget.value)}
          />
        </label>
        <label class="grid gap-1 text-sm font-medium text-foreground">
          {t("historyColMode")}
          <Input
            placeholder={t("modePlaceholder")}
            value={form.mode}
            oninput={(event) =>
              setBatchExecField("mode", event.currentTarget.value)}
          />
        </label>
      </div>

      <div class="rounded-2xl border border-border bg-muted/30 p-4">
        <div
          class="grid gap-4 md:grid-cols-2"
          role="group"
          aria-label={t("batchExecTitle")}
        >
          {#each batchExecTargetPickerFields as targetField (targetField.key)}
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
          {t("batchExecFooterHint")}
        </p>
        <div class="flex items-center gap-3">
          <label
            class="flex items-center gap-2 text-xs whitespace-nowrap text-muted-foreground"
            for="batch-exec-max-parallel"
          >
            {t("batchExecMaxParallelLabel")}
            <Input
              id="batch-exec-max-parallel"
              type="number"
              min="1"
              step="1"
              placeholder="4"
              class="h-8 w-20"
              value={form.maxParallel}
              oninput={(event) =>
                setBatchExecField("maxParallel", event.currentTarget.value)}
            />
          </label>
          <LoadingButton
            size="lg"
            loading={running}
            onclick={executeBatchExecCommand}
          >
            <span>{t("batchExecRunBtn")}</span>
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
          <span class="text-muted-foreground">{row.mode}</span>
          <span class="text-muted-foreground">
            {t("txBlockResultExitCode")}: {row.exit_code ?? "-"}
          </span>
        </div>
        {#if row.error}
          <StatusCard message={row.error} tone="error" />
        {:else}
          <OutputBlock title={row.target}>{row.output ?? ""}</OutputBlock>
          {#if row.parsed_output || row.parse_error}
            <ParsedOutputBlock
              parsedOutputBlock={parsedOutputBlockDisplayFromItem(row)}
            />
          {/if}
        {/if}
      </Card.Content>
    </Card.Root>
  {/each}
</div>
