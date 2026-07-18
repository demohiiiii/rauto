<script>
  import * as Card from "$lib/components/ui/card/index.js";

  let { actions, description = "", status, title = "" } = $props();
</script>

<Card.Header class="border-b border-primary/15 bg-primary/[0.035] p-4 sm:p-5">
  <div class="flex min-w-0 flex-wrap items-start justify-between gap-4">
    <div class="min-w-0 space-y-2">
      <div class="space-y-1">
        <Card.Title>{title}</Card.Title>
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
