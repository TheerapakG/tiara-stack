import { HttpApiBuilder } from "@effect/platform";
import { Effect, Layer, pipe } from "effect";
import { Api } from "@/api";
import { SheetService } from "@/services/sheet";

export const SheetLive = HttpApiBuilder.group(Api, "sheet", (handlers) =>
  pipe(
    Effect.all({
      sheetService: SheetService,
    }),
    Effect.map(({ sheetService }) =>
      handlers
        .handle("getPlayers", ({ urlParams }) => sheetService.getPlayers(urlParams.sheetId))
        .handle("getMonitors", ({ urlParams }) => sheetService.getMonitors(urlParams.sheetId))
        .handle("getTeams", ({ urlParams }) => sheetService.getTeams(urlParams.sheetId))
        .handle("getAllSchedules", ({ urlParams }) =>
          sheetService.getAllSchedules(urlParams.sheetId),
        )
        .handle("getDaySchedules", ({ urlParams }) =>
          sheetService.getDaySchedules(urlParams.sheetId, urlParams.day),
        )
        .handle("getChannelSchedules", ({ urlParams }) =>
          sheetService.getChannelSchedules(urlParams.sheetId, urlParams.channel),
        ),
    ),
  ),
).pipe(Layer.provide(SheetService.Default));
