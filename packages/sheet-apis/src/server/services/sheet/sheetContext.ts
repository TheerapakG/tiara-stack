import { Context, Effect, Either, Option, pipe } from "effect";
import { Result } from "typhoon-core/schema";
import { SignalService } from "typhoon-core/signal";
import { GuildConfigService } from "../guildConfigService";

export class SheetContext extends Context.Tag("SheetContext")<
  SheetContext,
  {
    sheetId: string;
  }
>() {
  static ofGuild = <E = never>(guildId: SignalService.MaybeSignalEffect<string, E>) =>
    pipe(
      GuildConfigService.getGuildConfigByGuildId(guildId),
      Effect.map(Effect.map(Result.map(Either.map(Option.flatMap((config) => config.sheetId))))),
      Effect.map(
        Effect.map(
          Result.map(Either.map(Option.map((sheetId) => Context.make(SheetContext, { sheetId })))),
        ),
      ),
    );
}
