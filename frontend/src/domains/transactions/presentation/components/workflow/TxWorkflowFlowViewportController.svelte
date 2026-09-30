<script lang="ts">
  import { useSvelteFlow } from "@xyflow/svelte";

  interface Props {
    compact?: boolean;
    focusNodeId?: string;
    endNodeId?: string;
    inspectorOpen?: boolean;
    inspectorWidth?: number;
  }

  let {
    compact = false,
    focusNodeId = "workflow-root",
    endNodeId = "",
    inspectorOpen = true,
    inspectorWidth = 560,
  }: Props = $props();

  const { getNode, setCenter } = useSvelteFlow();

  $effect(() => {
    const nextNodeId = focusNodeId;
    const nextEndNodeId = endNodeId;
    const nextCompact = compact;
    const nextInspectorOpen = inspectorOpen;
    const nextInspectorWidth = inspectorWidth;
    const focusTimer = window.setTimeout(() => {
      const node = getNode(nextNodeId);
      if (!node) return;
      const nodeWidth = node.measured?.width || node.width || 320;
      const nodeHeight = node.measured?.height || node.height || 160;
      const endNode = nextEndNodeId ? getNode(nextEndNodeId) : undefined;
      const focusWidth = endNode
        ? Math.max(
            nodeWidth,
            endNode.position.x + (endNode.width || 44) - node.position.x,
          )
        : nodeWidth;
      const focusHeight = endNode
        ? Math.max(
            nodeHeight,
            endNode.position.y + (endNode.height || 44) - node.position.y,
          )
        : nodeHeight;
      const zoom = nextCompact ? 0.82 : 0.9;
      const inspectorOffset =
        !nextCompact && nextInspectorOpen ? nextInspectorWidth / (2 * zoom) : 0;
      setCenter(
        node.position.x + focusWidth / 2 + inspectorOffset,
        node.position.y + focusHeight / 2,
        { zoom, duration: 240 },
      );
    }, 80);

    return () => window.clearTimeout(focusTimer);
  });
</script>
