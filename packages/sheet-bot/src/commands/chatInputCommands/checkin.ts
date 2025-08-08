import { addMinutes, getUnixTime } from "date-fns/fp";
import {
  ActionRowBuilder,
  ApplicationIntegrationType,
  ButtonBuilder,
  ChatInputCommandInteraction,
  InteractionContextType,
  MessageActionRowComponentBuilder,
  MessageFlags,
  SlashCommandBuilder,
  SlashCommandSubcommandBuilder,
} from "discord.js";
import { Array, Effect, HashMap, Option, pipe } from "effect";
import { observeOnce } from "typhoon-server/signal";
import { checkinButton } from "../../buttons";
import {
  emptySchedule,
  GuildConfigService,
  MessageCheckinService,
  PermissionService,
  Schedule,
  ScheduleService,
  SheetService,
} from "../../services";
import {
  chatInputCommandHandlerContextWithSubcommandHandlerBuilder,
  chatInputSubcommandHandlerContextBuilder,
  InteractionContext,
} from "../../types";

const getCheckinData = ({
  hour,
  channelName,
  serverId,
}: {
  hour: number;
  channelName: string;
  serverId: string;
}) =>
  pipe(
    Effect.Do,
    Effect.bindAll(
      () => ({
        eventConfig: SheetService.getEventConfig(),
        schedules: SheetService.getAllSchedules(),
      }),
      { concurrency: "unbounded" },
    ),
    Effect.let("prevSchedule", ({ schedules }) =>
      pipe(
        HashMap.get(schedules, hour - 1),
        Option.getOrElse(() => emptySchedule(hour - 1)),
      ),
    ),
    Effect.let("schedule", ({ schedules }) =>
      pipe(
        HashMap.get(schedules, hour),
        Option.getOrElse(() => emptySchedule(hour)),
      ),
    ),
    Effect.bind("runningChannel", () =>
      pipe(
        GuildConfigService.getRunningChannelByName(serverId, channelName),
        Effect.flatMap((computed) => observeOnce(computed.value)),
        Effect.flatMap(Array.head),
      ),
    ),
    Effect.map(({ eventConfig, prevSchedule, schedule, runningChannel }) => ({
      startTime: eventConfig.startTime,
      prevSchedule,
      schedule,
      runningChannel: {
        channelId: runningChannel.channelId,
        roleId: runningChannel.roleId,
      },
    })),
  );

const getCheckinMessages = (data: {
  startTime: number;
  prevSchedule: Schedule;
  schedule: Schedule;
  runningChannel: {
    channelId: string;
  };
}) =>
  pipe(
    Effect.Do,
    Effect.bind("emptySlotsMessage", () =>
      ScheduleService.formatCheckinEmptySlots(data.schedule),
    ),
    Effect.bind("checkinMessage", () =>
      ScheduleService.formatCheckIn({
        startTime: data.startTime,
        prevSchedule: data.prevSchedule,
        schedule: data.schedule,
        channelId: data.runningChannel.channelId,
      }),
    ),
    Effect.map(({ emptySlotsMessage, checkinMessage }) => ({
      emptySlotsMessage,
      checkinMessage,
    })),
  );

