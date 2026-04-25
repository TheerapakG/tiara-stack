import { HttpApiBuilder } from "effect/unstable/httpapi";
import { Effect, Layer, Option } from "effect";
import { Api } from "@/api";
import { withCurrentGuildAuthFromQuery } from "@/handlers/shared/guildAuthorization";
import { SheetAuthGuildUser } from "sheet-ingress-api/schemas/middlewares/sheetAuthGuildUser";
import { BreakSchedule, Schedule } from "sheet-ingress-api/schemas/sheet";
import {
  AuthorizationService,
  withScheduleHourWindow,
  GuildConfigService,
  SheetConfigService,
  SheetService,
} from "@/services";
import { SheetAuthTokenAuthorizationLive } from "@/middlewares/sheetAuthTokenAuthorization/live";
import { resolveScheduleViewFromPermissions } from "../schedule/shared";

const getSheetIdFromGuildId = Effect.fn("sheet.getSheetIdFromGuildId")(function* (
  guildId: string,
  guildConfigService: typeof GuildConfigService.Service,
) {
  const guildConfig = yield* guildConfigService.getGuildConfig(guildId);

  if (Option.isNone(guildConfig)) {
    return yield* Effect.die(new Error(`Guild config not found for guildId: ${guildId}`));
  }

  if (Option.isNone(guildConfig.value.sheetId)) {
    return yield* Effect.die(new Error(`sheetId not found for guildId: ${guildId}`));
  }

  return guildConfig.value.sheetId.value;
});

const withScheduleHourWindows = (
  schedules: ReadonlyArray<BreakSchedule | Schedule>,
  startTime: Parameters<typeof withScheduleHourWindow>[0],
) => schedules.map((schedule) => withScheduleHourWindow(startTime, schedule));

export const sheetLayer = HttpApiBuilder.group(
  Api,
  "sheet",
  Effect.fn(function* (handlers) {
    const authorizationService = yield* AuthorizationService;
    const sheetService = yield* SheetService;
    const sheetConfigService = yield* SheetConfigService;
    const guildConfigService = yield* GuildConfigService;
    const withQueryGuildAuth = withCurrentGuildAuthFromQuery(authorizationService);

    return handlers
      .handle(
        "getPlayers",
        Effect.fnUntraced(function* ({ query }) {
          const sheetId = yield* getSheetIdFromGuildId(query.guildId, guildConfigService);
          return yield* sheetService.getPlayers(sheetId);
        }),
      )
      .handle(
        "getMonitors",
        Effect.fnUntraced(function* ({ query }) {
          const sheetId = yield* getSheetIdFromGuildId(query.guildId, guildConfigService);
          return yield* sheetService.getMonitors(sheetId);
        }),
      )
      .handle(
        "getTeams",
        Effect.fnUntraced(function* ({ query }) {
          const sheetId = yield* getSheetIdFromGuildId(query.guildId, guildConfigService);
          return yield* sheetService.getTeams(sheetId);
        }),
      )
      .handle(
        "getAllSchedules",
        withQueryGuildAuth(
          Effect.fnUntraced(function* ({ query }) {
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
        ),
      )
      .handle(
        "getDaySchedules",
        withQueryGuildAuth(
          Effect.fnUntraced(function* ({ query }) {
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
        ),
      )
      .handle(
        "getChannelSchedules",
        withQueryGuildAuth(
          Effect.fnUntraced(function* ({ query }) {
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
        ),
      )
      .handle(
        "getRangesConfig",
        Effect.fnUntraced(function* ({ query }) {
          const sheetId = yield* getSheetIdFromGuildId(query.guildId, guildConfigService);
          return yield* sheetConfigService.getRangesConfig(sheetId);
        }),
      )
      .handle(
        "getTeamConfig",
        Effect.fnUntraced(function* ({ query }) {
          const sheetId = yield* getSheetIdFromGuildId(query.guildId, guildConfigService);
          return yield* sheetConfigService.getTeamConfig(sheetId);
        }),
      )
      .handle(
        "getEventConfig",
        Effect.fnUntraced(function* ({ query }) {
          const sheetId = yield* getSheetIdFromGuildId(query.guildId, guildConfigService);
          return yield* sheetConfigService.getEventConfig(sheetId);
        }),
      )
      .handle(
        "getScheduleConfig",
        Effect.fnUntraced(function* ({ query }) {
          const sheetId = yield* getSheetIdFromGuildId(query.guildId, guildConfigService);
          return yield* sheetConfigService.getScheduleConfig(sheetId);
        }),
      )
      .handle(
        "getRunnerConfig",
        Effect.fnUntraced(function* ({ query }) {
          const sheetId = yield* getSheetIdFromGuildId(query.guildId, guildConfigService);
          return yield* sheetConfigService.getRunnerConfig(sheetId);
        }),
      );
  }),
).pipe(
  Layer.provide([
    AuthorizationService.layer,
    SheetService.layer,
    SheetConfigService.layer,
    GuildConfigService.layer,
    SheetAuthTokenAuthorizationLive,
  ]),
);
