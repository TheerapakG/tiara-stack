import { Effect, Layer, Option } from "effect";
import { SheetRpcs } from "sheet-ingress-api/sheet-apis-rpc";
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

export const sheetLayer = SheetRpcs.toLayer(
  Effect.gen(function* () {
    const authorizationService = yield* AuthorizationService;
    const sheetService = yield* SheetService;
    const sheetConfigService = yield* SheetConfigService;
    const guildConfigService = yield* GuildConfigService;
    const withQueryGuildAuth = withCurrentGuildAuthFromQuery(authorizationService);

    return {
      "sheet.getPlayers": Effect.fnUntraced(function* ({ query }) {
        const sheetId = yield* getSheetIdFromGuildId(query.guildId, guildConfigService);
        return yield* sheetService.getPlayers(sheetId);
      }),
      "sheet.getMonitors": Effect.fnUntraced(function* ({ query }) {
        const sheetId = yield* getSheetIdFromGuildId(query.guildId, guildConfigService);
        return yield* sheetService.getMonitors(sheetId);
      }),
      "sheet.getTeams": Effect.fnUntraced(function* ({ query }) {
        const sheetId = yield* getSheetIdFromGuildId(query.guildId, guildConfigService);
        return yield* sheetService.getTeams(sheetId);
      }),
      "sheet.getAllSchedules": withQueryGuildAuth(
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
      "sheet.getDaySchedules": withQueryGuildAuth(
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
      "sheet.getChannelSchedules": withQueryGuildAuth(
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
      "sheet.getRangesConfig": Effect.fnUntraced(function* ({ query }) {
        const sheetId = yield* getSheetIdFromGuildId(query.guildId, guildConfigService);
        return yield* sheetConfigService.getRangesConfig(sheetId);
      }),
      "sheet.getTeamConfig": Effect.fnUntraced(function* ({ query }) {
        const sheetId = yield* getSheetIdFromGuildId(query.guildId, guildConfigService);
        return yield* sheetConfigService.getTeamConfig(sheetId);
      }),
      "sheet.getEventConfig": Effect.fnUntraced(function* ({ query }) {
        const sheetId = yield* getSheetIdFromGuildId(query.guildId, guildConfigService);
        return yield* sheetConfigService.getEventConfig(sheetId);
      }),
      "sheet.getScheduleConfig": Effect.fnUntraced(function* ({ query }) {
        const sheetId = yield* getSheetIdFromGuildId(query.guildId, guildConfigService);
        return yield* sheetConfigService.getScheduleConfig(sheetId);
      }),
      "sheet.getRunnerConfig": Effect.fnUntraced(function* ({ query }) {
        const sheetId = yield* getSheetIdFromGuildId(query.guildId, guildConfigService);
        return yield* sheetConfigService.getRunnerConfig(sheetId);
      }),
    };
  }),
).pipe(
  Layer.provide([
    AuthorizationService.layer,
    SheetService.layer,
    SheetConfigService.layer,
    GuildConfigService.layer,
  ]),
);
