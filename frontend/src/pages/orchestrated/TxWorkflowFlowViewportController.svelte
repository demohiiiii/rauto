<script>
  import { useSvelteFlow } from "@xyflow/svelte";

  let {
    compact = false,
    focusNodeId = "workflow-root",
    inspectorOpen = true,
    inspectorWidth = 560,
  } = $props();

  const { getNode, setCenter } = useSvelteFlow();

  $effect(() => {
    const nextNodeId = focusNodeId;
    const nextCompact = compact;
    const nextInspectorOpen = inspectorOpen;
    const nextInspectorWidth = inspectorWidth;
    const focusTimer = window.setTimeout(() => {
      const node = getNode(nextNodeId);
      if (!node) return;
      const nodeWidth = node.measured?.width || node.width || 320;
      const nodeHeight = node.measured?.height || node.height || 160;
      const zoom = nextCompact ? 0.82 : 0.9;
      const inspectorOffset =
        !nextCompact && nextInspectorOpen ? nextInspectorWidth / (2 * zoom) : 0;
      setCenter(
        node.position.x + nodeWidth / 2 + inspectorOffset,
        node.position.y + nodeHeight / 2,
        { zoom, duration: 240 },
      );
    }, 80);

    return () => window.clearTimeout(focusTimer);
  });
</script>
