import { channelMention, escapeMarkdown, roleMention } from "@discordjs/formatters";
import { Discord } from "dfx";
import { Ix } from "dfx";
import { InteractionsRegistry } from "dfx/gateway";
import { ApplicationIntegrationType, InteractionContextType } from "discord-api-types/v10";
import { Effect, Layer, Option, pipe } from "effect";
import { DiscordGatewayLayer } from "../discord/gateway";
import { CommandHelper, Interaction } from "../utils";
import { EmbedService, GuildConfigService, PermissionService } from "../services";
import { GuildConfig } from "sheet-apis/schema";

const configFields = (
  config: GuildConfig.GuildChannelConfig,
): Array<{ readonly name: string; readonly value: string }> => [
  {
    name: "Name",
    value: pipe(
      config.name,
      Option.map(escapeMarkdown),
      Option.getOrElse(() => "None!"),
    ),
  },
  { name: "Running channel", value: Option.getOrUndefined(config.running) ? "Yes" : "No" },
  {
    name: "Role",
    value: pipe(
      config.roleId,
      Option.map(roleMention),
      Option.getOrElse(() => "None!"),
    ),
  },
  {
    name: "Checkin channel",
    value: pipe(
      config.checkinChannelId,
      Option.map(channelMention),
      Option.getOrElse(() => "None!"),
    ),
  },
];

const makeListConfigSubCommand = Effect.gen(function* () {
  const embedService = yield* EmbedService;
  const guildConfigService = yield* GuildConfigService;
  const permissionService = yield* PermissionService;

  return yield* CommandHelper.makeSubCommand(
    (builder) =>
      builder
        .setName("list_config")
        .setDescription("List the config for the channel")
        .addStringOption((builder) =>
          builder.setName("server_id").setDescription("The server id to list the config for"),
        ),
    Effect.fn("channel.list_config")(function* (command) {
      yield* command.deferReply();

      const serverId = command.optionValueOptional("server_id");
      const { guildId } = yield* permissionService.checkInteractionUserGuildPermissions(
        Discord.Permissions.ManageGuild,
        Option.getOrUndefined(serverId),
      );

      const interactionChannel = yield* Interaction.channel();
      const channelId = pipe(
        interactionChannel,
        Option.map((channel) => channel.id),
        Option.getOrThrow,
      );

      const config = yield* guildConfigService.getGuildRunningChannelById(guildId, channelId);

      yield* command.editReply({
        payload: {
          embeds: [
            (yield* embedService.makeBaseEmbedBuilder())
              .setTitle(`Config for this channel`)
              .addFields(...configFields(config))
              .toJSON(),
          ],
        },
      });
    }),
  );
});

const makeSetSubCommand = Effect.gen(function* () {
  const embedService = yield* EmbedService;
  const guildConfigService = yield* GuildConfigService;
  const permissionService = yield* PermissionService;

  return yield* CommandHelper.makeSubCommand(
    (builder) =>
      builder
        .setName("set")
        .setDescription("Set the config for the channel")
        .addChannelOption((builder) =>
          builder.setName("channel").setDescription("The channel to configure"),
        )
        .addBooleanOption((builder) =>
          builder.setName("running").setDescription("The running flag for the channel"),
        )
        .addStringOption((builder) =>
          builder.setName("name").setDescription("The name of the channel"),
        )
        .addRoleOption((builder) =>
          builder.setName("role").setDescription("The role to assign to the channel"),
        )
        .addChannelOption((builder) =>
          builder
            .setName("checkin_channel")
            .setDescription("The channel to send check in messages to"),
        )
        .addStringOption((builder) =>
          builder.setName("server_id").setDescription("The server id to set the config for"),
        ),
    Effect.fn("channel.set")(function* (command) {
      yield* command.deferReply();

      const serverId = command.optionValueOptional("server_id");
      const { guildId } = yield* permissionService.checkInteractionUserGuildPermissions(
        Discord.Permissions.ManageGuild,
        Option.getOrUndefined(serverId),
      );

      const channelOption = command.optionChannelValueOptional("channel");
      const running = command.optionValueOptional("running");
      const name = command.optionValueOptional("name");
      const role = command.optionRoleValueOptional("role");
      const checkinChannel = command.optionChannelValueOptional("checkin_channel");

      const channelId = yield* pipe(
        channelOption,
        Option.map((c) => c.id),
        Option.match({
          onSome: Effect.succeed,
          onNone: () =>
            pipe(
              Interaction.channel(),
              Effect.flatMap((channel) =>
                channel.pipe(
                  Option.map((c) => c.id),
                  Option.match({
                    onSome: Effect.succeed,
                    onNone: () => Effect.fail(new Error("Channel not found in interaction")),
                  }),
                ),
              ),
            ),
        }),
      );

      const config = yield* guildConfigService.upsertGuildChannelConfig(guildId, channelId, {
        ...(Option.isSome(running) ? { running: running.value } : {}),
        ...(Option.isSome(name) ? { name: name.value } : {}),
        ...(Option.isSome(role) ? { roleId: role.value.id } : {}),
        ...(Option.isSome(checkinChannel) ? { checkinChannelId: checkinChannel.value.id } : {}),
      });

      yield* command.editReply({
        payload: {
          embeds: [
            (yield* embedService.makeBaseEmbedBuilder())
              .setTitle(`Success!`)
              .setDescription(`${channelMention(channelId)} configuration updated`)
              .addFields(...configFields(config))
              .toJSON(),
          ],
        },
      });
    }),
  );
});

