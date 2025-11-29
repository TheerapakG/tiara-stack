import { PlayerService } from "./playerService";
import { SheetService } from "./sheetService";
import { GuildConfigService } from "../guildConfigService";
import { SheetConfigService } from "../sheetConfigService";
import {
  Effect,
  Layer,
  pipe,
  Either,
  Option,
  flow,
  ParseResult,
  Scope,
} from "effect";
import { Result } from "typhoon-core/schema";
import { ScreenshotService } from "./screenshotService";
import { SignalContext } from "typhoon-core/signal";
import {
  ZeroQueryAppError,
  ZeroQueryHttpError,
  ZeroQueryZeroError,
} from "typhoon-core/error";
import { GoogleSheets } from "@/google";
import { ZeroService } from "typhoon-core/services";
import { Schema } from "sheet-db-schema/zero";

export * from "./playerService";
export * from "./sheetService";
export * from "./screenshotService";

const sheetServiceDependendents = Layer.mergeAll(
  PlayerService.Default,
  ScreenshotService.DefaultWithoutDependencies,
);

export const layerOfSheetId = (sheetId: string) =>
  pipe(
    sheetServiceDependendents,
    Layer.provideMerge(SheetService.DefaultWithoutDependencies(sheetId)),
  );

export const layerOfGuildId = <E = never>(
  guildId: SignalContext.MaybeSignalEffect<string, E>,
): Effect.Effect<
  Effect.Effect<
    Result.Result<
      Option.Option<
        Layer.Layer<
          PlayerService | ScreenshotService | SheetService,
          ZeroQueryAppError | ZeroQueryHttpError | ZeroQueryZeroError,
          GoogleSheets | SheetConfigService
        >
      >
    >,
    ParseResult.ParseError,
    SignalContext.SignalContext
  >,
  never,
  GuildConfigService | Scope.Scope | ZeroService.ZeroService<Schema, undefined>
> =>
  pipe(
    SheetService.ofGuild(guildId),
    Effect.map(
      Effect.map(
        Result.map(
          flow(
            Either.match({
              onLeft: (err) => Option.some(Layer.fail(err)),
              onRight: Option.map((sheetService) =>
                pipe(
                  sheetServiceDependendents,
                  Layer.provideMerge(sheetService),
                ),
              ),
            }),
          ),
        ),
      ),
    ),
  );
