import { addMinutes, getUnixTime } from "date-fns/fp";
import {
  ActionRowBuilder,
  ApplicationIntegrationType,
  ButtonBuilder,
  InteractionContextType,
  MessageActionRowComponentBuilder,
  MessageFlags,
  SlashCommandBuilder,
  SlashCommandSubcommandBuilder,
} from "discord.js";
import { Array, Data, Effect, HashMap, Option, pipe } from "effect";
import { observeOnce } from "typhoon-server/signal";
import { checkinButton } from "../../buttons";
import {
  channelServicesFromInteraction,
  emptySchedule,
  GuildConfigService,
  guildServicesFromInteractionOption,
  InteractionContext,
  MessageCheckinService,
  PermissionService,
  PlayerService,
  Schedule,
  ScheduleService,
  SendableChannelContext,
  SheetService,
} from "../../services";
import {
  chatInputCommandHandlerContextWithSubcommandHandlerBuilder,
  chatInputSubcommandHandlerContextBuilder,
} from "../../types";
import { bindObject } from "../../utils";

class ArgumentError extends Data.TaggedError("ArgumentError")<{
  readonly message: string;
}> {
  constructor(message: string) {
    super({ message });
  }
}

const getCheckinData = ({
  hour,
  channelName,
}: {
  hour: number;
  channelName: string;
}) =>
  pipe(
    Effect.Do,
    bindObject({
      eventConfig: SheetService.getEventConfig(),
      schedules: SheetService.getAllSchedules(),
      runningChannel: pipe(
        GuildConfigService.getRunningChannelByName(channelName),
        Effect.flatMap(observeOnce),
        Effect.flatMap(
          Option.match({
            onSome: (channel) => Effect.succeed(channel),
            onNone: () =>
              Effect.fail(
                new ArgumentError(`No such running channel: ${channelName}`),
              ),
          }),
        ),
      ),
    }),
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
    Effect.provide(guildServicesFromInteractionOption("server_id"))(
      pipe(
        Effect.Do,
        InteractionContext.tapDeferReply(() => ({
          flags: MessageFlags.Ephemeral,
        })),
        PermissionService.tapCheckOwner(() => ({ allowSameGuild: true })),
        PermissionService.tapCheckRoles(() => ({
          roles: pipe(
            GuildConfigService.getManagerRoles(),
            Effect.flatMap(observeOnce),
            Effect.map(Array.map((role) => role.roleId)),
          ),
          reason: "You can only check in users as a manager",
        })),
        bindObject({
          hourOption: InteractionContext.getNumber("hour"),
          channelName: InteractionContext.getString("channel_name", true),
          user: InteractionContext.user(),
          eventConfig: SheetService.getEventConfig(),
        }),
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
            Effect.forEach((playerName) => PlayerService.getByName(playerName)),
            Effect.map(Array.getSomes),
            Effect.map(Array.map((p) => p.id)),
          ),
        ),
        Effect.bind("checkinMessages", ({ checkinData }) =>
          getCheckinMessages(checkinData),
        ),
        Effect.bind("message", ({ checkinData, checkinMessages }) =>
          pipe(
            SendableChannelContext.send({
              content: checkinMessages.checkinMessage,
              components: checkinData.runningChannel.roleId
                ? [
                    new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
                      new ButtonBuilder(checkinButton.data),
                    ),
                  ]
                : [],
            }),
            Effect.provide(channelServicesFromInteraction()),
          ),
        ),
        Effect.tap(
          ({ checkinData, message, fillIds, checkinMessages, hour }) =>
            checkinData.runningChannel.roleId
              ? pipe(
                  Effect.all(
                    [
                      MessageCheckinService.upsertMessageCheckinData(
                        message.id,
                        {
                          initialMessage: checkinMessages.checkinMessage,
                          hour,
                          channelId: checkinData.runningChannel.channelId,
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
        InteractionContext.tapEditReply(({ checkinMessages }) => ({
          content: checkinMessages.emptySlotsMessage,
        })),
        Effect.asVoid,
        Effect.withSpan("handleCheckinManual", { captureStackTrace: true }),
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
