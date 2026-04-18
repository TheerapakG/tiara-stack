import { HttpApiBuilder } from "effect/unstable/httpapi";
import { Effect, Layer, Option } from "effect";
import { Api } from "@/api";
import { withCurrentGuildAuthFromQuery } from "@/handlers/shared/guildAuthorization";
import { hasGuildPermission, hasPermission } from "@/services/authorization";
import { SheetAuthGuildUser } from "@/schemas/middlewares/sheetAuthGuildUser";
import { Unauthorized } from "@/schemas/middlewares/unauthorized";
import {
  AuthorizationService,
  GuildConfigService,
  ScheduleService,
  summarizeDayPlayerSchedule,
} from "@/services";
import { SheetAuthTokenAuthorizationLive } from "@/middlewares/sheetAuthTokenAuthorization/live";
import { resolveScheduleViewFromPermissions } from "./shared";

const getSheetIdFromGuildId = Effect.fn("schedule.getSheetIdFromGuildId")(function* (
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

export const scheduleLayer = HttpApiBuilder.group(
  Api,
  "schedule",
  Effect.fn(function* (handlers) {
    const authorizationService = yield* AuthorizationService;
    const scheduleService = yield* ScheduleService;
    const guildConfigService = yield* GuildConfigService;
    const withQueryGuildAuth = withCurrentGuildAuthFromQuery(authorizationService);

    return handlers
      .handle(
        "getAllPopulatedSchedules",
        withQueryGuildAuth(
          Effect.fnUntraced(function* ({ query }) {
            const sheetId = yield* getSheetIdFromGuildId(query.guildId, guildConfigService);
            const resolvedUser = yield* SheetAuthGuildUser;
            const view = resolveScheduleViewFromPermissions(
              resolvedUser.permissions,
              query.guildId,
              query.view,
            );
            const schedules = yield* view === "monitor"
              ? scheduleService.getAllPopulatedSchedules(sheetId)
              : scheduleService.getAllPopulatedFillerSchedules(sheetId);

            return { schedules, view };
          }),
        ),
      )
      .handle(
        "getDayPopulatedSchedules",
        withQueryGuildAuth(
          Effect.fnUntraced(function* ({ query }) {
            const sheetId = yield* getSheetIdFromGuildId(query.guildId, guildConfigService);
            const resolvedUser = yield* SheetAuthGuildUser;
            const view = resolveScheduleViewFromPermissions(
              resolvedUser.permissions,
              query.guildId,
              query.view,
            );
            const schedules = yield* view === "monitor"
              ? scheduleService.getDayPopulatedSchedules(sheetId, query.day)
              : scheduleService.getDayPopulatedFillerSchedules(sheetId, query.day);

            return { schedules, view };
          }),
        ),
      )
      .handle(
        "getChannelPopulatedSchedules",
        withQueryGuildAuth(
          Effect.fnUntraced(function* ({ query }) {
            const sheetId = yield* getSheetIdFromGuildId(query.guildId, guildConfigService);
            const resolvedUser = yield* SheetAuthGuildUser;
            const view = resolveScheduleViewFromPermissions(
              resolvedUser.permissions,
              query.guildId,
              query.view,
            );
            const schedules = yield* view === "monitor"
              ? scheduleService.getChannelPopulatedSchedules(sheetId, query.channel)
              : scheduleService.getChannelPopulatedFillerSchedules(sheetId, query.channel);

            return { schedules, view };
          }),
        ),
      )
      .handle(
        "getDayPlayerSchedule",
        withQueryGuildAuth(
          Effect.fnUntraced(function* ({ query }) {
            const resolvedUser = yield* SheetAuthGuildUser;
            const view = resolveScheduleViewFromPermissions(
              resolvedUser.permissions,
              query.guildId,
              query.view,
            );

            if (
              resolvedUser.accountId !== query.accountId &&
              !hasPermission(resolvedUser.permissions, "bot") &&
              !hasPermission(resolvedUser.permissions, "app_owner") &&
              !hasGuildPermission(resolvedUser.permissions, "monitor_guild", query.guildId)
            ) {
              return yield* Effect.fail(
                new Unauthorized({ message: "User does not have access to this user" }),
              );
            }

            const sheetId = yield* getSheetIdFromGuildId(query.guildId, guildConfigService);
            const schedules = yield* view === "monitor"
              ? scheduleService.getDayPopulatedSchedules(sheetId, query.day)
              : scheduleService.getDayPopulatedFillerSchedules(sheetId, query.day);

            return {
              view,
              schedule: summarizeDayPlayerSchedule(schedules, query.accountId),
            };
          }),
        ),
      );
  }),
).pipe(
  Layer.provide([
    AuthorizationService.layer,
    ScheduleService.layer,
    GuildConfigService.layer,
    SheetAuthTokenAuthorizationLive,
  ]),
);
