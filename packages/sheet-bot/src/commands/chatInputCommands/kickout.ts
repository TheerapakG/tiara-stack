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
} from "effect";
import { Schema } from "sheet-apis";
import { Utils } from "typhoon-core/utils";

class ArgumentError extends Data.TaggedError("ArgumentError")<{
  readonly message: string;
}> {
  constructor(message: string) {
    super({ message });
  }
}

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
        Effect.map(
          HashMap.reduce(HashMap.empty<number, Schema.Schedule>(), (acc, a) =>
            HashMap.union(acc, a),
          ),
        ),
      ),
    ),
    Effect.bind("schedule", ({ schedules }) =>
      pipe(
        {
          schedule: pipe(
            HashMap.get(schedules, hour),
            Option.getOrElse(() => Schema.Schedule.makeEmpty(hour)),
          ),
        },
        Utils.mapPositional(PlayerService.mapScheduleWithPlayers),
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
                  GuildConfigService.getGuildRunningChannelByName(channelName),
                onNone: () =>
                  pipe(
                    InteractionContext.channel(true).sync(),
                    Effect.flatMap((channel) =>
                      GuildConfigService.getGuildRunningChannelById(channel.id),
                    ),
                  ),
              }),
              Effect.flatMap(
                Option.match({
                  onSome: Effect.succeed,
                  onNone: () =>
                    Effect.fail(new ArgumentError("No such running channel")),
                }),
              ),
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
              kickoutData.schedule.fills,
              Array.getSomes,
              Array.map((player) =>
                pipe(
                  Match.type<Schema.Player | Schema.PartialNamePlayer>(),
                  Match.tag("Player", (player) => Option.some(player.id)),
                  Match.tag("PartialNamePlayer", () => Option.none()),
                  Match.exhaustive,
                  Function.apply(player),
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
