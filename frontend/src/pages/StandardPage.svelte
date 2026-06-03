<script>
  import StandardDeliveryPanel from "../components/StandardDeliveryPanel.svelte";

  let { active = false } = $props();
</script>

<StandardDeliveryPanel {active} />
