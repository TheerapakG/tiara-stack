import { addMinutes, getMinutes, getUnixTime } from "date-fns/fp";
import {
  ApplicationIntegrationType,
  InteractionContextType,
  SlashCommandBuilder,
  SlashCommandSubcommandBuilder,
  userMention,
} from "discord.js";
import { Array, Data, Effect, Function, HashMap, Option, pipe } from "effect";
import { observeOnce } from "typhoon-server/signal";
import {
  emptySchedule,
  GuildConfigService,
  GuildService,
  guildServicesFromInteractionOption,
  InteractionContext,
  PermissionService,
  PlayerService,
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
        InteractionContext.tapDeferReply(),
        PermissionService.tapCheckOwner(() => ({ allowSameGuild: true })),
        PermissionService.tapCheckRoles(() => ({
          roles: pipe(
            GuildConfigService.getManagerRoles(),
            Effect.flatMap(observeOnce),
            Effect.map(Array.map((role) => role.roleId)),
          ),
          reason: "You can only kick out users as a manager",
        })),
        bindObject({
          hourOption: InteractionContext.getNumber("hour"),
          channelName: InteractionContext.getString("channel_name", true),
          guildName: GuildService.getName(),
          channel: InteractionContext.channel(true),
          user: InteractionContext.user(),
          eventConfig: SheetService.getEventConfig(),
        }),
        Effect.let("date", () => new Date()),
        Effect.tap(({ date }) =>
          pipe(date, getMinutes) >= 40
            ? Effect.fail(
                new TimeError("Cannot kick out until next hour starts"),
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
        Effect.bind("fillIds", ({ kickoutData }) =>
          pipe(
            kickoutData.schedule.fills,
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
        InteractionContext.tapEditReply(({ removedMembers }) => ({
          content:
            removedMembers.length > 0
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

export const command =
  chatInputCommandHandlerContextWithSubcommandHandlerBuilder()
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
