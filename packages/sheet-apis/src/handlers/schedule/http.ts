import { HttpApiBuilder } from "effect/unstable/httpapi";
import { Effect, Layer, Option, pipe } from "effect";
import { Api } from "@/api";
import { catchSchemaErrorAsValidationError } from "typhoon-core/error";
import {
  hasGuildPermission,
  hasPermission,
  provideCurrentGuildUser,
} from "@/middlewares/authorization";
import { SheetAuthGuildUser } from "@/schemas/middlewares/sheetAuthGuildUser";
import { Unauthorized } from "@/schemas/middlewares/unauthorized";
import { GuildConfigService, ScheduleService, summarizeDayPlayerSchedule } from "@/services";
import { SheetAuthTokenAuthorizationLive } from "@/middlewares/sheetAuthTokenAuthorization/live";
import { resolveScheduleViewFromPermissions } from "./shared";

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

export const scheduleLayer = HttpApiBuilder.group(
  Api,
  "schedule",
  Effect.fn(function* (handlers) {
    const scheduleService = yield* ScheduleService;
    const guildConfigService = yield* GuildConfigService;

    return handlers
      .handle("getAllPopulatedSchedules", ({ query }) =>
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
            return yield* (
              view === "monitor"
                ? scheduleService.getAllPopulatedSchedules(sheetId)
                : scheduleService.getAllPopulatedFillerSchedules(sheetId)
            ).pipe(Effect.map((schedules) => ({ schedules, view })));
          }),
        ).pipe(catchSchemaErrorAsValidationError),
      )
      .handle("getDayPopulatedSchedules", ({ query }) =>
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
            return yield* (
              view === "monitor"
                ? scheduleService.getDayPopulatedSchedules(sheetId, query.day)
                : scheduleService.getDayPopulatedFillerSchedules(sheetId, query.day)
            ).pipe(Effect.map((schedules) => ({ schedules, view })));
          }),
        ).pipe(catchSchemaErrorAsValidationError),
      )
      .handle("getChannelPopulatedSchedules", ({ query }) =>
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
            return yield* (
              view === "monitor"
                ? scheduleService.getChannelPopulatedSchedules(sheetId, query.channel)
                : scheduleService.getChannelPopulatedFillerSchedules(sheetId, query.channel)
            ).pipe(Effect.map((schedules) => ({ schedules, view })));
          }),
        ).pipe(catchSchemaErrorAsValidationError),
      )
      .handle("getDayPlayerSchedule", ({ query }) =>
        provideCurrentGuildUser(
          query.guildId,
          Effect.gen(function* () {
            const resolvedUser = yield* SheetAuthGuildUser;
            const view = resolveScheduleViewFromPermissions(
              resolvedUser.permissions,
              query.guildId,
              query.view,
            );

            return yield* (
              resolvedUser.accountId === query.accountId ||
              hasPermission(resolvedUser.permissions, "bot") ||
              hasPermission(resolvedUser.permissions, "app_owner") ||
              hasGuildPermission(resolvedUser.permissions, "monitor_guild", query.guildId)
                ? Effect.void
                : Effect.fail(
                    new Unauthorized({ message: "User does not have access to this user" }),
                  )
            ).pipe(
              Effect.andThen(getSheetIdFromGuildId(query.guildId, guildConfigService)),
              Effect.flatMap((sheetId) =>
                (view === "monitor"
                  ? scheduleService.getDayPopulatedSchedules(sheetId, query.day)
                  : scheduleService.getDayPopulatedFillerSchedules(sheetId, query.day)
                ).pipe(
                  Effect.map((schedules) => ({
                    view,
                    schedule: summarizeDayPlayerSchedule(schedules, query.accountId),
                  })),
                ),
              ),
            );
          }),
        ).pipe(catchSchemaErrorAsValidationError),
      );
  }),
).pipe(
  Layer.provide([ScheduleService.layer, GuildConfigService.layer, SheetAuthTokenAuthorizationLive]),
);
