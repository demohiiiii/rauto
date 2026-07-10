<script>
  import * as Card from "$lib/components/ui/card";
  import * as ScrollArea from "$lib/components/ui/scroll-area";
  import { cn } from "$lib/utils.js";

  let {
    children,
    class: className = "",
    contentClass = "",
    hidden = false,
    tag = "pre",
    title = "Output",
  } = $props();

  let rootClass = $derived(
    cn(
      "box-border min-w-0 max-w-full gap-0 overflow-hidden rounded-xl border-zinc-800 bg-zinc-950 py-0 text-zinc-100 shadow-[0_18px_50px_-28px_rgba(0,0,0,0.85)]",
      className,
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

<Card.Root class={rootClass} {hidden} aria-label={title}>
  <Card.Header
    class="terminal-output flex h-9 flex-row items-center gap-2 border-b border-white/10 bg-zinc-900/95 px-3 py-0 text-zinc-400 [.border-b]:pb-0"
  >
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
