<script>
  import { classNames } from "../../lib/ui.js";

  let {
    actions,
    children,
    class: className = "",
    contentClass = "",
    description = "",
    icon: Icon = null,
    title = "",
  } = $props();
</script>

<section class={classNames("grid gap-3", className)}>
  <div class="flex items-start justify-between gap-4">
    <div class="flex min-w-0 items-start gap-3">
      {#if Icon}
        <div
          class="flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15"
        >
          <Icon class="size-4" />
        </div>
      {/if}
      <div class="min-w-0">
        <h3 class="text-sm font-semibold text-card-foreground">{title}</h3>
        {#if description}
          <p class="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            {description}
          </p>
        {/if}
      </div>
    </div>
    {#if actions}
      <div class="shrink-0">
        {@render actions()}
      </div>
    {/if}
  </div>
  {#if children}
    <div class={classNames("grid gap-3", contentClass)}>
      {@render children()}
    </div>
  {/if}
</section>
