<script lang="ts">
  import { setContext, type Snippet } from "svelte";
  import type { ExecutionHistoryFunction } from "$domains/execution/index.js";
  import ExecutionResultsBottomSheet from "./ExecutionResultsBottomSheet.svelte";
  import {
    executionDockKey,
    type ExecutionDockContext,
  } from "./executionDockContext.js";

  let {
    active,
    feature,
    children,
  }: {
    active: boolean;
    feature: ExecutionHistoryFunction;
    children: Snippet;
  } = $props();
  let root = $state<HTMLElement | null>(null);
  let dockElement = $state<HTMLElement | null>(null);
  let runBar = $state<Snippet | null>(null);
  setContext<ExecutionDockContext>(executionDockKey, {
    register(snippet) {
      runBar = snippet;
      return () => {
        if (runBar === snippet) runBar = null;
      };
    },
  });

  $effect(() => {
    if (!active || !root) return;
    const element = root;
    const bar = dockElement;
    let frame = 0;
    const measure = () => {
      const rect = element.getBoundingClientRect();
      if (bar)
        element.style.setProperty(
          "--execution-dock-height",
          bar.getBoundingClientRect().height + "px",
        );
      element.style.setProperty("--execution-card-left", rect.left + "px");
      element.style.setProperty(
        "--execution-card-right",
        Math.max(0, document.documentElement.clientWidth - rect.right) + "px",
      );
    };
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    measure();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    if (bar) observer.observe(bar);
    // The centered card may keep its width while its parent and position change.
    if (element.parentElement) observer.observe(element.parentElement);
    const shell = element.closest("[data-dashboard-shell]");
    if (shell) observer.observe(shell);
    const main = element.closest("main");
    if (main) observer.observe(main);
    shell?.addEventListener("transitionend", update);
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      shell?.removeEventListener("transitionend", update);
      window.removeEventListener("resize", update);
    };
  });
</script>

<div
  bind:this={root}
  data-execution-dock
  class="grid min-w-0 gap-3"
  style="padding-bottom: calc(var(--execution-dock-height, 10rem) + 1rem);"
>
  {@render children()}
  {#if active}
    <div
      bind:this={dockElement}
      data-execution-dock-bar
      class="pointer-events-none fixed bottom-4 z-40 flex flex-col gap-3 lg:flex-row lg:items-start"
      style="left: var(--execution-card-left, 2rem); right: var(--execution-card-right, 2rem);"
    >
      <div class="pointer-events-auto min-w-0 flex-1">
        <ExecutionResultsBottomSheet {active} {feature} />
      </div>
      {#if runBar}<div
          class="pointer-events-auto flex min-w-0 shrink-0 justify-end lg:max-w-[70%]"
        >
          {@render runBar()}
        </div>{/if}
    </div>
  {/if}
</div>
