<script lang="ts">
  import ConfigHistoryWorkspace from "$domains/config-history/presentation/components/ConfigHistoryWorkspace.svelte";
  import DashboardTabPanel from "$components/layout/DashboardTabPanel.svelte";

  let { active }: { active: boolean } = $props();
</script>

<DashboardTabPanel {active}>
  <ConfigHistoryWorkspace {active} />
</DashboardTabPanel>
