import { escapeMarkdown, roleMention } from "@discordjs/formatters";
import { Discord, Ix } from "dfx";
import { InteractionsRegistry } from "dfx/gateway";
import { Effect, Layer, Option, pipe } from "effect";
import { GuildsCache } from "../discord/cache";
import { DiscordGatewayLayer } from "../discord/gateway";
import { CommandHelper, Interaction } from "../utils";
import { PermissionService, GuildConfigService, EmbedService } from "../services";
import { ApplicationIntegrationType, InteractionContextType } from "discord-api-types/v10";

const makeListConfigSubCommand = Effect.gen(function* () {
  const embedService = yield* EmbedService;
  const guildConfigService = yield* GuildConfigService;
  const permissionService = yield* PermissionService;
  const guildsCache = yield* GuildsCache;

  return yield* CommandHelper.makeSubCommand(
    (builder) =>
      builder
        .setName("list_config")
        .setDescription("List the config for the server")
        .addStringOption((builder) =>
          builder.setName("server_id").setDescription("The server id to list the config for"),
        ),
    Effect.fn("server.list_config")(function* (command) {
      yield* command.deferReply();

      const serverId = command.optionValueOptional("server_id");
      const { guildId } = yield* permissionService.checkInteractionUserGuildPermissions(
        Discord.Permissions.ManageGuild,
        Option.getOrUndefined(serverId),
      );

      const guild = yield* guildsCache.get(guildId);
      const guildConfig = yield* guildConfigService.getGuildConfigByGuildId(guildId);
      const managerRoles = yield* guildConfigService.getGuildManagerRoles(guildId);

      const sheetId = pipe(
        guildConfig.sheetId,
        Option.map(escapeMarkdown),
        Option.getOrElse(() => "None"),
      );
      const scriptId = pipe(
        guildConfig.scriptId,
        Option.map(escapeMarkdown),
        Option.getOrElse(() => "None"),
      );
      const autoCheckin = guildConfig.autoCheckin;

      yield* command.editReply({
        payload: {
          embeds: [
            (yield* embedService.makeBaseEmbedBuilder())
              .setTitle(`Config for ${escapeMarkdown(guild.name)}`)
              .setDescription(
                [
                  `Sheet id: ${sheetId}`,
                  `Script id: ${scriptId}`,
                  `Auto check-in: ${autoCheckin ? "Enabled" : "Disabled"}`,
                  `Manager roles: ${
                    managerRoles.length > 0
                      ? managerRoles.map((role) => roleMention(role.roleId)).join(", ")
                      : "None"
                  }`,
                ].join("\n"),
              )
              .toJSON(),
          ],
        },
      });
    }),
  );
});

const makeAddManagerRoleSubCommand = Effect.gen(function* () {
  const embedService = yield* EmbedService;
  const guildConfigService = yield* GuildConfigService;
  const permissionService = yield* PermissionService;
  const guildsCache = yield* GuildsCache;

  return yield* CommandHelper.makeSubCommand(
    (builder) =>
      builder
        .setName("manager_role")
        .setDescription("Add a manager role for the server")
        .addRoleOption((builder) =>
          builder.setName("role").setDescription("The role to add").setRequired(true),
        )
        .addStringOption((builder) =>
          builder.setName("server_id").setDescription("The server id to add the manager role to"),
        ),
    Effect.fn("server.add.manager_role")(function* (command) {
      yield* command.deferReply();

      const serverId = command.optionValueOptional("server_id");
      const { guildId } = yield* permissionService.checkInteractionUserGuildPermissions(
        Discord.Permissions.ManageGuild,
        Option.getOrUndefined(serverId),
      );

      const guild = yield* guildsCache.get(guildId);
      const role = command.optionRoleValue("role");

      yield* guildConfigService.addGuildManagerRole(guildId, role.id);

      yield* command.editReply({
        payload: {
          embeds: [
            (yield* embedService.makeBaseEmbedBuilder())
              .setTitle(`Success!`)
              .setDescription(
                `${roleMention(role.id)} is now a manager role for ${escapeMarkdown(guild.name)}`,
              )
              .toJSON(),
          ],
        },
      });
    }),
  );
});

const makeAddCommandGroup = Effect.gen(function* () {
  const addManagerRoleSubCommand = yield* makeAddManagerRoleSubCommand;

  return yield* CommandHelper.makeSubCommandGroup(
    (builder) =>
      builder
        .setName("add")
        .setDescription("Add a config to the server")
        .addSubcommand(() => addManagerRoleSubCommand.data),
    (command) =>
      command.subCommands({
        manager_role: addManagerRoleSubCommand.handler,
      }),
  );
});

