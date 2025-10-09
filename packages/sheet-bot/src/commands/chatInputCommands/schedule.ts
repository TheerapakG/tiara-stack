import {
  ClientService,
  guildServicesFromInteractionOption,
  InteractionContext,
  PermissionService,
  PlayerService,
  SheetService,
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
import {
  Array,
  Effect,
  Function,
  HashMap,
  Match,
  Number,
  Order,
  pipe,
  String,
} from "effect";
import { Schema } from "sheet-apis";
import { Utils } from "typhoon-core/utils";

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
  return ranges
    .map(({ start, end }) => (start === end ? `${start}` : `${start}-${end}`))
    .join(",");
};

const handleList =
  handlerVariantContextBuilder<ChatInputSubcommandHandlerVariantT>()
    .data(
      new SlashCommandSubcommandBuilder()
        .setName("list")
        .setDescription("Get your schedule (fill/overfill/standby) for a day")
        .addNumberOption((option) =>
          option
            .setName("day")
            .setDescription("The day to get the schedule for")
            .setRequired(true),
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
            SheetService.daySchedules(day),
          ),
          Effect.bind("schedulesWithPlayers", ({ daySchedules }) =>
            pipe(
              daySchedules,
              Utils.HashMapPositional(PlayerService.mapScheduleWithPlayers),
              Effect.map(HashMap.values),
              Effect.map(
                Array.sortBy(Order.mapInput(Number.Order, ({ hour }) => hour)),
              ),
            ),
          ),
          Effect.let("fillHours", ({ schedulesWithPlayers, user }) =>
            pipe(
              schedulesWithPlayers,
              Array.filter((s) => !s.breakHour),
              Array.filter((s) =>
                pipe(
                  s.fills,
                  Array.getSomes,
                  Array.some((p) =>
                    pipe(
                      Match.type<Schema.Player | Schema.PartialNamePlayer>(),
                      Match.tag("Player", (player) =>
                        String.Equivalence(player.id, user.id),
                      ),
                      Match.tag("PartialNamePlayer", () => false),
                      Match.exhaustive,
                      Function.apply(p),
                    ),
                  ),
                ),
              ),
              Array.map((s) => s.hour),
            ),
          ),
          Effect.let("overfillHours", ({ schedulesWithPlayers, user }) =>
            pipe(
              schedulesWithPlayers,
              Array.filter((s) => !s.breakHour),
              Array.filter((s) =>
                pipe(
                  s.overfills,
                  Array.some((p) =>
                    pipe(
                      Match.type<Schema.Player | Schema.PartialNamePlayer>(),
                      Match.tag("Player", (player) =>
                        String.Equivalence(player.id, user.id),
                      ),
                      Match.tag("PartialNamePlayer", () => false),
                      Match.exhaustive,
                      Function.apply(p),
                    ),
                  ),
                ),
              ),
              Array.map((s) => s.hour),
            ),
          ),
          Effect.let("standbyHours", ({ schedulesWithPlayers, user }) =>
            pipe(
              schedulesWithPlayers,
              Array.filter((s) => !s.breakHour),
              Array.filter((s) =>
                pipe(
                  s.standbys,
                  Array.some((p) =>
                    pipe(
                      Match.type<Schema.Player | Schema.PartialNamePlayer>(),
                      Match.tag("Player", (player) =>
                        String.Equivalence(player.id, user.id),
                      ),
                      Match.tag("PartialNamePlayer", () => false),
                      Match.exhaustive,
                      Function.apply(p),
                    ),
                  ),
                ),
              ),
              Array.map((s) => s.hour),
            ),
          ),
          InteractionContext.editReply.tapEffect(
            ({ day, user, fillHours, overfillHours, standbyHours }) =>
              pipe(
                ClientService.makeEmbedBuilder(),
                Effect.map((embed) => ({
                  embeds: [
                    embed
                      .setTitle(`${user.username}'s Schedule for Day ${day}`)
                      .addFields(
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
