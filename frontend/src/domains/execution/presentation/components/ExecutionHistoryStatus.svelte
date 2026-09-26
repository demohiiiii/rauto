<script lang="ts">
  import LoaderCircle from "@lucide/svelte/icons/loader-circle";
  import CircleCheck from "@lucide/svelte/icons/circle-check";
  import CircleX from "@lucide/svelte/icons/circle-x";
  import CircleAlert from "@lucide/svelte/icons/circle-alert";
  import type { ExecutionHistoryStatus } from "../../model/executionHistory.js";
  import { t, currentLanguageState } from "$lib/i18n.js";
  let { status }: { status: ExecutionHistoryStatus } = $props();
  let label = $derived.by(() => {
    $currentLanguageState;
    return t(
      status === "running"
        ? "running"
        : status === "success"
          ? "orchestrationStatusSuccess"
          : status === "interrupted"
            ? "executionHistoryInterrupted"
            : status === "warning"
              ? "executionHistoryPartial"
              : "orchestrationStatusFailed",
    );
  });
</script>

<span
  class="flex size-8 shrink-0 items-center justify-center rounded-full bg-background ring-1 ring-border/70"
  title={label}
  role="status"
  aria-label={label}
>
  {#key status}
    {#if status === "running"}<LoaderCircle
        class="size-4 animate-spin text-primary motion-reduce:animate-none"
        aria-hidden="true"
      />
    {:else if status === "success"}<CircleCheck
        class="size-4 animate-in zoom-in-75 text-emerald-500 duration-300"
        aria-hidden="true"
      />
    {:else if status === "error"}<CircleX
        class="size-4 animate-in zoom-in-75 text-destructive duration-300"
        aria-hidden="true"
      />
    {:else}<CircleAlert class="size-4 text-amber-500" aria-hidden="true" />{/if}
  {/key}
</span>
