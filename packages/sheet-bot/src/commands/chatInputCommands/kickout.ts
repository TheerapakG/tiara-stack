import {
  ConverterService,
  GuildConfigService,
  GuildMemberContext,
  guildMemberServices,
  GuildService,
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
import { bindObject } from "@/utils";
import {
  ApplicationIntegrationType,
  InteractionContextType,
  SlashCommandBuilder,
  SlashCommandSubcommandBuilder,
  userMention,
} from "discord.js";
import {
  Array,
  Data,
  DateTime,
  Effect,
  Function,
  HashMap,
  Match,
  Number,
  Option,
  Order,
  pipe,
  flow,
} from "effect";
import { Schema } from "sheet-apis";
import { UntilObserver } from "typhoon-core/signal";
import { Array as ArrayUtils, Utils } from "typhoon-core/utils";

class TimeError extends Data.TaggedError("TimeError")<{
  readonly message: string;
}> {
  constructor(message: string) {
    super({ message });
  }
}

const getKickoutData = ({
  hour,
  runningChannel,
}: {
  hour: number;
  runningChannel: Schema.GuildChannelConfig;
}) =>
  pipe(
    Effect.Do,
    Effect.bind("schedules", () =>
      pipe(
        runningChannel.name,
        Effect.flatMap(SheetService.channelSchedules),
        UntilObserver.observeUntilRpcResultResolved(),
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
    Effect.bind("schedule", ({ schedules }) =>
      pipe(
        {
          schedule: HashMap.get(schedules, hour),
        },
        Utils.mapPositional(
          Utils.arraySomesPositional(
            flow(
              PlayerService.mapScheduleWithPlayers,
              UntilObserver.observeUntilRpcResultResolved(),
            ),
          ),
        ),
      ),
    ),
    Effect.map(({ schedule }) => ({
      schedule: schedule.schedule,
      runningChannel,
    })),
  );

const handleManual =
  handlerVariantContextBuilder<ChatInputSubcommandHandlerVariantT>()
    .data(
      new SlashCommandSubcommandBuilder()
        .setName("manual")
        .setDescription("Manually kick out users")
        .addStringOption((option) =>
          option
            .setName("channel_name")
            .setDescription("The name of the running channel"),
        )
        .addStringOption((option) =>
          option
            .setName("server_id")
            .setDescription("The server to kick out users for"),
        ),
    )
    .handler(
      Effect.provide(guildServicesFromInteractionOption("server_id"))(
        pipe(
          Effect.Do,
          InteractionContext.deferReply.tap(),
          PermissionService.checkOwner.tap(() => ({ allowSameGuild: true })),
          PermissionService.checkRoles.tapEffect(() =>
            pipe(
              GuildConfigService.getGuildManagerRoles(),
              UntilObserver.observeUntilRpcResultResolved(),
              Effect.map(Array.map((role) => role.roleId)),
              Effect.map((roles) => ({
                roles,
                reason: "You can only kick out users as a manager",
              })),
            ),
          ),
          bindObject({
            hourOption: InteractionContext.getNumber("hour"),
            channelNameOption: InteractionContext.getString("channel_name"),
            guildName: GuildService.getName(),
          }),
          Effect.bind("date", () => DateTime.now),
          Effect.tap(({ date }) =>
            pipe(
              Effect.fail(
                new TimeError("Cannot kick out until next hour starts"),
              ),
              Effect.when(() => pipe(date, DateTime.getPart("minutes")) >= 40),
            ),
          ),
          Effect.bind("hour", ({ date, hourOption }) =>
            pipe(
              hourOption,
              Option.match({
                onSome: Effect.succeed,
                onNone: () =>
                  pipe(
                    date,
                    DateTime.addDuration("20 minutes"),
                    ConverterService.convertDateTimeToHour,
                  ),
              }),
            ),
          ),
          Effect.bind("runningChannel", ({ channelNameOption }) =>
            pipe(
              channelNameOption,
              Option.match({
                onSome: (channelName) =>
                  pipe(
                    GuildConfigService.getGuildRunningChannelByName(
                      channelName,
                    ),
                    UntilObserver.observeUntilRpcResultResolved(),
                    Effect.flatMap(Function.identity),
                  ),
                onNone: () =>
                  pipe(
                    InteractionContext.channel(true).sync(),
                    Effect.flatMap((channel) =>
                      pipe(
                        GuildConfigService.getGuildRunningChannelById(
                          channel.id,
                        ),
                        UntilObserver.observeUntilRpcResultResolved(),
                        Effect.flatMap(Function.identity),
                      ),
                    ),
                  ),
              }),
            ),
          ),
          Effect.bind("kickoutData", ({ hour, runningChannel }) =>
            getKickoutData({ hour, runningChannel }),
          ),
          Effect.bind("role", ({ kickoutData }) =>
            pipe(
              kickoutData.runningChannel.roleId,
              Effect.tap(() => GuildService.fetchMembers()),
              Effect.flatMap((roleId) => GuildService.fetchRole(roleId)),
              Effect.flatMap(Function.identity),
            ),
          ),
          Effect.let("fillIds", ({ kickoutData }) =>
            pipe(
              kickoutData.schedule,
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
                  Match.value(player.player),
                  Match.tagsExhaustive({
                    Player: (player) => Option.some(player.id),
                    PartialNamePlayer: () => Option.none(),
                  }),
                ),
              ),
              Array.getSomes,
            ),
          ),
          Effect.let("removedMembers", ({ fillIds, role }) =>
            pipe(
              role.members.values(),
              Array.filter((member) => !fillIds.includes(member.id)),
            ),
          ),
          Effect.tap(({ removedMembers, role }) =>
            pipe(
              removedMembers,
              Effect.forEach((member) =>
                Effect.provide(guildMemberServices(member))(
                  GuildMemberContext.removeRoles.sync(role),
                ),
              ),
            ),
          ),
          InteractionContext.editReply.tap(({ removedMembers }) => ({
            content: pipe(
              removedMembers,
              Array.length,
              Order.greaterThan(Number.Order)(0),
            )
              ? `Kicked out ${removedMembers.map((m) => userMention(m.user.id)).join(" ")}`
              : "No players to kick out",
            allowedMentions: { parse: [] },
          })),
          Effect.asVoid,
          Effect.withSpan("handleKickoutManual", { captureStackTrace: true }),
        ),
      ),
    )
    .build();

export const command = chatInputCommandSubcommandHandlerContextBuilder()
  .data(
    new SlashCommandBuilder()
      .setName("kickout")
      .setDescription("Kick out commands")
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
