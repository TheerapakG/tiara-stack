import { PlayerService } from "./playerService";
import { SheetService } from "./sheetService";
import { Layer } from "effect";
import { pipe } from "effect";
import { Computed } from "typhoon-core/signal";
import { ScreenshotService } from "./screenshotService";

export * from "./playerService";
export * from "./sheetService";
export * from "./screenshotService";

const sheetServiceDependendents = Layer.mergeAll(
  PlayerService.Default,
  ScreenshotService.Default,
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
      pipe(sheetServiceDependendents, Layer.provideMerge(sheetService)),
    ),
  );
