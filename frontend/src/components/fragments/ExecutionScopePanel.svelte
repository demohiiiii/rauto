<script lang="ts">
  import type { Snippet } from "svelte";
  import type { LucideIcon } from "@lucide/svelte";
  import * as Card from "$lib/components/ui/card/index.js";
  import { executionScopeTabs } from "$config/dashboardModes.js";
  import TabList from "./TabList.svelte";
  import WorkspaceActionHeader from "./WorkspaceActionHeader.svelte";

  interface Props {
    title: string;
    description: string;
    icon: LucideIcon;
    activeValue: string;
    ariaLabel?: string;
    onSelect: (value: string) => void;
    children: Snippet;
  }

  let {
    title,
    description,
    icon,
    activeValue,
    ariaLabel,
    onSelect,
    children,
  }: Props = $props();
</script>

<Card.Root
  class="min-w-0 max-w-full gap-0 overflow-clip border-border/80 py-0 shadow-sm"
>
  <WorkspaceActionHeader {title} {description} {icon}>
    {#snippet actions()}
      <TabList
        tabItems={executionScopeTabs}
        {activeValue}
        aria-label={ariaLabel ?? title}
        themeAware={true}
        {onSelect}
      />
    {/snippet}
  </WorkspaceActionHeader>
  <Card.Content class="grid min-w-0 p-0">
    {@render children()}
  </Card.Content>
</Card.Root>
