<script lang="ts">
  import SchedulesWorkspace from "$domains/schedules/presentation/components/SchedulesWorkspace.svelte";

  let { active }: { active: boolean } = $props();
</script>

<SchedulesWorkspace {active} />
