import { Context, Effect, Layer } from "effect";
import type { WorkflowProxyServer } from "effect/unstable/workflow";
import { DispatchWorkflows } from "@/workflows/dispatchWorkflows";

type DispatchWorkflow = (typeof DispatchWorkflows)[number];
type DispatchWorkflowPayload<TWorkflow extends DispatchWorkflow> =
  TWorkflow["payloadSchema"]["Type"];

type DispatchRpcHandler = {
  readonly context: Context.Context<never>;
  readonly tag: string;
  readonly handler: (payload: never) => Effect.Effect<unknown, unknown, never>;
};

const dispatchRpcHandlers = <TWorkflow extends DispatchWorkflow>(
  workflow: TWorkflow,
  context: Context.Context<never>,
) => {
  const execute = workflow.execute as unknown as (
    payload: DispatchWorkflowPayload<TWorkflow>,
    options?: { readonly discard?: boolean },
  ) => Effect.Effect<unknown, unknown, never>;
  const resume = workflow.resume as unknown as (
    executionId: string,
  ) => Effect.Effect<unknown, unknown, never>;

  return [
    {
      key: `effect/rpc/Rpc/${workflow.name}`,
      value: {
        context,
        tag: workflow.name,
        handler: (payload: DispatchWorkflowPayload<TWorkflow>) => execute(payload),
      },
    },
    {
      key: `effect/rpc/Rpc/${workflow.name}Discard`,
      value: {
        context,
        tag: `${workflow.name}Discard`,
        handler: (payload: DispatchWorkflowPayload<TWorkflow>) =>
          execute(payload, { discard: true }),
      },
    },
    {
      key: `effect/rpc/Rpc/${workflow.name}Resume`,
      value: {
        context,
        tag: `${workflow.name}Resume`,
        handler: (payload: { readonly executionId: string }) => resume(payload.executionId),
      },
    },
  ] as const;
};

type DispatchLayer = ReturnType<
  typeof WorkflowProxyServer.layerRpcHandlers<typeof DispatchWorkflows>
>;

export const dispatchLayer = Layer.effectContext(
  Effect.gen(function* () {
    const context = yield* Effect.context<never>();
    const handlers = new Map<string, DispatchRpcHandler>();

    for (const workflow of DispatchWorkflows) {
      for (const { key, value } of dispatchRpcHandlers(workflow, context)) {
        handlers.set(key, value as unknown as DispatchRpcHandler);
      }
    }

    return Context.makeUnsafe(handlers);
  }),
) as unknown as DispatchLayer;
