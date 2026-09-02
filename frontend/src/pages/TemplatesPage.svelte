<script lang="ts">
  import TemplateManagerWorkspace from "$domains/templates/presentation/components/TemplateManagerWorkspace.svelte";
  import DashboardTabPanel from "$components/layout/DashboardTabPanel.svelte";

  let { active }: { active: boolean } = $props();
</script>

<DashboardTabPanel {active}>
  <TemplateManagerWorkspace {active} />
</DashboardTabPanel>
