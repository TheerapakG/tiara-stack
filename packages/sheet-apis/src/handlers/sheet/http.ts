import { HttpApiBuilder } from "@effect/platform";
import { Effect, Layer, Option, pipe } from "effect";
import { Api } from "@/api";
import { provideCurrentGuildUser } from "@/middlewares/authorization";
import { SheetAuthGuildUser } from "@/schemas/middlewares/sheetAuthGuildUser";
import { BreakSchedule, Schedule } from "@/schemas/sheet";
import { withScheduleHourWindow } from "@/services/hourWindow";
import { GuildConfigService } from "@/services/guildConfig";
import { SheetConfigService } from "@/services/sheetConfig";
import { SheetService } from "@/services/sheet";
import { SheetAuthTokenAuthorizationLive } from "@/middlewares/sheetAuthTokenAuthorization/live";
import { resolveScheduleViewFromPermissions } from "../schedule/shared";

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

const withScheduleHourWindows = (
  schedules: ReadonlyArray<BreakSchedule | Schedule>,
  startTime: Effect.Effect.Success<ReturnType<SheetConfigService["getEventConfig"]>>["startTime"],
) => schedules.map((schedule) => withScheduleHourWindow(startTime, schedule));

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
          provideCurrentGuildUser(
            urlParams.guildId,
            Effect.all({
              sheetId: getSheetIdFromGuildId(urlParams.guildId, guildConfigService),
              resolvedUser: SheetAuthGuildUser,
            }).pipe(
              Effect.flatMap(({ sheetId, resolvedUser }) => {
                const view = resolveScheduleViewFromPermissions(
                  resolvedUser.permissions,
                  urlParams.guildId,
                  urlParams.view,
                );
                return Effect.all({
                  schedules:
                    view === "monitor"
                      ? sheetService.getAllSchedules(sheetId)
                      : sheetService.getAllFillerSchedules(sheetId),
                  eventConfig: sheetConfigService.getEventConfig(sheetId),
                }).pipe(
                  Effect.map(({ schedules, eventConfig }) => ({
                    schedules: withScheduleHourWindows(schedules, eventConfig.startTime),
                    view,
                  })),
                );
              }),
            ),
          ),
        )
        .handle("getDaySchedules", ({ urlParams }) =>
          provideCurrentGuildUser(
            urlParams.guildId,
            Effect.all({
              sheetId: getSheetIdFromGuildId(urlParams.guildId, guildConfigService),
              resolvedUser: SheetAuthGuildUser,
            }).pipe(
              Effect.flatMap(({ sheetId, resolvedUser }) => {
                const view = resolveScheduleViewFromPermissions(
                  resolvedUser.permissions,
                  urlParams.guildId,
                  urlParams.view,
                );
                return Effect.all({
                  schedules:
                    view === "monitor"
                      ? sheetService.getDaySchedules(sheetId, urlParams.day)
                      : sheetService.getDayFillerSchedules(sheetId, urlParams.day),
                  eventConfig: sheetConfigService.getEventConfig(sheetId),
                }).pipe(
                  Effect.map(({ schedules, eventConfig }) => ({
                    schedules: withScheduleHourWindows(schedules, eventConfig.startTime),
                    view,
                  })),
                );
              }),
            ),
          ),
        )
        .handle("getChannelSchedules", ({ urlParams }) =>
          provideCurrentGuildUser(
            urlParams.guildId,
            Effect.all({
              sheetId: getSheetIdFromGuildId(urlParams.guildId, guildConfigService),
              resolvedUser: SheetAuthGuildUser,
            }).pipe(
              Effect.flatMap(({ sheetId, resolvedUser }) => {
                const view = resolveScheduleViewFromPermissions(
                  resolvedUser.permissions,
                  urlParams.guildId,
                  urlParams.view,
                );
                return Effect.all({
                  schedules:
                    view === "monitor"
                      ? sheetService.getChannelSchedules(sheetId, urlParams.channel)
                      : sheetService.getChannelFillerSchedules(sheetId, urlParams.channel),
                  eventConfig: sheetConfigService.getEventConfig(sheetId),
                }).pipe(
                  Effect.map(({ schedules, eventConfig }) => ({
                    schedules: withScheduleHourWindows(schedules, eventConfig.startTime),
                    view,
                  })),
                );
              }),
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
