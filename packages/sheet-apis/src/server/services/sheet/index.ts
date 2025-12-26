import {
  Context,
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
import { SignalContext, SignalService } from "typhoon-core/signal";
import {
  ZeroQueryAppError,
  ZeroQueryHttpError,
  ZeroQueryZeroError,
} from "typhoon-core/error";
import { GoogleSheets } from "@/google";
import { ZeroService } from "typhoon-core/services";
import { Schema } from "sheet-db-schema/zero";

import { PlayerService } from "./playerService";
import { ScreenshotService } from "./screenshotService";
import { SheetContext } from "./sheetContext";
import { SheetService } from "./sheetService";
import { GuildConfigService } from "../guildConfigService";
import { SheetConfigService } from "../sheetConfigService";

export * from "./playerService";
export * from "./screenshotService";
export * from "./sheetContext";
export * from "./sheetService";

const sheetContextDependendents = pipe(
  Layer.mergeAll(
    PlayerService.Default,
    ScreenshotService.DefaultWithoutDependencies,
  ),
  Layer.provideMerge(SheetService.DefaultWithoutDependencies),
);

export const layerOfSheetId = (sheetId: string) =>
  pipe(
    sheetContextDependendents,
    Layer.provideMerge(
      Layer.syncContext(() => Context.make(SheetContext, { sheetId })),
    ),
  );

export const contextOfSheetId = (sheetId: string) =>
  pipe(layerOfSheetId(sheetId), Layer.build);

export const layerOfGuildId = <E = never>(
  guildId: SignalContext.MaybeSignalEffect<string, E>,
): Effect.Effect<
  Effect.Effect<
    Result.Result<
      Option.Option<
        Layer.Layer<
          PlayerService | ScreenshotService | SheetService | SheetContext,
          ZeroQueryAppError | ZeroQueryHttpError | ZeroQueryZeroError,
          GoogleSheets | SheetConfigService
        >
      >
    >,
    ParseResult.ParseError,
    SignalContext.SignalContext | SignalService.SignalService
  >,
  never,
  | GuildConfigService
  | Scope.Scope
  | ZeroService.ZeroService<Schema, undefined>
  | SignalService.SignalService
> =>
  pipe(
    SheetContext.ofGuild(guildId),
    Effect.map(
      Effect.map(
        Result.map(
          flow(
            Either.match({
              onLeft: (err) => Option.some(Layer.fail(err)),
              onRight: Option.map((sheetContext) =>
                pipe(
                  sheetContextDependendents,
                  Layer.provideMerge(Layer.syncContext(() => sheetContext)),
                ),
              ),
            }),
          ),
        ),
      ),
    ),
  );
