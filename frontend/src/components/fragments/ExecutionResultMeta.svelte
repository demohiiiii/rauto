<script lang="ts">
  import DetailFieldCard from "./DetailFieldCard.svelte";

  interface ExecutionMetaField {
    label: string;
    mono?: boolean;
    value?: boolean | number | string | null;
  }

  interface Props {
    fields?: ExecutionMetaField[];
  }

  let { fields = [] }: Props = $props();
</script>

{#if fields.length}
  <div
    class="flex min-w-0 flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-border bg-muted/30 px-4 py-3"
  >
    {#each fields as field}
      <DetailFieldCard
        detailValue={field.value}
        label={field.label}
        mono={field.mono}
        variant="inline"
        class="text-muted-foreground"
        labelClass="text-muted-foreground/70"
        valueClass={field.mono
          ? "break-all font-mono font-medium text-foreground"
          : "break-all font-medium text-foreground"}
      />
    {/each}
  </div>
{/if}
