<script lang="ts">
  import { untrack } from "svelte";
  import { BatchTargetFields } from "$domains/connections/presentation/components/fields/index.js";
  import {
    batchExecTargetPickerFields,
    batchInteractiveTargetPickerFields,
  } from "$domains/connections/index.js";
  import { currentLanguageState, t } from "$lib/i18n.js";
  import type { BatchDeliveryWorkspace } from "../../../application/createBatchDeliveryWorkspace.js";

  let { workspace }: { workspace: BatchDeliveryWorkspace } = $props();
  const { maxParallelStore } = untrack(() => workspace);
  let display = $derived.by(() => {
    $currentLanguageState;
    const fields =
      workspace.kind === "command"
        ? batchExecTargetPickerFields
        : batchInteractiveTargetPickerFields;
    return {
      title: t("batchDeliveryTargetsTitle"),
      hint: t("batchExecFooterHint"),
      maxParallelLabel: t("batchExecMaxParallelLabel"),
      fields: fields.map((field) => ({
        ...field,
        labelText: t(field.labelKey),
        pickerPlaceholder: t(field.placeholderKey),
      })),
    };
  });
</script>

<BatchTargetFields
  {...display}
  maxParallel={$maxParallelStore}
  onMaxParallelChange={maxParallelStore.set}
/>
