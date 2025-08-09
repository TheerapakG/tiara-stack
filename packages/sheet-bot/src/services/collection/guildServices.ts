import { Effect, Layer, pipe } from "effect";
import { PlayerService } from "../playerService";
import { ScheduleService } from "../scheduleService";
import { SheetService } from "../sheetService";

export const guildServices = (guildId: string) =>
  pipe(
    Effect.Do,
    Effect.bind("sheetService", () => SheetService.ofGuild(guildId)),
    Effect.map(({ sheetService }) =>
      pipe(
        ScheduleService.Default,
        Layer.provideMerge(PlayerService.Default),
        Layer.provideMerge(sheetService),
      ),
    ),
    Layer.unwrapEffect,
  );
