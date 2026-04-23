import { Effect, Layer, Context } from "effect";
import { SheetApisClient } from "./sheetApis";

export class RoomOrderService extends Context.Service<RoomOrderService>()("RoomOrderService", {
  make: Effect.gen(function* () {
    const sheetApisClient = yield* SheetApisClient;

    return {
      generate: Effect.fn("RoomOrderService.generate")(function* (payload: {
        guildId: string;
        channelId?: string | undefined;
        channelName?: string | undefined;
        hour?: number | undefined;
        healNeeded?: number | undefined;
      }) {
        return yield* sheetApisClient.get().roomOrder.generate({
          payload,
        });
      }),
    };
  }),
}) {
  static layer = Layer.effect(RoomOrderService, this.make).pipe(
    Layer.provide(SheetApisClient.layer),
  );
}
