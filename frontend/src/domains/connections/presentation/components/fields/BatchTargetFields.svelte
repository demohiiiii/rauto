<script lang="ts">
  import { Input } from "$lib/components/ui/input/index.js";
  import ConnectionPickerField from "./ConnectionPickerField.svelte";

  interface Props {
    active?: boolean;
    title: string;
    hint: string;
    fields: readonly {
      key: string;
      keyName: string;
      labelText: string;
      pickerPlaceholder: string;
    }[];
    maxParallel: string;
    maxParallelLabel: string;
    onMaxParallelChange: (value: string) => void;
    onSelectionChange?: (values: string[]) => void;
  }

  let {
    active = true,
    title,
    hint,
    fields,
    maxParallel,
    maxParallelLabel,
    onMaxParallelChange,
    onSelectionChange,
  }: Props = $props();
</script>

<section class="grid min-w-0 gap-3" aria-label={title}>
  <div class="flex min-w-0 flex-wrap items-end justify-between gap-3">
    <div class="min-w-0">
      <h3 class="text-sm font-semibold text-foreground">{title}</h3>
      <p class="mt-0.5 text-xs leading-relaxed text-muted-foreground">{hint}</p>
    </div>
    <label class="flex items-center gap-2 text-xs text-muted-foreground">
      {maxParallelLabel}
      <Input
        type="number"
        min="1"
        step="1"
        placeholder="4"
        class="h-8 w-20"
        value={maxParallel}
        oninput={(event) => onMaxParallelChange(event.currentTarget.value)}
      />
    </label>
  </div>
  <div class="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3">
    {#each fields as field (field.key)}
      <ConnectionPickerField
        {active}
        keyName={field.keyName}
        labelText={field.labelText}
        pickerPlaceholder={field.pickerPlaceholder}
        {onSelectionChange}
      />
    {/each}
  </div>
</section>
