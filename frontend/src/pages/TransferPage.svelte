<script>
  import * as Card from "$lib/components/ui/card";
  import DashboardTabPanel from "../components/layout/DashboardTabPanel.svelte";
  import PlainCheckboxField from "../components/fragments/PlainCheckboxField.svelte";
  import PlainInputField from "../components/fragments/PlainInputField.svelte";
  import LoadingButton from "../components/fragments/LoadingButton.svelte";
  import StatusCard from "../components/fragments/StatusCard.svelte";
  import { createTransferPageWorkspace } from "../modules/transfer.js";

  let { active } = $props();
  const transferPageWorkspace = createTransferPageWorkspace();
  const { transferUploadDisplayStateStore } = transferPageWorkspace;
  let transferUploadDisplay = $derived($transferUploadDisplayStateStore);
  let transferUploadFields = $derived(
    transferUploadDisplay.transferUploadInputFields,
  );
</script>

<DashboardTabPanel {active}>
  <div class="grid gap-3">
    <Card.Root>
      <Card.Header>
        <Card.Title>
          {transferUploadDisplay.transferUploadCardDisplay.title}
        </Card.Title>
      </Card.Header>
      <Card.Content class="grid gap-2">
        <div class="grid gap-2 md:grid-cols-2">
          <PlainInputField
            value={transferUploadFields.localPath.value}
            aria-label={transferUploadFields.localPath.ariaLabelText}
            placeholderText={transferUploadFields.localPath.placeholder}
            onValueInput={transferPageWorkspace.updateLocalPath}
          />
          <PlainInputField
            value={transferUploadFields.remotePath.value}
            aria-label={transferUploadFields.remotePath.ariaLabelText}
            placeholderText={transferUploadFields.remotePath.placeholder}
            onValueInput={transferPageWorkspace.updateRemotePath}
          />
        </div>

        <div class="grid gap-2 md:grid-cols-2">
          <PlainInputField
            value={transferUploadFields.timeoutSecs.value}
            aria-label={transferUploadFields.timeoutSecs.ariaLabelText}
            placeholderText={transferUploadFields.timeoutSecs.placeholder}
            onValueInput={transferPageWorkspace.updateTimeoutSecs}
          />
          <PlainInputField
            value={transferUploadFields.bufferSize.value}
            aria-label={transferUploadFields.bufferSize.ariaLabelText}
            placeholderText={transferUploadFields.bufferSize.placeholder}
            onValueInput={transferPageWorkspace.updateBufferSize}
          />
        </div>

        <PlainCheckboxField
          checked={transferUploadFields.showProgress}
          labelText={transferUploadFields.showProgressLabel}
          title={transferUploadFields.showProgressLabel}
          onCheckedChange={transferPageWorkspace.updateShowProgress}
        />

        <div class="grid gap-2 md:grid-cols-[1fr_auto]">
          <div class="text-xs text-slate-500">
            {transferUploadDisplay.transferUploadCardDisplay.hint}
          </div>
          <LoadingButton
            variant="default"
            size="sm"
            loading={transferUploadDisplay.transferUploadRunButtonDisplay
              .uploadLoading}
            onclick={transferPageWorkspace.runUpload}
          >
            <span>
              {transferUploadDisplay.transferUploadRunButtonDisplay
                .uploadButtonLabel}
            </span>
          </LoadingButton>
        </div>
        <div class="grid gap-2">
          {#if transferUploadDisplay.transferUploadStatusDisplay.showStatus}
            <StatusCard
              message={transferUploadDisplay.transferUploadStatusDisplay
                .statusText}
              tone={transferUploadDisplay.transferUploadStatusDisplay
                .statusTone}
            />
          {/if}
        </div>
      </Card.Content>
    </Card.Root>
  </div>
</DashboardTabPanel>
