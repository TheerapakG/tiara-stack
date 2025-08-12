import { addMinutes, getUnixTime } from "date-fns/fp";
import {
  ActionRowBuilder,
  ApplicationIntegrationType,
  ButtonBuilder,
  ChatInputCommandInteraction,
  InteractionContextType,
  Message,
  MessageActionRowComponentBuilder,
  MessageFlags,
  SlashCommandBuilder,
  SlashCommandSubcommandBuilder,
} from "discord.js";
import { Array, Cause, Effect, HashMap, Layer, Option, pipe } from "effect";
import { observeOnce } from "typhoon-server/signal";
import { checkinButton } from "../../buttons";
import {
  emptySchedule,
  GuildConfigService,
  guildServices,
  MessageCheckinService,
  PermissionService,
  PlayerService,
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
}: {
  hour: number;
  channelName: string;
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
        GuildConfigService.getRunningChannelByName(channelName),
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
        channelName,
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
    channelName: string;
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
        channelName: data.runningChannel.channelName,
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
      InteractionContext.interaction<ChatInputCommandInteraction>(),
      InteractionContext.tapDeferReply({ flags: MessageFlags.Ephemeral }),
      Effect.flatMap((interaction) =>
        pipe(
          Effect.Do,
          PermissionService.tapCheckOwner({ allowSameGuild: true }),
          PermissionService.tapCheckRoles(
            pipe(
              GuildConfigService.getManagerRoles(),
              Effect.flatMap((computed) => observeOnce(computed.value)),
              Effect.map((managerRoles) =>
                managerRoles.map((role) => role.roleId),
              ),
            ),
            "You can only check in users as a manager",
          ),
          Effect.bindAll(
            () => ({
              hourOption: InteractionContext.getNumber("hour"),
              channelName: InteractionContext.getString("channel_name", true),
              channel: pipe(interaction.channel, Option.fromNullable),
              user: Effect.succeed(interaction.user),
            }),
            { concurrency: "unbounded" },
          ),
          Effect.bind("eventConfig", () => SheetService.getEventConfig()),
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
          Effect.bind("checkinData", ({ hour, channelName }) =>
            getCheckinData({ hour, channelName }),
          ),
          Effect.bind("fillIds", ({ checkinData }) =>
            pipe(
              checkinData.schedule.fills,
              Array.map(Option.fromNullable),
              Array.getSomes,
              Effect.forEach((playerName) =>
                PlayerService.getByName(playerName),
              ),
              Effect.map(Array.getSomes),
              Effect.map(Array.map((p) => p.id)),
            ),
          ),
          Effect.bind("checkinMessages", ({ checkinData }) =>
            getCheckinMessages(checkinData),
          ),
          Effect.tap(
            ({ hour, checkinData, fillIds, checkinMessages, channel }) =>
              pipe(
                channel.isSendable()
                  ? Effect.tryPromise<Message<boolean>>(() =>
                      channel.send({
                        content: checkinMessages.checkinMessage,
                        components: checkinData.runningChannel.roleId
                          ? [
                              new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
                                new ButtonBuilder(checkinButton.data),
                              ),
                            ]
                          : [],
                      }),
                    )
                  : (Effect.fail(
                      "Cannot send message to this channel",
                    ) as Effect.Effect<
                      Message<boolean>,
                      string | Cause.UnknownException,
                      never
                    >),
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
                InteractionContext.tapEditReply({
                  content: checkinMessages.emptySlotsMessage,
                }),
              ),
          ),
          Effect.provide(
            pipe(
              InteractionContext.getString("server_id"),
              Effect.map(Option.getOrElse(() => interaction.guildId)),
              Effect.flatMap(Option.fromNullable),
              Effect.map(guildServices),
              Layer.unwrapEffect,
            ),
          ),
        ),
      ),
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
