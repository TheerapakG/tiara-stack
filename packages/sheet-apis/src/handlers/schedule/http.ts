import { HttpApiBuilder } from "@effect/platform";
import { Effect, Layer, Option, pipe } from "effect";
import { Api } from "@/api";
import {
  hasGuildPermission,
  hasPermission,
  resolveCurrentMonitorGuildUser,
} from "@/middlewares/authorization";
import { Unauthorized } from "@/schemas/middlewares/unauthorized";
import { ScheduleService, summarizeDayPlayerSchedule } from "@/services/schedule";
import { GuildConfigService } from "@/services/guildConfig";
import { SheetAuthTokenAuthorizationLive } from "@/middlewares/sheetAuthTokenAuthorization/live";
import { resolveScheduleViewFromPermissions } from "./shared";

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

export const ScheduleLive = HttpApiBuilder.group(Api, "schedule", (handlers) =>
  pipe(
    Effect.all({
      scheduleService: ScheduleService,
      guildConfigService: GuildConfigService,
    }),
    Effect.map(({ scheduleService, guildConfigService }) =>
      handlers
        .handle("getAllPopulatedSchedules", ({ urlParams }) =>
          pipe(
            Effect.all({
              sheetId: getSheetIdFromGuildId(urlParams.guildId, guildConfigService),
              resolvedUser: resolveCurrentMonitorGuildUser(urlParams.guildId),
            }),
            Effect.flatMap(({ sheetId, resolvedUser }) => {
              const view = resolveScheduleViewFromPermissions(
                resolvedUser.permissions,
                urlParams.guildId,
                urlParams.view,
              );
              return (
                view === "monitor"
                  ? scheduleService.getAllPopulatedSchedules(sheetId)
                  : scheduleService.getAllPopulatedFillerSchedules(sheetId)
              ).pipe(Effect.map((schedules) => ({ schedules, view })));
            }),
          ),
        )
        .handle("getDayPopulatedSchedules", ({ urlParams }) =>
          pipe(
            Effect.all({
              sheetId: getSheetIdFromGuildId(urlParams.guildId, guildConfigService),
              resolvedUser: resolveCurrentMonitorGuildUser(urlParams.guildId),
            }),
            Effect.flatMap(({ sheetId, resolvedUser }) => {
              const view = resolveScheduleViewFromPermissions(
                resolvedUser.permissions,
                urlParams.guildId,
                urlParams.view,
              );
              return (
                view === "monitor"
                  ? scheduleService.getDayPopulatedSchedules(sheetId, urlParams.day)
                  : scheduleService.getDayPopulatedFillerSchedules(sheetId, urlParams.day)
              ).pipe(Effect.map((schedules) => ({ schedules, view })));
            }),
          ),
        )
        .handle("getChannelPopulatedSchedules", ({ urlParams }) =>
          pipe(
            Effect.all({
              sheetId: getSheetIdFromGuildId(urlParams.guildId, guildConfigService),
              resolvedUser: resolveCurrentMonitorGuildUser(urlParams.guildId),
            }),
            Effect.flatMap(({ sheetId, resolvedUser }) => {
              const view = resolveScheduleViewFromPermissions(
                resolvedUser.permissions,
                urlParams.guildId,
                urlParams.view,
              );
              return (
                view === "monitor"
                  ? scheduleService.getChannelPopulatedSchedules(sheetId, urlParams.channel)
                  : scheduleService.getChannelPopulatedFillerSchedules(sheetId, urlParams.channel)
              ).pipe(Effect.map((schedules) => ({ schedules, view })));
            }),
          ),
        )
        .handle("getDayPlayerSchedule", ({ urlParams }) =>
          resolveCurrentMonitorGuildUser(urlParams.guildId).pipe(
            Effect.flatMap((resolvedUser) => {
              const view = resolveScheduleViewFromPermissions(
                resolvedUser.permissions,
                urlParams.guildId,
                urlParams.view,
              );

              return (
                resolvedUser.accountId === urlParams.accountId ||
                hasPermission(resolvedUser.permissions, "bot") ||
                hasPermission(resolvedUser.permissions, "app_owner") ||
                hasGuildPermission(resolvedUser.permissions, "monitor_guild", urlParams.guildId)
                  ? Effect.void
                  : Effect.fail(
                      new Unauthorized({ message: "User does not have access to this user" }),
                    )
              ).pipe(
                Effect.andThen(getSheetIdFromGuildId(urlParams.guildId, guildConfigService)),
                Effect.flatMap((sheetId) =>
                  (view === "monitor"
                    ? scheduleService.getDayPopulatedSchedules(sheetId, urlParams.day)
                    : scheduleService.getDayPopulatedFillerSchedules(sheetId, urlParams.day)
                  ).pipe(
                    Effect.map((schedules) => ({
                      view,
                      schedule: summarizeDayPlayerSchedule(schedules, urlParams.accountId),
                    })),
                  ),
                ),
              );
            }),
          ),
        ),
    ),
  ),
).pipe(
  Layer.provide(
    Layer.mergeAll(
      ScheduleService.Default,
      GuildConfigService.Default,
      SheetAuthTokenAuthorizationLive,
    ),
  ),
);
