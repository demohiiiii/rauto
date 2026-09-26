import type { Snippet } from "svelte";
export const executionDockKey = Symbol("execution-dock");
export interface ExecutionDockContext {
  register(snippet: Snippet): () => void;
}
