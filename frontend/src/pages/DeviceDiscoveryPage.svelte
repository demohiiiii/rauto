<script lang="ts">
  import * as Card from "$lib/components/ui/card";
  import DashboardTabPanel from "../components/layout/DashboardTabPanel.svelte";
  import DeviceDiscoveryPanel from "./inventory/DeviceDiscoveryPanel.svelte";

  let { active }: { active: boolean } = $props();
</script>

<DashboardTabPanel {active}>
  <Card.Root class="gap-0 overflow-hidden border-border/80 py-0 shadow-sm">
    <Card.Content class="p-4 sm:p-5 lg:p-6">
      <DeviceDiscoveryPanel {active} />
    </Card.Content>
  </Card.Root>
</DashboardTabPanel>
