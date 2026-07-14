<script>
  import { classNames } from "../../lib/ui.js";

  let {
    actions,
    children,
    class: className = "",
    contentClass = "",
    description = "",
    icon: Icon = null,
    indexText = "",
    title = "",
    variant = "section",
  } = $props();
</script>

{#if variant === "workbench-header"}
  <section class={classNames("min-w-0 border-b border-border", className)}>
    <header
      class="flex min-w-0 items-start justify-between gap-4 px-4 py-4 sm:px-6"
    >
      <div class="flex min-w-0 items-start gap-3">
        {#if Icon}
          <div
            class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/15"
          >
            <Icon class="size-4" />
          </div>
        {/if}
        <div class="min-w-0">
          <h3 class="text-sm font-semibold text-foreground">{title}</h3>
          {#if description}
            <p class="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              {description}
            </p>
          {/if}
        </div>
      </div>
      {#if actions}
        <div class="shrink-0">{@render actions()}</div>
      {/if}
    </header>

    {#if children}
      <div
        class={classNames(
          "grid min-w-0 gap-3 border-t border-border bg-muted/30 px-4 py-4 sm:px-6",
          contentClass,
        )}
      >
        {@render children()}
      </div>
    {/if}
  </section>
{:else if variant === "workbench-section"}
  <section
    class={classNames(
      "grid min-w-0 gap-4 border-b border-border px-4 py-5 last:border-b-0 sm:px-6 lg:grid-cols-[10rem_minmax(0,1fr)] lg:gap-6",
      className,
    )}
  >
    <header class="flex min-w-0 items-start gap-3">
      {#if indexText}
        <span
          class="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-semibold text-primary"
        >
          {indexText}
        </span>
      {:else if Icon}
        <div
          class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/15"
        >
          <Icon class="size-4" />
        </div>
      {/if}
      <div class="min-w-0">
        <h3 class="text-sm font-semibold text-foreground">{title}</h3>
        {#if description}
          <p class="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            {description}
          </p>
        {/if}
      </div>
    </header>

    <div class="grid min-w-0 gap-3">
      {#if actions}
        <div class="flex flex-wrap items-center justify-end gap-2">
          {@render actions()}
        </div>
      {/if}
      {#if children}
        <div class={classNames("grid min-w-0 gap-3", contentClass)}>
          {@render children()}
        </div>
      {/if}
    </div>
  </section>
{:else}
  <section class={classNames("grid min-w-0 gap-3", className)}>
    <div class="flex items-start justify-between gap-4">
      <div class="flex min-w-0 items-start gap-3">
        {#if Icon}
          <div
            class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/15"
          >
            <Icon class="size-4" />
          </div>
        {/if}
        <div class="min-w-0">
          <h3 class="text-sm font-semibold text-foreground">{title}</h3>
          {#if description}
            <p class="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              {description}
            </p>
          {/if}
        </div>
      </div>
      {#if actions}
        <div class="shrink-0">{@render actions()}</div>
      {/if}
    </div>

    {#if children}
      <div class={classNames("grid min-w-0 gap-3", contentClass)}>
        {@render children()}
      </div>
    {/if}
  </section>
{/if}
