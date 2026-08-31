<script lang="ts">
  import type { Snippet } from "svelte";

  interface DashboardTabPanelProps {
    active: boolean;
    children: Snippet;
  }

  let { active, children }: DashboardTabPanelProps = $props();
</script>

<div class="tab-panel" role="tabpanel" hidden={!active}>
  {@render children()}
</div>
