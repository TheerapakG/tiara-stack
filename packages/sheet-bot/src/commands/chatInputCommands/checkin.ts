import { addMinutes, getUnixTime } from "date-fns/fp";
import {
  ActionRowBuilder,
  ApplicationIntegrationType,
  ButtonBuilder,
  channelMention,
  InteractionContextType,
  MessageActionRowComponentBuilder,
  MessageFlags,
  SlashCommandBuilder,
  SlashCommandSubcommandBuilder,
} from "discord.js";
import { Array, Data, Effect, HashMap, Option, pipe } from "effect";
import { observeOnce } from "typhoon-server/signal";
import { checkinButton } from "../../messageComponents";
import {
  channelServicesFromInteraction,
  FormatService,
  GuildConfigService,
  guildServicesFromInteractionOption,
  InteractionContext,
  MessageCheckinService,
  PermissionService,
  PlayerService,
  Schedule,
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
        Option.getOrElse(() => Schedule.empty(hour - 1)),
      ),
    ),
    Effect.let("schedule", ({ schedules }) =>
      pipe(
        HashMap.get(schedules, hour),
        Option.getOrElse(() => Schedule.empty(hour)),
      ),
    ),
    Effect.map(({ prevSchedule, schedule, runningChannel }) => ({
      prevSchedule,
      schedule,
      runningChannel: {
        channelId: runningChannel.channelId,
        channelName,
        roleId: runningChannel.roleId,
      },
      showChannelMention: runningChannel.roleId !== null,
    })),
  );

const getCheckinMessages = (data: {
  prevSchedule: Schedule;
  schedule: Schedule;
  runningChannel: {
    channelId: string;
    channelName: string;
  };
  showChannelMention: boolean;
}) =>
  pipe(
    Effect.Do,
    Effect.bind("emptySlotsMessage", () =>
      FormatService.formatCheckinEmptySlots(data.schedule),
    ),
    Effect.bind("checkinMessage", () =>
      FormatService.formatCheckIn({
        prevSchedule: data.prevSchedule,
        schedule: data.schedule,
        channel: data.showChannelMention
          ? channelMention(data.runningChannel.channelId)
          : data.runningChannel.channelName,
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
        InteractionContext.deferReply.tap(() => ({
          flags: MessageFlags.Ephemeral,
        })),
        PermissionService.checkOwner.tap(() => ({ allowSameGuild: true })),
        PermissionService.tapCheckEffectRoles(() => ({
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
        Effect.tap(({ checkinData, message, fillIds, checkinMessages, hour }) =>
          Effect.all(
            [
              MessageCheckinService.upsertMessageCheckinData(message.id, {
                initialMessage: checkinMessages.checkinMessage,
                hour,
                channelId: checkinData.runningChannel.channelId,
                roleId: Option.getOrNull(checkinData.runningChannel.roleId),
              }),
              Array.isEmptyArray(fillIds)
                ? Effect.void
                : MessageCheckinService.addMessageCheckinMembers(
                    message.id,
                    fillIds,
                  ),
            ],
            { concurrency: "unbounded" },
          ),
        ),
        InteractionContext.editReply.tap(({ checkinMessages }) => ({
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
