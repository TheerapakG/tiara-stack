import { Context, Effect, Layer } from "effect";
import { DispatchRoomOrderButtonMethods } from "sheet-ingress-api/sheet-apis-rpc";
import { SheetClusterRpcClient } from "./sheetClusterRpcClient";

export class SheetClusterForwardingClient extends Context.Service<SheetClusterForwardingClient>()(
  "SheetClusterForwardingClient",
  {
    make: Effect.gen(function* () {
      const rpcClient = yield* SheetClusterRpcClient;

      const call =
        <Input, A, E, R>(fn: (args: Input) => Effect.Effect<A, E, R>) =>
        (args: Input) =>
          fn(args);

      return {
        dispatch: {
          checkin: call(rpcClient["dispatch.checkin"]),
          checkinButton: call(rpcClient["dispatch.checkinButton"]),
          roomOrder: call(rpcClient["dispatch.roomOrder"]),
          [DispatchRoomOrderButtonMethods.previous.endpointName]: call(
            rpcClient[DispatchRoomOrderButtonMethods.previous.rpcTag],
          ),
          [DispatchRoomOrderButtonMethods.next.endpointName]: call(
            rpcClient[DispatchRoomOrderButtonMethods.next.rpcTag],
          ),
          [DispatchRoomOrderButtonMethods.send.endpointName]: call(
            rpcClient[DispatchRoomOrderButtonMethods.send.rpcTag],
          ),
          [DispatchRoomOrderButtonMethods.pinTentative.endpointName]: call(
            rpcClient[DispatchRoomOrderButtonMethods.pinTentative.rpcTag],
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