const makeRemoveManagerRoleSubCommand = Effect.gen(function* () {
  const embedService = yield* EmbedService;
  const guildConfigService = yield* GuildConfigService;
  const permissionService = yield* PermissionService;
  const guildsCache = yield* GuildsCache;

  return yield* CommandHelper.makeSubCommand(
    (builder) =>
      builder
        .setName("manager_role")
        .setDescription("Remove a manager role from the server")
        .addRoleOption((builder) =>
          builder.setName("role").setDescription("The role to remove").setRequired(true),
        )
        .addStringOption((builder) =>
          builder
            .setName("server_id")
            .setDescription("The server id to remove the manager role from"),
        ),
    Effect.fn("server.remove.manager_role")(function* (command) {
      yield* command.deferReply();

      const serverId = command.optionValueOptional("server_id");
      const { guildId } = yield* permissionService.checkInteractionUserGuildPermissions(
        Discord.Permissions.ManageGuild,
        Option.getOrUndefined(serverId),
      );

      const guild = yield* guildsCache.get(guildId);
      const role = command.optionRoleValue("role");

      yield* guildConfigService.removeGuildManagerRole(guildId, role.id);

      yield* command.editReply({
        payload: {
          embeds: [
            (yield* embedService.makeBaseEmbedBuilder())
              .setTitle(`Success!`)
              .setDescription(
                `${roleMention(role.id)} is no longer a manager role for ${escapeMarkdown(guild.name)}`,
              )
              .toJSON(),
          ],
        },
      });
    }),
  );
});

const makeRemoveCommandGroup = Effect.gen(function* () {
  const removeManagerRoleSubCommand = yield* makeRemoveManagerRoleSubCommand;

  return yield* CommandHelper.makeSubCommandGroup(
    (builder) =>
      builder
        .setName("remove")
        .setDescription("Remove a config from the server")
        .addSubcommand(() => removeManagerRoleSubCommand.data),
    (command) =>
      command.subCommands({
        manager_role: removeManagerRoleSubCommand.handler,
      }),
  );
});

const makeSetSheetSubCommand = Effect.gen(function* () {
  const embedService = yield* EmbedService;
  const guildConfigService = yield* GuildConfigService;
  const permissionService = yield* PermissionService;
  const guildsCache = yield* GuildsCache;

  return yield* CommandHelper.makeSubCommand(
    (builder) =>
      builder
        .setName("sheet")
        .setDescription("Set the sheet id for the server")
        .addStringOption((builder) =>
          builder.setName("sheet_id").setDescription("The sheet id to set").setRequired(true),
        )
        .addStringOption((builder) =>
          builder.setName("server_id").setDescription("The server id to set the sheet id for"),
        ),
    Effect.fn("server.set.sheet")(function* (command) {
      yield* command.deferReply();

      const serverId = command.optionValueOptional("server_id");
      const { guildId } = yield* permissionService.checkInteractionUserGuildPermissions(
        Discord.Permissions.ManageGuild,
        Option.getOrUndefined(serverId),
      );

      const sheetId = command.optionValue("sheet_id");
      const guild = yield* guildsCache.get(guildId);

      yield* guildConfigService.upsertGuildConfig(guildId, {
        sheetId,
      });

      yield* command.editReply({
        payload: {
          embeds: [
            (yield* embedService.makeBaseEmbedBuilder())
              .setTitle(`Success!`)
              .setDescription(
                `Sheet id for ${escapeMarkdown(guild.name)} is now set to ${escapeMarkdown(sheetId)}`,
              )
              .toJSON(),
          ],
        },
      });
    }),
  );
});

const makeSetScriptSubCommand = Effect.gen(function* () {
  const embedService = yield* EmbedService;
  const guildConfigService = yield* GuildConfigService;
  const permissionService = yield* PermissionService;
  const guildsCache = yield* GuildsCache;

  return yield* CommandHelper.makeSubCommand(
    (builder) =>
      builder
        .setName("script")
        .setDescription("Set the script id for the server")
        .addStringOption((builder) =>
          builder.setName("script_id").setDescription("The script id to set").setRequired(true),
        )
        .addStringOption((builder) =>
          builder.setName("server_id").setDescription("The server id to set the script id for"),
        ),
    Effect.fn("server.set.script")(function* (command) {
      yield* command.deferReply();

      yield* permissionService.checkInteractionUserApplicationOwner();

      const serverId = command.optionValueOptional("server_id");

      let guildId: string;

      if (Option.isSome(serverId)) {
        guildId = serverId.value;
      } else {
        guildId = yield* pipe(
          Interaction.guild(),
          Effect.flatMap((guildOption) =>
            pipe(
              guildOption,
              Option.map((guild) => guild.id),
              Option.match({
                onSome: Effect.succeed,
                onNone: () => Effect.fail(new Error("Guild not found in interaction")),
              }),
            ),
          ),
        );
      }

      const scriptId = command.optionValue("script_id");
      const guild = yield* guildsCache.get(guildId);

      yield* guildConfigService.upsertGuildConfig(guildId, {
        scriptId,
      });

      yield* command.editReply({
        payload: {
          embeds: [
            (yield* embedService.makeBaseEmbedBuilder())
              .setTitle(`Success!`)
              .setDescription(
                `Script id for ${escapeMarkdown(guild.name)} is now set to ${escapeMarkdown(scriptId)}`,
              )
              .toJSON(),
          ],
        },
      });
    }),
  );
});

