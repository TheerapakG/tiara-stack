import { Effect, Layer, Context } from "effect";
import { SheetApisClient } from "./sheetApis";

export class CheckinService extends Context.Service<CheckinService>()("CheckinService", {
  make: Effect.gen(function* () {
    const sheetApisClient = yield* SheetApisClient;

    return {
      generate: Effect.fn("CheckinService.generate")(function* (payload: {
        guildId: string;
        channelId?: string | undefined;
        channelName?: string | undefined;
        hour?: number | undefined;
        template?: string | undefined;
      }) {
        return yield* sheetApisClient.get().checkin.generate({
          payload,
        });
      }),
    };
  }),
}) {
  static layer = Layer.effect(CheckinService, this.make).pipe(Layer.provide(SheetApisClient.layer));
}
