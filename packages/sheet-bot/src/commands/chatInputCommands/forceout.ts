import { addMinutes, getMinutes, getUnixTime } from "date-fns/fp";
import {
  ApplicationIntegrationType,
  InteractionContextType,
  MessageFlags,
  SlashCommandBuilder,
  SlashCommandSubcommandBuilder,
  userMention,
} from "discord.js";
import { Array, Data, Effect, HashMap, Option, pipe } from "effect";
import { observeOnce } from "typhoon-server/signal";
import {
  emptySchedule,
  GuildConfigService,
  GuildService,
  guildServicesFromInteractionOption,
  PermissionService,
  PlayerService,
  SheetService,
} from "../../services";
import {
  chatInputCommandHandlerContextWithSubcommandHandlerBuilder,
  chatInputSubcommandHandlerContextBuilder,
  InteractionContext,
} from "../../types";
import { bindObject } from "../../utils";

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

const getForceoutData = ({
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
    Effect.let("schedule", ({ schedules }) =>
      pipe(
        HashMap.get(schedules, hour),
        Option.getOrElse(() => emptySchedule(hour)),
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

const handleManual = chatInputSubcommandHandlerContextBuilder()
  .data(
    new SlashCommandSubcommandBuilder()
      .setName("manual")
      .setDescription("Manually force out users")
      .addStringOption((option) =>
        option
          .setName("channel_name")
          .setDescription("The name of the running channel")
          .setRequired(true),
      )
      .addNumberOption((option) =>
        option
          .setName("hour")
          .setDescription("The hour to force out users for"),
      )
      .addStringOption((option) =>
        option
          .setName("server_id")
          .setDescription("The server to force out users for"),
      ),
  )
  .handler(
    pipe(
      Effect.Do,
      InteractionContext.tapDeferReply({ flags: MessageFlags.Ephemeral }),
      PermissionService.tapCheckOwner({ allowSameGuild: true }),
      PermissionService.tapCheckRoles(
        pipe(
          GuildConfigService.getManagerRoles(),
          Effect.flatMap(observeOnce),
          Effect.map((managerRoles) => managerRoles.map((role) => role.roleId)),
        ),
        "You can only force out users as a manager",
      ),
      bindObject({
        hourOption: InteractionContext.getNumber("hour"),
        channelName: InteractionContext.getString("channel_name", true),
        guild: GuildService.getGuild(),
        channel: pipe(
          InteractionContext.channel(),
          Effect.flatMap(Option.fromNullable),
        ),
        user: InteractionContext.user(),
        eventConfig: SheetService.getEventConfig(),
      }),
      Effect.let("date", () => new Date()),
      Effect.tap(({ date }) =>
        pipe(date, getMinutes) >= 40
          ? Effect.fail(
              new TimeError("Cannot force out until next hour starts"),
            )
          : Effect.void,
      ),
      Effect.let("hour", ({ date, hourOption, eventConfig }) =>
        pipe(
          hourOption,
          Option.getOrElse(() =>
            Math.floor(
              (pipe(date, addMinutes(20), getUnixTime) -
                eventConfig.startTime) /
                3600 +
                1,
            ),
          ),
        ),
      ),
      Effect.bind("forceoutData", ({ hour, channelName }) =>
        getForceoutData({ hour, channelName }),
      ),
      Effect.bind("role", ({ guild, forceoutData }) =>
        pipe(
          forceoutData.runningChannel.roleId,
          Option.fromNullable,
          Effect.flatMap((roleId) =>
            Effect.tryPromise(() => guild.roles.fetch(roleId)),
          ),
          Effect.flatMap(Option.fromNullable),
        ),
      ),
      Effect.bind("fillIds", ({ forceoutData }) =>
        pipe(
          forceoutData.schedule.fills,
          Array.map(Option.fromNullable),
          Array.getSomes,
          Effect.forEach((playerName) => PlayerService.getByName(playerName)),
          Effect.map(Array.getSomes),
          Effect.map(Array.map((p) => p.id)),
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
      Effect.tap(({ removedMembers }) =>
        InteractionContext.editReply({
          content:
            removedMembers.length > 0
              ? `Forced out ${removedMembers.map((m) => userMention(m.user.id)).join(" ")}`
              : "No players to force out",
        }),
      ),
      Effect.provide(guildServicesFromInteractionOption("server_id")),
      Effect.withSpan("handleForceoutManual", { captureStackTrace: true }),
    ),
  )
  .build();

export const command =
  chatInputCommandHandlerContextWithSubcommandHandlerBuilder()
    .data(
      new SlashCommandBuilder()
        .setName("forceout")
        .setDescription("Force out commands")
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
