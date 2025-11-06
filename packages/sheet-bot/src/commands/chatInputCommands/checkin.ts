import { checkinButton } from "@/messageComponents";
import {
  channelServicesFromGuildChannelId,
  ConverterService,
  FormatService,
  GuildConfigService,
  guildServicesFromInteractionOption,
  InteractionContext,
  MessageCheckinService,
  PermissionService,
  PlayerService,
  SendableChannelContext,
  SheetService,
} from "@/services";
import {
  chatInputCommandSubcommandHandlerContextBuilder,
  ChatInputSubcommandHandlerVariantT,
  handlerVariantContextBuilder,
} from "@/types";
import { bindObject } from "@/utils";
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
  DateTime,
  Effect,
  HashMap,
  Match,
  Option,
  pipe,
  HashSet,
} from "effect";
import { Schema } from "sheet-apis";
import { Array as ArrayUtils, Utils } from "typhoon-core/utils";

const getCheckinData = ({
  hour,
  runningChannel,
}: {
  hour: number;
  runningChannel: Schema.GuildChannelConfig;
}) =>
  pipe(
    Effect.Do,
    bindObject({
      channelName: runningChannel.name,
    }),
    Effect.bind("schedules", ({ channelName }) =>
      pipe(
        SheetService.channelSchedules(channelName),
        Effect.map(
          Array.map((s) =>
            pipe(
              s.hour,
              Option.map((hour) => ({ hour, schedule: s })),
            ),
          ),
        ),
        Effect.map(Array.getSomes),
        Effect.map(ArrayUtils.Collect.toHashMapByKey("hour")),
        Effect.map(HashMap.map(({ schedule }) => schedule)),
      ),
    ),
    Effect.flatMap(({ schedules }) =>
      pipe(
        {
          prevSchedule: HashMap.get(schedules, hour - 1),
          schedule: HashMap.get(schedules, hour),
        },
        Utils.mapPositional(
          Utils.arraySomesPositional(PlayerService.mapScheduleWithPlayers),
        ),
      ),
    ),
    Effect.map(({ prevSchedule, schedule }) => ({
      prevSchedule,
      schedule,
      runningChannel,
      showChannelMention: Option.isNone(runningChannel.roleId),
    })),
  );

const getCheckinMessages = (
  data: {
    prevSchedule: Option.Option<
      Schema.ScheduleWithPlayers | Schema.BreakSchedule
    >;
    schedule: Option.Option<Schema.ScheduleWithPlayers | Schema.BreakSchedule>;
    runningChannel: {
      channelId: string;
      name: Option.Option<string>;
    };
    showChannelMention: boolean;
  },
  template: Option.Option<string>,
) =>
  FormatService.formatCheckIn({
    prevSchedule: data.prevSchedule,
    schedule: data.schedule,
    channelString: data.showChannelMention
      ? `head to ${channelMention(data.runningChannel.channelId)}`
      : pipe(
          data.runningChannel.name,
          Option.map((name) => `head to ${name}`),
          Option.getOrElse(
            () =>
              "await further instructions from the manager on where the running channel is",
          ),
        ),
    template: pipe(template, Option.getOrUndefined),
  });

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
        )
        .addStringOption((option) =>
          option
            .setName("template")
            .setDescription(
              "Optional Handlebars template for the check-in message",
            ),
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
              GuildConfigService.getGuildManagerRoles(),
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
            templateOption: InteractionContext.getString("template"),
          }),
          Effect.bind("hour", ({ hourOption }) =>
            pipe(
              hourOption,
              Option.match({
                onSome: Effect.succeed,
                onNone: () =>
                  pipe(
                    DateTime.now,
                    Effect.map(DateTime.addDuration("20 minutes")),
                    Effect.flatMap(ConverterService.convertDateTimeToHour),
                  ),
              }),
            ),
          ),
          Effect.bind("runningChannel", ({ channelNameOption }) =>
            pipe(
              channelNameOption,
              Option.match({
                onSome: (channelName) =>
                  GuildConfigService.getGuildRunningChannelByName(channelName),
                onNone: () =>
                  pipe(
                    InteractionContext.channel(true).sync(),
                    Effect.flatMap((channel) =>
                      GuildConfigService.getGuildRunningChannelById(channel.id),
                    ),
                  ),
              }),
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
              checkinData.schedule,
              Option.map((schedule) =>
                pipe(
                  Match.value(schedule),
                  Match.tagsExhaustive({
                    BreakSchedule: () => [],
                    ScheduleWithPlayers: (schedule) => schedule.fills,
                  }),
                ),
              ),
              Option.getOrElse(() => []),
              Array.getSomes,
              Array.map((player) =>
                pipe(
                  Match.value(player),
                  Match.tagsExhaustive({
                    Player: (player) => Option.some(player.id),
                    PartialNamePlayer: () => Option.none(),
                  }),
                ),
              ),
              Array.getSomes,
              HashSet.fromIterable,
              HashSet.toValues,
            ),
          ),
          Effect.bind("checkinMessages", ({ checkinData, templateOption }) =>
            getCheckinMessages(checkinData, templateOption),
          ),
          Effect.bind(
            "message",
            ({ checkinData, checkinMessages, checkinChannelId }) =>
              pipe(
                checkinMessages.checkinMessage,
                Effect.transposeMapOption((checkinMessage) =>
                  pipe(
                    Effect.Do,
                    Effect.let("initialMessage", () => checkinMessage),
                    SendableChannelContext.send().bind("message", () => ({
                      content: checkinMessage,
                      components: checkinData.runningChannel.roleId
                        ? [
                            new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
                              new ButtonBuilder(checkinButton.data),
                            ),
                          ]
                        : [],
                    })),
                  ),
                ),
                Effect.provide(
                  channelServicesFromGuildChannelId(checkinChannelId),
                ),
              ),
          ),
          Effect.tap(({ checkinData, message, fillIds, hour }) =>
            pipe(
              message,
              Effect.transposeMapOption(({ initialMessage, message }) =>
                Effect.all(
                  [
                    MessageCheckinService.upsertMessageCheckinData(message.id, {
                      initialMessage,
                      hour,
                      channelId: checkinData.runningChannel.channelId,
                      roleId: Option.getOrNull(
                        checkinData.runningChannel.roleId,
                      ),
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
