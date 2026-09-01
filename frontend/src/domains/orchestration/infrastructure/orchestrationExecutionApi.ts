import {
  executeOrchestration as executeOrchestrationRequest,
  executeTxBlock as executeTxBlockRequest,
  executeTxWorkflow as executeTxWorkflowRequest,
} from "../../../api/client.js";

type ExecutionRequest = (payload: unknown) => Promise<unknown>;

export const executeOrchestration =
  executeOrchestrationRequest as unknown as ExecutionRequest;
export const executeTxBlock =
  executeTxBlockRequest as unknown as ExecutionRequest;
export const executeTxWorkflow =
  executeTxWorkflowRequest as unknown as ExecutionRequest;