const makeUnsetSubCommand = Effect.gen(function* () {
  const embedService = yield* EmbedService;
  const guildConfigService = yield* GuildConfigService;
  const permissionService = yield* PermissionService;

  return yield* CommandHelper.makeSubCommand(
    (builder) =>
      builder
        .setName("unset")
        .setDescription("Unset the config for the channel")
        .addChannelOption((builder) =>
          builder.setName("channel").setDescription("The channel to configure"),
        )
        .addBooleanOption((builder) =>
          builder.setName("running").setDescription("Unset the running flag for the channel"),
        )
        .addBooleanOption((builder) =>
          builder.setName("name").setDescription("Unset the name of the channel"),
        )
        .addBooleanOption((builder) =>
          builder.setName("role").setDescription("Unset the role of the channel"),
        )
        .addBooleanOption((builder) =>
          builder
            .setName("checkin_channel")
            .setDescription("Unset the checkin channel of the channel"),
        )
        .addStringOption((builder) =>
          builder.setName("server_id").setDescription("The server id to unset the config for"),
        ),
    Effect.fn("channel.unset")(function* (command) {
      yield* command.deferReply();

      const serverId = command.optionValueOptional("server_id");
      const { guildId } = yield* permissionService.checkInteractionUserGuildPermissions(
        Discord.Permissions.ManageGuild,
        Option.getOrUndefined(serverId),
      );

      const running = command.optionValueOptional("running");
      const channelOption = command.optionChannelValueOptional("channel");
      const name = command.optionValueOptional("name");
      const role = command.optionValueOptional("role");
      const checkinChannel = command.optionValueOptional("checkin_channel");

      const channelId = yield* pipe(
        channelOption,
        Option.map((c) => c.id),
        Option.match({
          onSome: Effect.succeed,
          onNone: () =>
            pipe(
              Interaction.channel(),
              Effect.flatMap((channel) =>
                channel.pipe(
                  Option.map((c) => c.id),
                  Option.match({
                    onSome: Effect.succeed,
                    onNone: () => Effect.fail(new Error("Channel not found in interaction")),
                  }),
                ),
              ),
            ),
        }),
      );

      const config = yield* guildConfigService.upsertGuildChannelConfig(guildId, channelId, {
        ...(Option.getOrUndefined(running) ? { running: null } : {}),
        ...(Option.getOrUndefined(name) ? { name: null } : {}),
        ...(Option.getOrUndefined(role) ? { roleId: null } : {}),
        ...(Option.getOrUndefined(checkinChannel) ? { checkinChannelId: null } : {}),
      });

      yield* command.editReply({
        payload: {
          embeds: [
            (yield* embedService.makeBaseEmbedBuilder())
              .setTitle(`Success!`)
              .setDescription(`${channelMention(channelId)} configuration updated`)
              .addFields(...configFields(config))
              .toJSON(),
          ],
        },
      });
    }),
  );
});

const makeChannelCommand = Effect.gen(function* () {
  const listConfigSubCommand = yield* makeListConfigSubCommand;
  const setSubCommand = yield* makeSetSubCommand;
  const unsetSubCommand = yield* makeUnsetSubCommand;

  return yield* CommandHelper.makeCommand(
    (builder) =>
      builder
        .setName("channel")
        .setDescription("Channel commands")
        .setIntegrationTypes(
          ApplicationIntegrationType.GuildInstall,
          ApplicationIntegrationType.UserInstall,
        )
        .setContexts(
          InteractionContextType.BotDM,
          InteractionContextType.Guild,
          InteractionContextType.PrivateChannel,
        )
        .addSubcommand(() => listConfigSubCommand.data)
        .addSubcommand(() => setSubCommand.data)
        .addSubcommand(() => unsetSubCommand.data),
    (command) =>
      command.subCommands({
        list_config: listConfigSubCommand.handler,
        set: setSubCommand.handler,
        unset: unsetSubCommand.handler,
      }),
  );
});

const makeGlobalChannelCommand = Effect.gen(function* () {
  const channelCommand = yield* makeChannelCommand;

  return CommandHelper.makeGlobalCommand(channelCommand.data, channelCommand.handler);
});

export const ChannelCommandLive = Layer.scopedDiscard(
  Effect.gen(function* () {
    const registry = yield* InteractionsRegistry;
    const command = yield* makeGlobalChannelCommand;

    yield* registry.register(Ix.builder.add(command).catchAllCause(Effect.log));
  }),
).pipe(
  Layer.provide(
    Layer.mergeAll(
      DiscordGatewayLayer,
      PermissionService.Default,
      GuildConfigService.Default,
      EmbedService.Default,
    ),
  ),
);
