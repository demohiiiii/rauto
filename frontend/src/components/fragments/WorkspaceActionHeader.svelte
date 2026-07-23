<script>
  import * as Card from "$lib/components/ui/card/index.js";
  import { cn } from "$lib/utils.js";

  let {
    actions,
    class: className = "",
    description = "",
    icon = null,
    status,
    title = "",
    titleId = undefined,
  } = $props();
</script>

<Card.Header
  class={cn(
    "border-b border-primary/15 bg-primary/[0.035] p-4 sm:p-5",
    className,
  )}
>
  <div class="flex min-w-0 flex-wrap items-start justify-between gap-4">
    <div class="flex min-w-0 items-start gap-3">
      {#if icon}
        {@const HeaderIcon = icon}
        <span
          class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-inset ring-primary/15"
          aria-hidden="true"
        >
          <HeaderIcon class="size-5" />
        </span>
      {/if}
      <div class="min-w-0 space-y-2">
        <div class="space-y-1">
          <Card.Title id={titleId}>{title}</Card.Title>
        </div>
        {#if description}
          <Card.Description>{description}</Card.Description>
        {/if}
      </div>
      {#if status}
        <div class="flex min-w-0 flex-wrap items-center gap-2">
          {@render status()}
        </div>
      {/if}
    </div>

    {#if actions}
      <div class="flex min-w-0 flex-wrap items-center gap-2 sm:justify-end">
        {@render actions()}
      </div>
    {/if}
  </div>
</Card.Header>