const handleManual = chatInputSubcommandHandlerContextBuilder()
  .data(
    new SlashCommandSubcommandBuilder()
      .setName("manual")
      .setDescription("Manually check in users")
      .addStringOption((option) =>
        option
          .setName("channel_name")
          .setDescription("The name of the running channel")
          .setRequired(true),
      )
      .addNumberOption((option) =>
        option.setName("hour").setDescription("The hour to check in users for"),
      )
      .addStringOption((option) =>
        option
          .setName("server_id")
          .setDescription("The server to check in users for"),
      ),
  )
  .handler(
    pipe(
      Effect.Do,
      Effect.bind("interaction", () =>
        InteractionContext.interaction<ChatInputCommandInteraction>(),
      ),
      Effect.tap(({ interaction }) =>
        Effect.tryPromise(() =>
          interaction.deferReply({ flags: MessageFlags.Ephemeral }),
        ),
      ),
      Effect.bindAll(({ interaction }) => ({
        hourOption: pipe(
          Effect.try(() => interaction.options.getNumber("hour")),
          Effect.map(Option.fromNullable),
        ),
        channelName: pipe(
          Effect.try(() => interaction.options.getString("channel_name", true)),
        ),
        serverId: pipe(
          Effect.try(
            () =>
              interaction.options.getString("server_id") ?? interaction.guildId,
          ),
          Effect.flatMap(Option.fromNullable),
        ),
        user: Effect.succeed(interaction.user),
      })),
      Effect.tap(({ serverId, interaction }) =>
        serverId !== interaction.guildId
          ? PermissionService.checkOwner(interaction)
          : Effect.void,
      ),
      Effect.bind("managerRoles", ({ serverId }) =>
        serverId
          ? pipe(
              GuildConfigService.getManagerRoles(serverId),
              Effect.flatMap((computed) => observeOnce(computed.value)),
            )
          : Effect.succeed([]),
      ),
      Effect.tap(({ managerRoles, interaction }) =>
        PermissionService.checkRoles(
          interaction,
          managerRoles.map((role) => role.roleId),
          "You can only check in users as a manager",
        ),
      ),
      Effect.bind("sheetService", ({ serverId }) =>
        SheetService.ofGuild(serverId),
      ),
      Effect.bindAll(
        ({ sheetService }) => ({
          eventConfig: pipe(
            SheetService.getEventConfig(),
            Effect.provide(sheetService),
          ),
          playerMap: pipe(
            SheetService.getPlayers(),
            Effect.map(
              Array.map(({ id, name }) =>
                Option.isSome(id) && Option.isSome(name)
                  ? Option.some({ id: id.value, name: name.value })
                  : Option.none(),
              ),
            ),
            Effect.map(Array.getSomes),
            Effect.map(Array.map(({ id, name }) => [name, id] as const)),
            Effect.map(HashMap.fromIterable),
            Effect.provide(sheetService),
          ),
        }),
        { concurrency: "unbounded" },
      ),
      Effect.let("hour", ({ hourOption, eventConfig }) =>
        pipe(
          hourOption,
          Option.getOrElse(() =>
            Math.floor(
              (pipe(new Date(), addMinutes(20), getUnixTime) -
                eventConfig.startTime) /
                3600 +
                1,
            ),
          ),
        ),
      ),
      Effect.bind(
        "checkinData",
        ({ hour, channelName, serverId, sheetService }) =>
          pipe(
            getCheckinData({ hour, channelName, serverId }),
            Effect.provide(sheetService),
          ),
      ),
      Effect.let("fillIds", ({ checkinData, playerMap }) =>
        pipe(
          checkinData.schedule.fills,
          Array.map(Option.fromNullable),
          Array.getSomes,
          Array.map((player) => pipe(HashMap.get(playerMap, player))),
          Array.getSomes,
        ),
      ),
      Effect.bind("checkinMessages", ({ checkinData, sheetService }) =>
        pipe(getCheckinMessages(checkinData), Effect.provide(sheetService)),
      ),
      Effect.tap(
        ({ hour, checkinData, fillIds, checkinMessages, interaction }) =>
          pipe(
            Effect.tryPromise(() =>
              interaction.editReply({
                content: checkinMessages.emptySlotsMessage,
              }),
            ),
            Effect.andThen(() =>
              Effect.tryPromise(() =>
                interaction.followUp({
                  content: checkinMessages.checkinMessage,
                  components: checkinData.runningChannel.roleId
                    ? [
                        new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
                          new ButtonBuilder(checkinButton.data),
                        ),
                      ]
                    : [],
                }),
              ),
            ),
            Effect.tap((message) =>
              checkinData.runningChannel.roleId
                ? pipe(
                    Effect.all(
                      [
                        MessageCheckinService.upsertMessageCheckinData(
                          message.id,
                          {
                            initialMessage: checkinMessages.checkinMessage,
                            hour,
                            roleId: checkinData.runningChannel.roleId,
                          },
                        ),
                        Array.isEmptyArray(fillIds)
                          ? Effect.void
                          : MessageCheckinService.addMessageCheckinMembers(
                              message.id,
                              fillIds,
                            ),
                      ],
                      { concurrency: "unbounded" },
                    ),
                    Effect.asVoid,
                  )
                : Effect.void,
            ),
          ),
      ),
      Effect.asVoid,
    ),
  )
  .build();

export const command =
  chatInputCommandHandlerContextWithSubcommandHandlerBuilder()
    .data(
      new SlashCommandBuilder()
        .setName("checkin")
        .setDescription("Checkin commands")
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
    .addSubcommandHandler(handleManual)
    .build();
