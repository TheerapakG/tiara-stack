import { checkinButton } from "@/messageComponents";
import {
  channelServicesFromGuildChannelId,
  FormatService,
  GuildChannelConfig,
  GuildConfigService,
  guildServicesFromInteractionOption,
  InteractionContext,
  MessageCheckinService,
  PartialNamePlayer,
  PermissionService,
  Player,
  PlayerService,
  Schedule,
  ScheduleWithPlayers,
  SendableChannelContext,
  SheetService,
} from "@/services";
import {
  chatInputCommandSubcommandHandlerContextBuilder,
  ChatInputSubcommandHandlerVariantT,
  handlerVariantContextBuilder,
} from "@/types";
import { bindObject } from "@/utils";
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
import {
  Array,
  Data,
  Effect,
  Function,
  HashMap,
  Match,
  Option,
  pipe,
} from "effect";
import { observeOnce } from "typhoon-server/signal";

class ArgumentError extends Data.TaggedError("ArgumentError")<{
  readonly message: string;
}> {
  constructor(message: string) {
    super({ message });
  }
}

const getCheckinData = ({
  hour,
  runningChannel,
}: {
  hour: number;
  runningChannel: GuildChannelConfig;
}) =>
  pipe(
    Effect.Do,
    bindObject({
      schedules: SheetService.getAllSchedules(),
    }),
    Effect.bind("prevSchedule", ({ schedules }) =>
      pipe(
        HashMap.get(schedules, hour - 1),
        Option.getOrElse(() => Schedule.empty(hour - 1)),
        PlayerService.mapScheduleWithPlayers,
      ),
    ),
    Effect.bind("schedule", ({ schedules }) =>
      pipe(
        HashMap.get(schedules, hour),
        Option.getOrElse(() => Schedule.empty(hour)),
        PlayerService.mapScheduleWithPlayers,
      ),
    ),
    Effect.map(({ prevSchedule, schedule }) => ({
      prevSchedule,
      schedule,
      runningChannel,
      showChannelMention: Option.isNone(runningChannel.roleId),
    })),
  );

const getCheckinMessages = (data: {
  prevSchedule: ScheduleWithPlayers;
  schedule: ScheduleWithPlayers;
  runningChannel: {
    channelId: string;
    name: Option.Option<string>;
  };
  showChannelMention: boolean;
}) =>
  pipe(
    Effect.Do,
    Effect.bind("managerCheckinMessage", () =>
      FormatService.formatManagerCheckinMessage(data.schedule),
    ),
    Effect.bind("checkinMessage", () =>
      FormatService.formatCheckIn({
        prevSchedule: data.prevSchedule,
        schedule: data.schedule,
        channelString: data.showChannelMention
          ? `head to ${channelMention(data.runningChannel.channelId)}`
          : pipe(
              data.runningChannel.name,
              Option.match({
                onSome: (name) => `head to ${name}`,
                onNone: () =>
                  "await further instructions from the manager on where the running channel is",
              }),
            ),
      }),
    ),
    Effect.map(({ managerCheckinMessage, checkinMessage }) => ({
      managerCheckinMessage,
      checkinMessage,
    })),
  );

const handleManual =
  handlerVariantContextBuilder<ChatInputSubcommandHandlerVariantT>()
    .data(
      new SlashCommandSubcommandBuilder()
        .setName("manual")
        .setDescription("Manually check in users")
        .addStringOption((option) =>
          option
            .setName("channel_name")
            .setDescription("The name of the running channel"),
        )
        .addNumberOption((option) =>
          option
            .setName("hour")
            .setDescription("The hour to check in users for"),
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
          PermissionService.checkRoles.tapEffect(() =>
            pipe(
              GuildConfigService.getManagerRoles(),
              Effect.flatMap(observeOnce),
              Effect.map((roles) => ({
                roles: pipe(
                  roles,
                  Array.map((role) => role.roleId),
                ),
                reason: "You can only check in users as a manager",
              })),
            ),
          ),
          InteractionContext.user.bind("user"),
          bindObject({
            hourOption: InteractionContext.getNumber("hour"),
            channelNameOption: InteractionContext.getString("channel_name"),
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
          Effect.bind("runningChannel", ({ channelNameOption }) =>
            pipe(
              channelNameOption,
              Option.match({
                onSome: (channelName) =>
                  GuildConfigService.getRunningChannelByName(channelName),
                onNone: () =>
                  pipe(
                    InteractionContext.channel(true).sync(),
                    Effect.flatMap((channel) =>
                      GuildConfigService.getRunningChannelById(channel.id),
                    ),
                  ),
              }),
              Effect.flatMap(observeOnce),
              Effect.flatMap(
                Option.match({
                  onSome: (channel) => Effect.succeed(channel),
                  onNone: () =>
                    Effect.fail(new ArgumentError("No such running channel")),
                }),
              ),
            ),
          ),
          Effect.bind("checkinChannelId", ({ runningChannel }) =>
            pipe(
              runningChannel.checkinChannelId,
              Option.match({
                onSome: Effect.succeed,
                onNone: () => InteractionContext.channelId(true).sync(),
              }),
            ),
          ),
          Effect.bind("checkinData", ({ hour, runningChannel }) =>
            getCheckinData({ hour, runningChannel }),
          ),
          Effect.let("fillIds", ({ checkinData }) =>
            pipe(
              checkinData.schedule.fills,
              Array.getSomes,
              Array.map((player) =>
                pipe(
                  Match.type<Player | PartialNamePlayer>(),
                  Match.tag("Player", (player) => Option.some(player.id)),
                  Match.tag("PartialNamePlayer", () => Option.none()),
                  Match.exhaustive,
                  Function.apply(player),
                ),
              ),
              Array.getSomes,
            ),
          ),
          Effect.bind("checkinMessages", ({ checkinData }) =>
            getCheckinMessages(checkinData),
          ),
          Effect.bind(
            "message",
            ({ checkinData, checkinMessages, checkinChannelId }) =>
              pipe(
                SendableChannelContext.send().sync({
                  content: checkinMessages.checkinMessage,
                  components: checkinData.runningChannel.roleId
                    ? [
                        new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
                          new ButtonBuilder(checkinButton.data),
                        ),
                      ]
                    : [],
                }),
                Effect.provide(
                  channelServicesFromGuildChannelId(checkinChannelId),
                ),
              ),
          ),
          Effect.tap(
            ({ checkinData, message, fillIds, checkinMessages, hour }) =>
              Effect.all(
                [
                  MessageCheckinService.upsertMessageCheckinData(message.id, {
                    initialMessage: checkinMessages.checkinMessage,
                    hour,
                    channelId: checkinData.runningChannel.channelId,
                    roleId: Option.getOrNull(checkinData.runningChannel.roleId),
                  }),
                  pipe(
                    MessageCheckinService.addMessageCheckinMembers(
                      message.id,
                      fillIds,
                    ),
                    Effect.unless(() => Array.isEmptyArray(fillIds)),
                  ),
                ],
                { concurrency: "unbounded" },
              ),
          ),
          InteractionContext.editReply.tap(({ checkinMessages }) => ({
            content: checkinMessages.managerCheckinMessage,
          })),
          Effect.asVoid,
          Effect.withSpan("handleCheckinManual", { captureStackTrace: true }),
        ),
      ),
    )
    .build();

export const command = chatInputCommandSubcommandHandlerContextBuilder()
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
