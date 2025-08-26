import {
  ConverterService,
  GuildConfigService,
  GuildService,
  guildServicesFromInteractionOption,
  InteractionContext,
  PartialNamePlayer,
  PermissionService,
  Player,
  PlayerService,
  Schedule,
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
  Option,
  Order,
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

class TimeError extends Data.TaggedError("TimeError")<{
  readonly message: string;
}> {
  constructor(message: string) {
    super({ message });
  }
}

const getKickoutData = ({
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
    Effect.bind("schedule", ({ schedules }) =>
      pipe(
        HashMap.get(schedules, hour),
        Option.getOrElse(() => Schedule.empty(hour)),
        PlayerService.mapScheduleWithPlayers,
      ),
    ),
    Effect.map(({ schedule, runningChannel }) => ({
      schedule,
      runningChannel: {
        channelId: runningChannel.channelId,
        channelName,
        roleId: runningChannel.roleId,
      },
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
            .setDescription("The name of the running channel")
            .setRequired(true),
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
              GuildConfigService.getManagerRoles(),
              Effect.flatMap(observeOnce),
              Effect.map(Array.map((role) => role.roleId)),
              Effect.map((roles) => ({
                roles,
                reason: "You can only kick out users as a manager",
              })),
            ),
          ),
          bindObject({
            hourOption: InteractionContext.getNumber("hour"),
            channelName: InteractionContext.getString("channel_name", true),
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
          Effect.bind("kickoutData", ({ hour, channelName }) =>
            getKickoutData({ hour, channelName }),
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
                Effect.tryPromise(() => member.roles.remove(role)),
              ),
            ),
          ),
          InteractionContext.editReply.tap(({ removedMembers }) => ({
            content: pipe(
              removedMembers,
              Array.length,
              Order.greaterThan(Order.number)(0),
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
