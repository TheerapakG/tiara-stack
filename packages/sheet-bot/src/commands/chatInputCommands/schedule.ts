import {
  ClientService,
  guildServicesFromInteractionOption,
  InteractionContext,
  PermissionService,
  ScheduleService,
} from "@/services";
import {
  chatInputCommandSubcommandHandlerContextBuilder,
  ChatInputSubcommandHandlerVariantT,
  handlerVariantContextBuilder,
} from "@/types";
import {
  ApplicationIntegrationType,
  InteractionContextType,
  MessageFlags,
  SlashCommandBuilder,
  SlashCommandSubcommandBuilder,
} from "discord.js";
import { Array, Effect, flow, Match, Option, pipe, String } from "effect";

const formatHourRanges = (hours: readonly number[]): string => {
  if (Array.isEmptyReadonlyArray(hours)) return "None";
  const sorted = [...hours].sort((a, b) => a - b);
  const ranges: { start: number; end: number }[] = [];
  for (const h of sorted) {
    const last = ranges[ranges.length - 1];
    if (!last) {
      ranges.push({ start: h, end: h });
    } else if (h === last.end + 1) {
      last.end = h;
    } else if (h !== last.end) {
      ranges.push({ start: h, end: h });
    }
  }
  return ranges.map(({ start, end }) => (start === end ? `${start}` : `${start}-${end}`)).join(",");
};

const handleList = handlerVariantContextBuilder<ChatInputSubcommandHandlerVariantT>()
  .data(
    new SlashCommandSubcommandBuilder()
      .setName("list")
      .setDescription("Get your schedule (fill/overfill/standby) for a day")
      .addNumberOption((option) =>
        option.setName("day").setDescription("The day to get the schedule for").setRequired(true),
      )
      .addStringOption((option) =>
        option
          .setName("server_id")
          .setDescription("Owner-only: the server to get the schedule for"),
      ),
  )
  .handler(
    Effect.provide(guildServicesFromInteractionOption("server_id"))(
      pipe(
        Effect.Do,
        PermissionService.checkOwner.tap(() => ({ allowSameGuild: true })),
        InteractionContext.deferReply.tap(() => ({
          flags: MessageFlags.Ephemeral,
        })),
        InteractionContext.user.bind("user"),
        Effect.bind("day", () => InteractionContext.getNumber("day", true)),
        Effect.bind("daySchedules", ({ day }) =>
          pipe(
            ScheduleService.dayPopulatedSchedules(day),
            Effect.map(
              Array.filterMap((schedule) =>
                pipe(
                  schedule.hour,
                  Option.map(() => schedule),
                  Option.flatMap((schedule) =>
                    pipe(
                      Match.value(schedule),
                      Match.tagsExhaustive({
                        PopulatedBreakSchedule: () => Option.none(),
                        PopulatedSchedule: (schedule) => Option.some(schedule),
                      }),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
        Effect.let("invisible", ({ daySchedules }) =>
          pipe(
            daySchedules,
            Array.some(({ visible }) => !visible),
          ),
        ),
        Effect.let("fillHours", ({ daySchedules, user }) =>
          pipe(
            daySchedules,
            Array.filter(
              flow(
                (schedule) => schedule.fills,
                Array.getSomes,
                Array.some((fill) =>
                  pipe(
                    Match.value(fill.player),
                    Match.tagsExhaustive({
                      Player: (player) => String.Equivalence(player.id, user.id),
                      PartialNamePlayer: () => false,
                    }),
                  ),
                ),
              ),
            ),
            Array.map((schedule) => schedule.hour),
            Array.getSomes,
          ),
        ),
        Effect.let("overfillHours", ({ daySchedules, user }) =>
          pipe(
            daySchedules,
            Array.filter(
              flow(
                (schedule) => schedule.overfills,
                Array.some((overfill) =>
                  pipe(
                    Match.value(overfill.player),
                    Match.tagsExhaustive({
                      Player: (player) => String.Equivalence(player.id, user.id),
                      PartialNamePlayer: () => false,
                    }),
                  ),
                ),
              ),
            ),
            Array.map((schedule) => schedule.hour),
            Array.getSomes,
          ),
        ),
        Effect.let("standbyHours", ({ daySchedules, user }) =>
          pipe(
            daySchedules,
            Array.filter(
              flow(
                (schedule) => schedule.standbys,
                Array.some((standby) =>
                  pipe(
                    Match.value(standby.player),
                    Match.tagsExhaustive({
                      Player: (player) => String.Equivalence(player.id, user.id),
                      PartialNamePlayer: () => false,
                    }),
                  ),
                ),
              ),
            ),
            Array.map((schedule) => schedule.hour),
            Array.getSomes,
          ),
        ),
        InteractionContext.editReply.tapEffect(
          ({ day, user, invisible, fillHours, overfillHours, standbyHours }) =>
            pipe(
              ClientService.makeEmbedBuilder(),
              Effect.map((embed) => ({
                embeds: [
                  invisible
                    ? embed
                        .setTitle(`${user.username}'s Schedule for Day ${day}`)
                        .setDescription(
                          "It is kinda foggy around here... This schedule is not visible to you yet.",
                        )
                    : embed.setTitle(`${user.username}'s Schedule for Day ${day}`).addFields(
                        {
                          name: "Fill",
                          value: formatHourRanges(fillHours),
                        },
                        {
                          name: "Overfill",
                          value: formatHourRanges(overfillHours),
                        },
                        {
                          name: "Standby",
                          value: formatHourRanges(standbyHours),
                        },
                      ),
                ],
              })),
            ),
        ),
        Effect.withSpan("handleScheduleList", { captureStackTrace: true }),
      ),
    ),
  )
  .build();

export const command = chatInputCommandSubcommandHandlerContextBuilder()
  .data(
    new SlashCommandBuilder()
      .setName("schedule")
      .setDescription("Schedule commands")
      .setIntegrationTypes(
        ApplicationIntegrationType.GuildInstall,
        ApplicationIntegrationType.UserInstall,
      )
      .setContexts(
        InteractionContextType.BotDM,
        InteractionContextType.Guild,
        InteractionContextType.PrivateChannel,
      ),
  )
  .addSubcommandHandler(handleList)
  .build();
