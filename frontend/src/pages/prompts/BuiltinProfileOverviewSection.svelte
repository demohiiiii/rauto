<script>
  import BadgeInfoIcon from "@lucide/svelte/icons/badge-info";
  import Settings2Icon from "@lucide/svelte/icons/settings-2";
  import ReadonlyInputField from "../../components/fragments/ReadonlyInputField.svelte";
  import ReadonlyTextAreaField from "../../components/fragments/ReadonlyTextAreaField.svelte";

  let { profileDetail } = $props();
  let detailDisplay = $derived(profileDetail.detailDisplay);
  let metadataRows = $derived([
    {
      label: detailDisplay.fieldPlaceholders.name,
      value: profileDetail.name,
      mono: true,
    },
    {
      label: detailDisplay.fieldPlaceholders.aliases,
      value: profileDetail.aliases,
      mono: true,
    },
    {
      label: detailDisplay.fieldPlaceholders.summary,
      value: profileDetail.summary,
    },
    {
      label: detailDisplay.fieldPlaceholders.source,
      value: profileDetail.source,
      mono: true,
    },
  ]);
</script>

<section class="overflow-hidden rounded-lg border border-border bg-card/50">
  <header class="flex items-start gap-3 border-b border-border px-4 py-4">
    <div
      class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
    >
      <BadgeInfoIcon class="size-4" aria-hidden="true" />
    </div>
    <div class="min-w-0">
      <h3 class="text-sm font-semibold">{detailDisplay.overviewTitle}</h3>
      <p class="mt-1 text-xs leading-5 text-muted-foreground">
        {detailDisplay.overviewDescription}
      </p>
    </div>
  </header>

  <div class="grid gap-3 p-4 sm:grid-cols-2">
    {#each metadataRows as metadataRow (metadataRow.label)}
      <label class="grid min-w-0 gap-2 text-xs font-medium">
        <span>{metadataRow.label}</span>
        <ReadonlyInputField
          class={metadataRow.mono ? "font-mono" : ""}
          value={metadataRow.value || "-"}
        />
      </label>
    {/each}

    {#if profileDetail.notes}
      <label class="grid min-w-0 gap-2 text-xs font-medium sm:col-span-2">
        <span>{detailDisplay.notesPlaceholder}</span>
        <ReadonlyTextAreaField class="min-h-24" value={profileDetail.notes} />
      </label>
    {/if}
  </div>
</section>

<section class="overflow-hidden rounded-lg border border-border bg-card/50">
  <header class="flex items-start gap-3 border-b border-border px-4 py-4">
    <div
      class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
    >
      <Settings2Icon class="size-4" aria-hidden="true" />
    </div>
    <div class="min-w-0">
      <h3 class="text-sm font-semibold">
        {detailDisplay.commandExecutionTitle}
      </h3>
      <p class="mt-1 text-xs leading-5 text-muted-foreground">
        {detailDisplay.readonlyHint}
      </p>
    </div>
  </header>
  <div class="grid gap-3 p-4 md:max-w-2xl md:grid-cols-2">
    <ReadonlyInputField value={profileDetail.commandExecution.mode || "-"} />
    {#if profileDetail.commandExecution.showShellExitMarker}
      <ReadonlyInputField
        class="font-mono"
        placeholderText={detailDisplay.commandExecutionMarkerPlaceholder}
        value={profileDetail.commandExecution.marker || "-"}
      />
    {/if}
  </div>
</section>
