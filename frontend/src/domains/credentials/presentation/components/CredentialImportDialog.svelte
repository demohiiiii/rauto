<script lang="ts">
  import * as Alert from "$lib/components/ui/alert";
  import { Badge } from "$lib/components/ui/badge/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import * as Dialog from "$lib/components/ui/dialog";
  import { Spinner } from "$lib/components/ui/spinner/index.js";
  import {
    createCredentialImportWorkspace,
    credentialImportFailureMessage,
    type CredentialImportReport,
  } from "../../index.js";
  import { currentLanguageState, t } from "$lib/i18n.js";
  import DownloadIcon from "@lucide/svelte/icons/download";
  import FileSpreadsheetIcon from "@lucide/svelte/icons/file-spreadsheet";
  import ShieldAlertIcon from "@lucide/svelte/icons/shield-alert";
  import UploadIcon from "@lucide/svelte/icons/upload";
  import type { ComponentProps } from "svelte";

  type ImportSummaryKey =
    | "totalRows"
    | "imported"
    | "created"
    | "updated"
    | "failed";

  const summaryFields: Array<[ImportSummaryKey, string]> = [
    ["totalRows", "credentialImportSummaryTotal"],
    ["imported", "credentialImportSummaryImported"],
    ["created", "credentialImportSummaryCreated"],
    ["updated", "credentialImportSummaryUpdated"],
    ["failed", "credentialImportSummaryFailed"],
  ];

  let {
    onImported = undefined,
  }: {
    onImported?: (report: CredentialImportReport) => void | Promise<void>;
  } = $props();
  const workspace = createCredentialImportWorkspace({
    onImported: (report) => onImported?.(report),
  });
  const { stateStore } = workspace;
  let dialogState = $derived($stateStore);
  let error = $derived(dialogState.error);
  let file = $derived(dialogState.file);
  let importing = $derived(dialogState.importing);
  let open = $derived(dialogState.open);
  let report = $derived(dialogState.report);
  let templateLoading = $derived(dialogState.templateLoading);
  let templateStatus = $derived(dialogState.templateStatus);
  let fileInput = $state<HTMLInputElement | null>(null);
  let currentLanguage = $derived($currentLanguageState);

  function handleOpenChange(nextOpen: boolean): void {
    workspace.setOpen(nextOpen);
    if (!nextOpen && !importing && fileInput) fileInput.value = "";
  }

  function selectFile(event: Event): void {
    const input = event.currentTarget as HTMLInputElement;
    workspace.selectFile(input.files?.[0] || null);
  }

  function downloadTemplate(): Promise<void> {
    return workspace.downloadTemplate(currentLanguage);
  }

  function submitImport(): Promise<void> {
    return workspace.submitImport();
  }
</script>

<Dialog.Root {open} onOpenChange={handleOpenChange}>
  <Dialog.Trigger>
    {#snippet child({ props }: { props: ComponentProps<typeof Button> })}
      <Button {...props} variant="outline" size="sm" class="w-full rounded-lg">
        <UploadIcon data-icon="inline-start" aria-hidden="true" />
        {t("credentialImportAction")}
      </Button>
    {/snippet}
  </Dialog.Trigger>

  <Dialog.Content class="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl">
    <Dialog.Header>
      <Dialog.Title>{t("credentialImportTitle")}</Dialog.Title>
      <Dialog.Description>{t("credentialImportDescription")}</Dialog.Description
      >
    </Dialog.Header>

    <div class="flex flex-col gap-4">
      <label
        for="credential-import-file"
        class="flex min-h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border px-4 py-5 text-center transition-colors hover:bg-muted/50"
      >
        <FileSpreadsheetIcon
          class="size-6 text-muted-foreground"
          aria-hidden="true"
        />
        <span class="text-sm font-medium">
          {file?.name || t("credentialImportFileLabel")}
        </span>
        <span
          id="credential-import-file-hint"
          class="text-xs text-muted-foreground"
        >
          {t("credentialImportFileHint")}
        </span>
        <input
          bind:this={fileInput}
          id="credential-import-file"
          class="sr-only"
          type="file"
          accept=".csv,.xlsx,.xls,.xlsm,.xlsb"
          aria-describedby="credential-import-file-hint"
          disabled={importing}
          onchange={selectFile}
        />
      </label>

      <Alert.Root>
        <ShieldAlertIcon aria-hidden="true" />
        <Alert.Title>{t("credentialImportSecurityTitle")}</Alert.Title>
        <Alert.Description>
          {t("credentialImportSecurityDescription")}
        </Alert.Description>
      </Alert.Root>

      {#if error}
        <Alert.Root variant="destructive">
          <Alert.Title>{t("requestFailed")}</Alert.Title>
          <Alert.Description>{error}</Alert.Description>
        </Alert.Root>
      {/if}

      {#if report}
        <section class="flex flex-col gap-3" aria-live="polite">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <h3 class="text-sm font-semibold">
              {t("credentialImportComplete")}
            </h3>
            <Badge variant={report.failed ? "destructive" : "secondary"}>
              {report.fileName}
            </Badge>
          </div>
          <dl class="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {#each summaryFields as [valueKey, labelKey] (valueKey)}
              <div class="rounded-lg border border-border p-2.5">
                <dt class="text-xs text-muted-foreground">{t(labelKey)}</dt>
                <dd class="mt-1 font-mono text-lg font-semibold">
                  {report[valueKey]}
                </dd>
              </div>
            {/each}
          </dl>
          {#if report.failures.length}
            <div class="flex flex-col gap-2">
              <h4 class="text-sm font-medium">
                {t("credentialImportFailuresTitle")}
              </h4>
              <ul class="flex max-h-44 flex-col gap-2 overflow-y-auto">
                {#each report.failures as failure, index (`${failure.row}-${failure.name}-${index}`)}
                  <li class="rounded-lg border border-border p-3 text-sm">
                    <div class="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">
                        {t("credentialImportFailureRow")}
                        {failure.row}
                      </Badge>
                      {#if failure.name}<code class="text-xs"
                          >{failure.name}</code
                        >{/if}
                    </div>
                    <p class="mt-2 text-destructive">
                      {credentialImportFailureMessage(failure, t)}
                    </p>
                  </li>
                {/each}
              </ul>
            </div>
          {/if}
        </section>
      {/if}

      {#if templateStatus}
        <p class="text-sm text-muted-foreground" role="status">
          {templateStatus}
        </p>
      {/if}
    </div>

    <Dialog.Footer>
      <Button
        type="button"
        variant="outline"
        disabled={importing || templateLoading}
        onclick={downloadTemplate}
      >
        {#if templateLoading}<Spinner
            data-icon="inline-start"
          />{:else}<DownloadIcon
            data-icon="inline-start"
            aria-hidden="true"
          />{/if}
        {templateLoading
          ? t("credentialImportTemplateDownloading")
          : t("credentialImportTemplateAction")}
      </Button>
      <Button type="button" disabled={importing} onclick={submitImport}>
        {#if importing}<Spinner data-icon="inline-start" />{:else}<UploadIcon
            data-icon="inline-start"
            aria-hidden="true"
          />{/if}
        {importing ? t("credentialImporting") : t("credentialImportSubmit")}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
