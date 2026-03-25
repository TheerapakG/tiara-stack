import { HttpApiBuilder } from "@effect/platform";
import { Effect, Layer, Option, pipe } from "effect";
import { Api } from "@/api";
import { SheetService } from "@/services/sheet";
import { SheetConfigService } from "@/services/sheetConfig";
import { GuildConfigService } from "@/services/guildConfig";
import { SheetAuthTokenAuthorizationLive } from "@/middlewares/sheetAuthTokenAuthorization/live";
import {
  getEffectiveScheduleView,
  getMaximumScheduleView,
  type ScheduleView,
} from "@/schemas/sheet";
import { SheetAuthUser } from "@/schemas/middlewares/sheetAuthUser";

const getSheetIdFromGuildId = (guildId: string, guildConfigService: GuildConfigService) =>
  pipe(
    guildConfigService.getGuildConfig(guildId),
    Effect.flatMap(
      Option.match({
        onSome: (guildConfig) =>
          pipe(
            guildConfig.sheetId,
            Option.match({
              onSome: Effect.succeed,
              onNone: () => Effect.die(new Error(`sheetId not found for guildId: ${guildId}`)),
            }),
          ),
        onNone: () => Effect.die(new Error(`Guild config not found for guildId: ${guildId}`)),
      }),
    ),
  );

const resolveScheduleView = (guildId: string, requestedView?: ScheduleView) =>
  pipe(
    SheetAuthUser,
    Effect.map((user) =>
      getEffectiveScheduleView(getMaximumScheduleView(user.permissions, guildId), requestedView),
    ),
  );

export const SheetLive = HttpApiBuilder.group(Api, "sheet", (handlers) =>
  pipe(
    Effect.all({
      sheetService: SheetService,
      sheetConfigService: SheetConfigService,
      guildConfigService: GuildConfigService,
    }),
    Effect.map(({ sheetService, sheetConfigService, guildConfigService }) =>
      handlers
        .handle("getPlayers", ({ urlParams }) =>
          pipe(
            getSheetIdFromGuildId(urlParams.guildId, guildConfigService),
            Effect.flatMap((sheetId) => sheetService.getPlayers(sheetId)),
          ),
        )
        .handle("getMonitors", ({ urlParams }) =>
          pipe(
            getSheetIdFromGuildId(urlParams.guildId, guildConfigService),
            Effect.flatMap((sheetId) => sheetService.getMonitors(sheetId)),
          ),
        )
        .handle("getTeams", ({ urlParams }) =>
          pipe(
            getSheetIdFromGuildId(urlParams.guildId, guildConfigService),
            Effect.flatMap((sheetId) => sheetService.getTeams(sheetId)),
          ),
        )
        .handle("getAllSchedules", ({ urlParams }) =>
          pipe(
            Effect.all({
              sheetId: getSheetIdFromGuildId(urlParams.guildId, guildConfigService),
              view: resolveScheduleView(urlParams.guildId, urlParams.view),
            }),
            Effect.flatMap(({ sheetId, view }) =>
              (view === "monitor"
                ? sheetService.getAllSchedules(sheetId)
                : sheetService.getAllFillerSchedules(sheetId)
              ).pipe(Effect.map((schedules) => ({ schedules, view }))),
            ),
          ),
        )
        .handle("getDaySchedules", ({ urlParams }) =>
          pipe(
            Effect.all({
              sheetId: getSheetIdFromGuildId(urlParams.guildId, guildConfigService),
              view: resolveScheduleView(urlParams.guildId, urlParams.view),
            }),
            Effect.flatMap(({ sheetId, view }) =>
              (view === "monitor"
                ? sheetService.getDaySchedules(sheetId, urlParams.day)
                : sheetService.getDayFillerSchedules(sheetId, urlParams.day)
              ).pipe(Effect.map((schedules) => ({ schedules, view }))),
            ),
          ),
        )
        .handle("getChannelSchedules", ({ urlParams }) =>
          pipe(
            Effect.all({
              sheetId: getSheetIdFromGuildId(urlParams.guildId, guildConfigService),
              view: resolveScheduleView(urlParams.guildId, urlParams.view),
            }),
            Effect.flatMap(({ sheetId, view }) =>
              (view === "monitor"
                ? sheetService.getChannelSchedules(sheetId, urlParams.channel)
                : sheetService.getChannelFillerSchedules(sheetId, urlParams.channel)
              ).pipe(Effect.map((schedules) => ({ schedules, view }))),
            ),
          ),
        )
        .handle("getRangesConfig", ({ urlParams }) =>
          pipe(
            getSheetIdFromGuildId(urlParams.guildId, guildConfigService),
            Effect.flatMap((sheetId) => sheetConfigService.getRangesConfig(sheetId)),
          ),
        )
        .handle("getTeamConfig", ({ urlParams }) =>
          pipe(
            getSheetIdFromGuildId(urlParams.guildId, guildConfigService),
            Effect.flatMap((sheetId) => sheetConfigService.getTeamConfig(sheetId)),
          ),
        )
        .handle("getEventConfig", ({ urlParams }) =>
          pipe(
            getSheetIdFromGuildId(urlParams.guildId, guildConfigService),
            Effect.flatMap((sheetId) => sheetConfigService.getEventConfig(sheetId)),
          ),
        )
        .handle("getScheduleConfig", ({ urlParams }) =>
          pipe(
            getSheetIdFromGuildId(urlParams.guildId, guildConfigService),
            Effect.flatMap((sheetId) => sheetConfigService.getScheduleConfig(sheetId)),
          ),
        )
        .handle("getRunnerConfig", ({ urlParams }) =>
          pipe(
            getSheetIdFromGuildId(urlParams.guildId, guildConfigService),
            Effect.flatMap((sheetId) => sheetConfigService.getRunnerConfig(sheetId)),
          ),
        ),
    ),
  ),
).pipe(
  Layer.provide(
    Layer.mergeAll(
      SheetService.Default,
      SheetConfigService.Default,
      GuildConfigService.Default,
      SheetAuthTokenAuthorizationLive,
    ),
  ),
);
