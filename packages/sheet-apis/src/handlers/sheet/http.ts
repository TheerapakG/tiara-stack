import { HttpApiBuilder } from "effect/unstable/httpapi";
import { Effect, Layer, Option, pipe } from "effect";
import { Api } from "@/api";
import { catchSchemaErrorAsValidationError } from "typhoon-core/error";
import { provideCurrentGuildUser } from "@/middlewares/authorization";
import { SheetAuthGuildUser } from "@/schemas/middlewares/sheetAuthGuildUser";
import { BreakSchedule, Schedule } from "@/schemas/sheet";
import {
  withScheduleHourWindow,
  GuildConfigService,
  SheetConfigService,
  SheetService,
} from "@/services";
import { SheetAuthTokenAuthorizationLive } from "@/middlewares/sheetAuthTokenAuthorization/live";
import { resolveScheduleViewFromPermissions } from "../schedule/shared";

const getSheetIdFromGuildId = (
  guildId: string,
  guildConfigService: typeof GuildConfigService.Service,
) =>
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
  startTime: Parameters<typeof withScheduleHourWindow>[0],
) => schedules.map((schedule) => withScheduleHourWindow(startTime, schedule));

export const sheetLayer = HttpApiBuilder.group(
  Api,
  "sheet",
  Effect.fn(function* (handlers) {
    const sheetService = yield* SheetService;
    const sheetConfigService = yield* SheetConfigService;
    const guildConfigService = yield* GuildConfigService;

    return handlers
      .handle("getPlayers", ({ query }) =>
        pipe(
          getSheetIdFromGuildId(query.guildId, guildConfigService),
          Effect.flatMap((sheetId) => sheetService.getPlayers(sheetId)),
        ).pipe(catchSchemaErrorAsValidationError),
      )
      .handle("getMonitors", ({ query }) =>
        pipe(
          getSheetIdFromGuildId(query.guildId, guildConfigService),
          Effect.flatMap((sheetId) => sheetService.getMonitors(sheetId)),
        ).pipe(catchSchemaErrorAsValidationError),
      )
      .handle("getTeams", ({ query }) =>
        pipe(
          getSheetIdFromGuildId(query.guildId, guildConfigService),
          Effect.flatMap((sheetId) => sheetService.getTeams(sheetId)),
        ).pipe(catchSchemaErrorAsValidationError),
      )
      .handle("getAllSchedules", ({ query }) =>
        provideCurrentGuildUser(
          query.guildId,
          Effect.gen(function* () {
            const sheetId = yield* getSheetIdFromGuildId(query.guildId, guildConfigService);
            const resolvedUser = yield* SheetAuthGuildUser;
            const view = resolveScheduleViewFromPermissions(
              resolvedUser.permissions,
              query.guildId,
              query.view,
            );
            const { schedules, eventConfig } = yield* Effect.all({
              schedules:
                view === "monitor"
                  ? sheetService.getAllSchedules(sheetId)
                  : sheetService.getAllFillerSchedules(sheetId),
              eventConfig: sheetConfigService.getEventConfig(sheetId),
            });

            return {
              schedules: withScheduleHourWindows(schedules, eventConfig.startTime),
              view,
            };
          }),
        ).pipe(catchSchemaErrorAsValidationError),
      )
      .handle("getDaySchedules", ({ query }) =>
        provideCurrentGuildUser(
          query.guildId,
          Effect.gen(function* () {
            const sheetId = yield* getSheetIdFromGuildId(query.guildId, guildConfigService);
            const resolvedUser = yield* SheetAuthGuildUser;
            const view = resolveScheduleViewFromPermissions(
              resolvedUser.permissions,
              query.guildId,
              query.view,
            );
            const { schedules, eventConfig } = yield* Effect.all({
              schedules:
                view === "monitor"
                  ? sheetService.getDaySchedules(sheetId, query.day)
                  : sheetService.getDayFillerSchedules(sheetId, query.day),
              eventConfig: sheetConfigService.getEventConfig(sheetId),
            });

            return {
              schedules: withScheduleHourWindows(schedules, eventConfig.startTime),
              view,
            };
          }),
        ).pipe(catchSchemaErrorAsValidationError),
      )
      .handle("getChannelSchedules", ({ query }) =>
        provideCurrentGuildUser(
          query.guildId,
          Effect.gen(function* () {
            const sheetId = yield* getSheetIdFromGuildId(query.guildId, guildConfigService);
            const resolvedUser = yield* SheetAuthGuildUser;
            const view = resolveScheduleViewFromPermissions(
              resolvedUser.permissions,
              query.guildId,
              query.view,
            );
            const { schedules, eventConfig } = yield* Effect.all({
              schedules:
                view === "monitor"
                  ? sheetService.getChannelSchedules(sheetId, query.channel)
                  : sheetService.getChannelFillerSchedules(sheetId, query.channel),
              eventConfig: sheetConfigService.getEventConfig(sheetId),
            });

            return {
              schedules: withScheduleHourWindows(schedules, eventConfig.startTime),
              view,
            };
          }),
        ).pipe(catchSchemaErrorAsValidationError),
      )
      .handle("getRangesConfig", ({ query }) =>
        pipe(
          getSheetIdFromGuildId(query.guildId, guildConfigService),
          Effect.flatMap((sheetId) => sheetConfigService.getRangesConfig(sheetId)),
        ).pipe(catchSchemaErrorAsValidationError),
      )
      .handle("getTeamConfig", ({ query }) =>
        pipe(
          getSheetIdFromGuildId(query.guildId, guildConfigService),
          Effect.flatMap((sheetId) => sheetConfigService.getTeamConfig(sheetId)),
        ).pipe(catchSchemaErrorAsValidationError),
      )
      .handle("getEventConfig", ({ query }) =>
        pipe(
          getSheetIdFromGuildId(query.guildId, guildConfigService),
          Effect.flatMap((sheetId) => sheetConfigService.getEventConfig(sheetId)),
        ).pipe(catchSchemaErrorAsValidationError),
      )
      .handle("getScheduleConfig", ({ query }) =>
        pipe(
          getSheetIdFromGuildId(query.guildId, guildConfigService),
          Effect.flatMap((sheetId) => sheetConfigService.getScheduleConfig(sheetId)),
        ).pipe(catchSchemaErrorAsValidationError),
      )
      .handle("getRunnerConfig", ({ query }) =>
        pipe(
          getSheetIdFromGuildId(query.guildId, guildConfigService),
          Effect.flatMap((sheetId) => sheetConfigService.getRunnerConfig(sheetId)),
        ).pipe(catchSchemaErrorAsValidationError),
      );
  }),
).pipe(
  Layer.provide([
    SheetService.layer,
    SheetConfigService.layer,
    GuildConfigService.layer,
    SheetAuthTokenAuthorizationLive,
  ]),
);
