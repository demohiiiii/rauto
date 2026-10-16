<script lang="ts">
  import LoaderCircleIcon from "@lucide/svelte/icons/loader-circle";
  import { connectionSession } from "../../application/connectionSessionState.js";
  import type { ConnectionSessionState } from "../../model/types.js";
  import { connectionSessionPresentation } from "../connectionSessionDisplay.js";
  import { currentLanguageState } from "$lib/i18n.js";
  import { cn } from "$lib/utils.js";

  let {
    compact = false,
    session,
  }: {
    compact?: boolean;
    session?: Pick<ConnectionSessionState, "status" | "error">;
  } = $props();
  const { state: sessionState } = connectionSession;
  let display = $derived.by(() => {
    $currentLanguageState;
    return connectionSessionPresentation(session ?? $sessionState);
  });
</script>

<span
  class={cn(
    "inline-flex items-center gap-1.5 rounded-full text-xs font-medium",
    compact
      ? "bg-card p-0.5 ring-2 ring-card"
      : "border border-border bg-background/70 px-2.5 py-1",
    display.colorClass,
  )}
  title={display.error || display.label}
  role="status"
  aria-label={display.label}
>
  {#if display.status === "connecting"}
    <LoaderCircleIcon
      class={cn(
        "animate-spin motion-reduce:animate-none",
        compact ? "size-2.5" : "size-3",
      )}
      aria-hidden="true"
    />
  {:else}
    <span
      class={cn("size-1.5 rounded-full bg-current", compact && "size-2")}
      aria-hidden="true"
    ></span>
  {/if}
  {#if !compact}{display.label}{/if}
</span>
