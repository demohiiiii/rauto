<script>
  import { useSvelteFlow } from "@xyflow/svelte";

  let {
    compact = false,
    focusNodeId = "",
    layoutRevision = "",
    inspectorOpen = true,
    inspectorWidth = 520,
    topWindowOpen = false,
  } = $props();

  const { getNode, setCenter } = useSvelteFlow();

  $effect(() => {
    const nextNodeId = focusNodeId;
    const nextLayoutRevision = layoutRevision;
    const nextCompact = compact;
    const nextInspectorOpen = inspectorOpen;
    const nextInspectorWidth = inspectorWidth;
    const nextTopWindowOpen = topWindowOpen;
    if (!nextNodeId || nextLayoutRevision == null) return;

    const focusTimer = window.setTimeout(() => {
      const node = getNode(nextNodeId);
      if (!node) return;
      const nodeWidth = node.measured?.width || node.width || 320;
      const nodeHeight = node.measured?.height || node.height || 220;
      const zoom = nextCompact ? 0.78 : 0.88;
      const inspectorOffset =
        !nextCompact && nextInspectorOpen ? nextInspectorWidth / (2 * zoom) : 0;
      const topOffset = nextTopWindowOpen
        ? (nextCompact ? 112 : 144) / zoom
        : 0;
      setCenter(
        node.position.x + nodeWidth / 2 + inspectorOffset,
        node.position.y + nodeHeight / 2 - topOffset,
        { zoom, duration: 240 },
      );
    }, 80);

    return () => window.clearTimeout(focusTimer);
  });
</script>
