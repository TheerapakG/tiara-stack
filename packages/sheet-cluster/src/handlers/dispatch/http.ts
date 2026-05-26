import { Layer } from "effect";
import { WorkflowProxyServer } from "effect/unstable/workflow";
import { dispatchWorkflowLayer } from "@/workflows/dispatch";
import { DispatchWorkflows } from "@/workflows/dispatchWorkflows";

export const dispatchLayer = WorkflowProxyServer.layerRpcHandlers(DispatchWorkflows).pipe(
  Layer.provide(dispatchWorkflowLayer),
);
