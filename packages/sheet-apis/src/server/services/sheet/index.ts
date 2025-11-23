import { PlayerService } from "./playerService";
import { SheetService } from "./sheetService";
import { Layer, pipe } from "effect";
import { Result } from "typhoon-core/schema";
import { Computed } from "typhoon-core/signal";
import { ScreenshotService } from "./screenshotService";

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

export const layerOfGuildId = (guildId: string) =>
  pipe(
    SheetService.ofGuild(guildId),
    Computed.map((sheetService) =>
      pipe(
        sheetService,
        Result.map((sheetService) =>
          pipe(sheetServiceDependendents, Layer.provideMerge(sheetService)),
        ),
      ),
    ),
  );
