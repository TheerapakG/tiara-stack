import { addMinutes, getUnixTime } from "date-fns/fp";
import {
  ApplicationIntegrationType,
  InteractionContextType,
  SlashCommandBuilder,
  SlashCommandSubcommandBuilder,
} from "discord.js";
import { Array, Effect, Option, pipe } from "effect";
import { observeEffectSignalOnce } from "typhoon-server/signal";
import {
  GuildConfigService,
  PermissionService,
  ScheduleService,
  SheetService,
} from "../../services";
import {
  chatInputCommandHandlerContextWithSubcommandHandlerBuilder,
  chatInputSubcommandHandlerContextBuilder,
} from "../../types";

const getCheckinMessage = (
  hour: number,
  channelName: string,
  serverId: string,
) =>
  pipe(
    Effect.Do,
    Effect.bind("schedule", () => SheetService.getAllSchedules()),
    Effect.bind("runningChannel", () =>
      pipe(
        GuildConfigService.getRunningChannel(serverId, channelName),
        observeEffectSignalOnce,
        Effect.flatMap(Array.head),
      ),
    ),
    Effect.bind(
      "checkinMessage",
      ({ schedule: { start, schedules }, runningChannel }) =>
        ScheduleService.formatCheckIn(
          hour,
          runningChannel.channelId,
          start,
          schedules,
        ),
    ),
    Effect.map(({ checkinMessage }) => checkinMessage),
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
  .handler((interaction) =>
    pipe(
      Effect.Do,
      Effect.bindAll(() => ({
        hourOption: pipe(
          Effect.try(() => interaction.options.getNumber("hour")),
          Effect.map(Option.fromNullable),
        ),
        channelName: pipe(
          Effect.try(() => interaction.options.getString("channel_name", true)),
        ),
        serverId: pipe(
          Effect.try(
            () =>
              interaction.options.getString("server_id") ?? interaction.guildId,
          ),
          Effect.flatMap(Option.fromNullable),
        ),
        user: Effect.succeed(interaction.user),
      })),
      Effect.tap(({ serverId }) =>
        serverId !== interaction.guildId
          ? PermissionService.checkOwner(interaction)
          : Effect.void,
      ),
      Effect.bind("managerRoles", ({ serverId }) =>
        serverId
          ? pipe(
              GuildConfigService.getManagerRoles(serverId),
              observeEffectSignalOnce,
            )
          : Effect.succeed([]),
      ),
      Effect.tap(({ managerRoles }) =>
        PermissionService.checkRoles(
          interaction,
          managerRoles.map((role) => role.roleId),
          "You can only check in users as a manager",
        ),
      ),
      Effect.bind("sheetService", ({ serverId }) =>
        SheetService.ofGuild(serverId),
      ),
      Effect.bind("eventConfig", ({ sheetService }) =>
        pipe(SheetService.getEventConfig(), Effect.provide(sheetService)),
      ),
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
      Effect.bind(
        "checkinMessage",
        ({ hour, channelName, serverId, sheetService }) =>
          pipe(
            getCheckinMessage(hour, channelName, serverId),
            Effect.provide(sheetService),
          ),
      ),
      Effect.bind("response", ({ checkinMessage }) =>
        Effect.tryPromise(() =>
          interaction.reply({
            content: checkinMessage,
          }),
        ),
      ),
      Effect.asVoid,
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
