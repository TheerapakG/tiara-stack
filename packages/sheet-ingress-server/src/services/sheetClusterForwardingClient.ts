import { Context, Effect, Layer } from "effect";
import { DispatchWorkflowOperations } from "sheet-ingress-api/sheet-cluster-workflows";
import { SheetClusterRpcClient } from "./sheetClusterRpcClient";

type DispatchWorkflowOperation =
  (typeof DispatchWorkflowOperations)[keyof typeof DispatchWorkflowOperations];

export class SheetClusterForwardingClient extends Context.Service<SheetClusterForwardingClient>()(
  "SheetClusterForwardingClient",
  {
    make: Effect.gen(function* () {
      const rpcClient = yield* SheetClusterRpcClient;

      const accept =
        <const TOperation extends DispatchWorkflowOperation, E, R>(
          operation: TOperation,
          fn: (
            args: TOperation["workflow"]["payloadSchema"]["~type.make.in"],
          ) => Effect.Effect<void, E, R>,
        ) =>
        (args: TOperation["workflow"]["payloadSchema"]["~type.make.in"]) =>
          Effect.gen(function* () {
            const executionIdFor = operation.workflow.executionId as (
              payload: TOperation["workflow"]["payloadSchema"]["~type.make.in"],
            ) => Effect.Effect<string>;
            const executionId = yield* executionIdFor(args);
            yield* fn(args);
            return {
              executionId,
              operation: operation.operation,
              status: "accepted" as const,
            };
          });

      return {
        dispatch: {
          checkin: accept(DispatchWorkflowOperations.checkin, (args) =>
            rpcClient[DispatchWorkflowOperations.checkin.discardRpcTag](args, { discard: true }),
          ),
          checkinButton: accept(DispatchWorkflowOperations.checkinButton, (args) =>
            rpcClient[DispatchWorkflowOperations.checkinButton.discardRpcTag](args, {
              discard: true,
            }),
          ),
          roomOrder: accept(DispatchWorkflowOperations.roomOrder, (args) =>
            rpcClient[DispatchWorkflowOperations.roomOrder.discardRpcTag](args, { discard: true }),
          ),
          kickout: accept(DispatchWorkflowOperations.kickout, (args) =>
            rpcClient[DispatchWorkflowOperations.kickout.discardRpcTag](args, { discard: true }),
          ),
          slotButton: accept(DispatchWorkflowOperations.slotButton, (args) =>
            rpcClient[DispatchWorkflowOperations.slotButton.discardRpcTag](args, {
              discard: true,
            }),
          ),
          slotList: accept(DispatchWorkflowOperations.slotList, (args) =>
            rpcClient[DispatchWorkflowOperations.slotList.discardRpcTag](args, { discard: true }),
          ),
          slotOpenButton: accept(DispatchWorkflowOperations.slotOpenButton, (args) =>
            rpcClient[DispatchWorkflowOperations.slotOpenButton.discardRpcTag](args, {
              discard: true,
            }),
          ),
          serviceStatus: accept(DispatchWorkflowOperations.serviceStatus, (args) =>
            rpcClient[DispatchWorkflowOperations.serviceStatus.discardRpcTag](args, {
              discard: true,
            }),
          ),
          [DispatchWorkflowOperations.roomOrderPreviousButton.endpointName]: accept(
            DispatchWorkflowOperations.roomOrderPreviousButton,
            (args) =>
              rpcClient[DispatchWorkflowOperations.roomOrderPreviousButton.discardRpcTag](args, {
                discard: true,
              }),
          ),
          [DispatchWorkflowOperations.roomOrderNextButton.endpointName]: accept(
            DispatchWorkflowOperations.roomOrderNextButton,
            (args) =>
              rpcClient[DispatchWorkflowOperations.roomOrderNextButton.discardRpcTag](args, {
                discard: true,
              }),
          ),
          [DispatchWorkflowOperations.roomOrderSendButton.endpointName]: accept(
            DispatchWorkflowOperations.roomOrderSendButton,
            (args) =>
              rpcClient[DispatchWorkflowOperations.roomOrderSendButton.discardRpcTag](args, {
                discard: true,
              }),
          ),
          [DispatchWorkflowOperations.roomOrderPinTentativeButton.endpointName]: accept(
            DispatchWorkflowOperations.roomOrderPinTentativeButton,
            (args) =>
              rpcClient[DispatchWorkflowOperations.roomOrderPinTentativeButton.discardRpcTag](
                args,
                { discard: true },
              ),
          ),
        },
      };
    }),
  },
) {
  static layer = Layer.effect(SheetClusterForwardingClient, this.make).pipe(
    Layer.provide(SheetClusterRpcClient.layer),
  );
}
