import { Effect, pipe } from "effect";
import { SheetApisClient } from "./sheetApis";

export class CheckinService extends Effect.Service<CheckinService>()("CheckinService", {
  effect: pipe(
    Effect.all({ sheetApisClient: SheetApisClient }),
    Effect.map(({ sheetApisClient }) => ({
      generate: Effect.fn("CheckinService.generate")(
        (payload: {
          guildId: string;
          channelId?: string | undefined;
          channelName?: string | undefined;
          hour?: number | undefined;
          template?: string | undefined;
        }) =>
          sheetApisClient.get().checkin.generate({
            payload,
          }),
      ),
    })),
  ),
  dependencies: [SheetApisClient.Default],
  accessors: true,
}) {}
