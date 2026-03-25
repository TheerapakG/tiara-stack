import { Effect, pipe } from "effect";
import { SheetApisClient } from "./sheetApis";

export class RoomOrderService extends Effect.Service<RoomOrderService>()("RoomOrderService", {
  effect: pipe(
    Effect.all({ sheetApisClient: SheetApisClient }),
    Effect.map(({ sheetApisClient }) => ({
      generate: Effect.fn("RoomOrderService.generate")(
        (payload: {
          guildId: string;
          channelId?: string | undefined;
          channelName?: string | undefined;
          hour?: number | undefined;
          healNeeded?: number | undefined;
        }) =>
          sheetApisClient.get().roomOrder.generate({
            payload,
          }),
      ),
    })),
  ),
  dependencies: [SheetApisClient.Default],
  accessors: true,
}) {}
