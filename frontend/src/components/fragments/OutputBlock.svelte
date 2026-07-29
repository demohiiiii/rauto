<script>
  import * as Card from "$lib/components/ui/card";
  import * as ScrollArea from "$lib/components/ui/scroll-area";
  import { cn } from "$lib/utils.js";
  import CircleXIcon from "@lucide/svelte/icons/circle-x";

  let {
    children,
    class: className = "",
    contentClass = "",
    errorLabel = "Error",
    hidden = false,
    tag = "pre",
    title = "Output",
    tone = "default",
  } = $props();

  let failed = $derived(tone === "error");
  let rootClass = $derived(
    cn(
      "box-border min-w-0 max-w-full gap-0 overflow-hidden rounded-xl border-zinc-800 bg-zinc-950 py-0 text-zinc-100 shadow-[0_18px_50px_-28px_rgba(0,0,0,0.85)]",
      failed && "border-destructive ring-1 ring-destructive/30",
      className,
    ),
  );
  let headerClass = $derived(
    cn(
      "terminal-output flex h-9 flex-row items-center gap-2 border-b border-white/10 bg-zinc-900/95 px-3 py-0 text-zinc-400 [.border-b]:pb-0",
      failed && "border-destructive/50 bg-destructive/15",
    ),
  );
  let bodyClass = $derived(
    cn(
      "min-w-max p-3 font-mono text-xs leading-5 text-zinc-100 selection:bg-primary/30 selection:text-primary-foreground",
      tag === "pre" && "whitespace-pre",
      contentClass,
    ),
  );
</script>

<Card.Root class={rootClass} {hidden} aria-label={title} aria-invalid={failed}>
  <Card.Header class={headerClass}>
    <span class="flex items-center gap-1.5" aria-hidden="true">
      <span class="size-2.5 rounded-full bg-red-500/90"></span>
      <span class="size-2.5 rounded-full bg-amber-400/90"></span>
      <span class="size-2.5 rounded-full bg-emerald-500/90"></span>
    </span>
    <span
      class="min-w-0 truncate font-mono text-[11px] font-medium tracking-[0.12em] text-zinc-300"
    >
      {title}
    </span>
    {#if failed}
      <span
        class="ml-auto flex shrink-0 items-center gap-1 text-xs font-semibold text-destructive"
      >
        <CircleXIcon class="size-4" aria-hidden="true" />
        {errorLabel}
      </span>
    {/if}
  </Card.Header>
  <Card.Content class="p-0">
    <ScrollArea.Root
      class="max-h-[28rem] bg-zinc-950 [&_[data-slot=scroll-area-viewport]]:max-h-[28rem] [&_[data-slot=scroll-area-viewport]]:overflow-x-hidden [&_[data-slot=scroll-area-viewport]]:overflow-y-auto"
      orientation="vertical"
    >
      <div class="max-w-full overflow-x-auto">
        <svelte:element this={tag} class={bodyClass}>
          {@render children?.()}
        </svelte:element>
      </div>
    </ScrollArea.Root>
  </Card.Content>
</Card.Root>