const makeSetAutoCheckinSubCommand = Effect.gen(function* () {
  const embedService = yield* EmbedService;
  const guildConfigService = yield* GuildConfigService;
  const permissionService = yield* PermissionService;
  const guildsCache = yield* GuildsCache;

  return yield* CommandHelper.makeSubCommand(
    (builder) =>
      builder
        .setName("auto_checkin")
        .setDescription("Set whether automatic check-in is enabled")
        .addBooleanOption((builder) =>
          builder
            .setName("auto_checkin")
            .setDescription("Enable automatic check-in")
            .setRequired(true),
        )
        .addStringOption((builder) =>
          builder.setName("server_id").setDescription("The server id to set auto check-in for"),
        ),
    Effect.fn("server.set.auto_checkin")(function* (command) {
      yield* command.deferReply();

      const serverId = command.optionValueOptional("server_id");
      const { guildId } = yield* permissionService.checkInteractionUserGuildPermissions(
        Discord.Permissions.ManageGuild,
        Option.getOrUndefined(serverId),
      );

      const autoCheckin = command.optionValue("auto_checkin");
      const guildConfig = yield* guildConfigService.upsertGuildConfig(guildId, {
        autoCheckin,
      });

      const guild = yield* guildsCache.get(guildId);

      yield* command.editReply({
        payload: {
          embeds: [
            (yield* embedService.makeBaseEmbedBuilder())
              .setTitle("Success!")
              .setDescription(
                `Auto check-in for ${escapeMarkdown(guild.name)} is now ${guildConfig.autoCheckin ? "enabled" : "disabled"}.`,
              )
              .toJSON(),
          ],
        },
      });
    }),
  );
});

const makeSetCommandGroup = Effect.gen(function* () {
  const setSheetSubCommand = yield* makeSetSheetSubCommand;
  const setScriptSubCommand = yield* makeSetScriptSubCommand;
  const setAutoCheckinSubCommand = yield* makeSetAutoCheckinSubCommand;

  return yield* CommandHelper.makeSubCommandGroup(
    (builder) =>
      builder
        .setName("set")
        .setDescription("Set the config of the server")
        .addSubcommand(() => setSheetSubCommand.data)
        .addSubcommand(() => setScriptSubCommand.data)
        .addSubcommand(() => setAutoCheckinSubCommand.data),
    (command) =>
      command.subCommands({
        sheet: setSheetSubCommand.handler,
        script: setScriptSubCommand.handler,
        auto_checkin: setAutoCheckinSubCommand.handler,
      }),
  );
});

const makeServerCommand = Effect.gen(function* () {
  const listConfigSubCommand = yield* makeListConfigSubCommand;
  const addCommandGroup = yield* makeAddCommandGroup;
  const removeCommandGroup = yield* makeRemoveCommandGroup;
  const setCommandGroup = yield* makeSetCommandGroup;

  return yield* CommandHelper.makeCommand(
    (builder) =>
      builder
        .setName("server")
        .setDescription("Server commands")
        .addSubcommand(() => listConfigSubCommand.data)
        .addSubcommandGroup(() => addCommandGroup.data)
        .addSubcommandGroup(() => removeCommandGroup.data)
        .addSubcommandGroup(() => setCommandGroup.data)
        .setIntegrationTypes(
          ApplicationIntegrationType.GuildInstall,
          ApplicationIntegrationType.UserInstall,
        )
        .setContexts(
          InteractionContextType.BotDM,
          InteractionContextType.Guild,
          InteractionContextType.PrivateChannel,
        ),
    (command) =>
      command.subCommands({
        list_config: listConfigSubCommand.handler,
        add: addCommandGroup.handler,
        remove: removeCommandGroup.handler,
        set: setCommandGroup.handler,
      }),
  );
});

const makeGlobalServerCommand = Effect.gen(function* () {
  const serverCommand = yield* makeServerCommand;

  return CommandHelper.makeGlobalCommand(serverCommand.data, serverCommand.handler);
});

export const ServerCommandLive = Layer.scopedDiscard(
  Effect.gen(function* () {
    const registry = yield* InteractionsRegistry;
    const command = yield* makeGlobalServerCommand;

    yield* registry.register(Ix.builder.add(command).catchAllCause(Effect.log));
  }),
).pipe(
  Layer.provide(
    Layer.mergeAll(
      DiscordGatewayLayer,
      GuildsCache.Default,
      PermissionService.Default,
      GuildConfigService.Default,
      EmbedService.Default,
    ),
  ),
);
