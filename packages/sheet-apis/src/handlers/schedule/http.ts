import { HttpApiBuilder } from "@effect/platform";
import { Effect, Layer, Option, pipe } from "effect";
import { Api } from "@/api";
import { requireUserIdOrMonitorGuild } from "@/middlewares/authorization";
import { ScheduleService, summarizeDayPlayerSchedule } from "@/services/schedule";
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
              view: resolveScheduleView(urlParams.guildId, urlParams.view),
            }),
            Effect.flatMap(({ sheetId, view }) =>
              (view === "monitor"
                ? scheduleService.getAllPopulatedSchedules(sheetId)
                : scheduleService.getAllPopulatedFillerSchedules(sheetId)
              ).pipe(Effect.map((schedules) => ({ schedules, view }))),
            ),
          ),
        )
        .handle("getDayPopulatedSchedules", ({ urlParams }) =>
          pipe(
            Effect.all({
              sheetId: getSheetIdFromGuildId(urlParams.guildId, guildConfigService),
              view: resolveScheduleView(urlParams.guildId, urlParams.view),
            }),
            Effect.flatMap(({ sheetId, view }) =>
              (view === "monitor"
                ? scheduleService.getDayPopulatedSchedules(sheetId, urlParams.day)
                : scheduleService.getDayPopulatedFillerSchedules(sheetId, urlParams.day)
              ).pipe(Effect.map((schedules) => ({ schedules, view }))),
            ),
          ),
        )
        .handle("getChannelPopulatedSchedules", ({ urlParams }) =>
          pipe(
            Effect.all({
              sheetId: getSheetIdFromGuildId(urlParams.guildId, guildConfigService),
              view: resolveScheduleView(urlParams.guildId, urlParams.view),
            }),
            Effect.flatMap(({ sheetId, view }) =>
              (view === "monitor"
                ? scheduleService.getChannelPopulatedSchedules(sheetId, urlParams.channel)
                : scheduleService.getChannelPopulatedFillerSchedules(sheetId, urlParams.channel)
              ).pipe(Effect.map((schedules) => ({ schedules, view }))),
            ),
          ),
        )
        .handle("getDayPlayerSchedule", ({ urlParams }) =>
          requireUserIdOrMonitorGuild(urlParams.guildId, urlParams.userId).pipe(
            Effect.andThen(
              Effect.all({
                sheetId: getSheetIdFromGuildId(urlParams.guildId, guildConfigService),
                view: resolveScheduleView(urlParams.guildId, urlParams.view),
              }),
            ),
            Effect.flatMap(({ sheetId, view }) =>
              (view === "monitor"
                ? scheduleService.getDayPopulatedSchedules(sheetId, urlParams.day)
                : scheduleService.getDayPopulatedFillerSchedules(sheetId, urlParams.day)
              ).pipe(
                Effect.map((schedules) => ({
                  view,
                  schedule: summarizeDayPlayerSchedule(schedules, urlParams.userId),
                })),
              ),
            ),
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
