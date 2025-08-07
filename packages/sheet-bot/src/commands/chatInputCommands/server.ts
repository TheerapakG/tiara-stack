import {
  ApplicationIntegrationType,
  ChatInputCommandInteraction,
  EmbedBuilder,
  escapeMarkdown,
  InteractionContextType,
  PermissionFlagsBits,
  roleMention,
  SlashCommandBuilder,
  SlashCommandSubcommandBuilder,
  SlashCommandSubcommandGroupBuilder,
} from "discord.js";
import { Array, Effect, Option, pipe } from "effect";
import { observeOnce } from "typhoon-server/signal";
import { GuildConfigService, PermissionService } from "../../services";
import {
  chatInputCommandHandlerContextWithSubcommandHandlerBuilder,
  chatInputSubcommandGroupHandlerContextWithSubcommandHandlerBuilder,
  chatInputSubcommandHandlerContextBuilder,
  InteractionContext,
} from "../../types";

const handleListConfig = chatInputSubcommandHandlerContextBuilder()
  .data(
    new SlashCommandSubcommandBuilder()
      .setName("list_config")
      .setDescription("List the config for the server")
      .addStringOption((option) =>
        option
          .setName("server_id")
          .setDescription("The server id to list the config for"),
      ),
  )
  .handler(
    pipe(
      Effect.Do,
      Effect.bind("interaction", () =>
        InteractionContext.interaction<ChatInputCommandInteraction>(),
      ),
      Effect.bindAll(({ interaction }) => ({
        serverId: pipe(
          Effect.try(
            () =>
              interaction.options.getString("server_id") ?? interaction.guildId,
          ),
          Effect.flatMap(Option.fromNullable),
        ),
        memberPermissions: Option.fromNullable(interaction.memberPermissions),
      })),
      Effect.tap(({ memberPermissions }) =>
        !memberPermissions.has(PermissionFlagsBits.ManageGuild)
          ? Effect.fail("You do not have permission to manage the server")
          : Effect.void,
      ),
      Effect.bind("guild", ({ serverId, interaction }) =>
        Effect.tryPromise(() => interaction.client.guilds.fetch(serverId)),
      ),
      Effect.bind("guildConfig", ({ guild }) =>
        pipe(
          GuildConfigService.getConfig(guild.id),
          Effect.flatMap((computed) => observeOnce(computed.value)),
        ),
      ),
      Effect.bind("managerRoles", ({ guild }) =>
        pipe(
          GuildConfigService.getManagerRoles(guild.id),
          Effect.flatMap((computed) => observeOnce(computed.value)),
        ),
      ),
      Effect.bindAll(({ guildConfig }) =>
        pipe(
          guildConfig,
          Array.head,
          Option.map(({ sheetId, scriptId }) => ({
            sheetId: Effect.succeed(sheetId),
            scriptId: Effect.succeed(scriptId),
          })),
          Option.getOrElse(() => ({
            sheetId: Effect.succeed(undefined),
            scriptId: Effect.succeed(undefined),
          })),
        ),
      ),
      Effect.bind(
        "response",
        ({ guild, sheetId, scriptId, managerRoles, interaction }) =>
          Effect.tryPromise(() =>
            interaction.reply({
              embeds: [
                new EmbedBuilder()
                  .setTitle(`Config for ${escapeMarkdown(guild.name)}`)
                  .setDescription(
                    [
                      `Sheet id: ${escapeMarkdown(sheetId ?? "None")}`,
                      `Script id: ${escapeMarkdown(scriptId ?? "None")}`,
                      `Manager roles: ${managerRoles.length > 0 ? managerRoles.map((role) => roleMention(role.roleId)).join(", ") : "None"}`,
                    ].join("\n"),
                  ),
              ],
            }),
          ),
      ),
      Effect.withSpan("handleListConfig", { captureStackTrace: true }),
    ),
  )
  .build();

const handleAddManagerRole = chatInputSubcommandHandlerContextBuilder()
  .data(
    new SlashCommandSubcommandBuilder()
      .setName("manager_role")
      .setDescription("Add a manager role for the server")
      .addRoleOption((option) =>
        option
          .setName("role")
          .setDescription("The role to add")
          .setRequired(true),
      )
      .addStringOption((option) =>
        option
          .setName("server_id")
          .setDescription("The server id to add the manager role to"),
      ),
  )
  .handler(
    pipe(
      Effect.Do,
      Effect.bind("interaction", () =>
        InteractionContext.interaction<ChatInputCommandInteraction>(),
      ),
      Effect.bindAll(({ interaction }) => ({
        role: Effect.try(() => interaction.options.getRole("role", true)),
        serverId: pipe(
          Effect.try(
            () =>
              interaction.options.getString("server_id") ?? interaction.guildId,
          ),
          Effect.flatMap(Option.fromNullable),
        ),
        memberPermissions: Option.fromNullable(interaction.memberPermissions),
      })),
      Effect.bind("guild", ({ serverId, interaction }) =>
        Effect.tryPromise(() => interaction.client.guilds.fetch(serverId)),
      ),
      Effect.tap(({ memberPermissions }) =>
        !memberPermissions.has(PermissionFlagsBits.ManageGuild)
          ? Effect.fail("You do not have permission to manage the server")
          : Effect.void,
      ),
      Effect.tap(({ guild, role }) =>
        GuildConfigService.addManagerRole(guild.id, role.id),
      ),
      Effect.bind("response", ({ guild, role, interaction }) =>
        Effect.tryPromise(() =>
          interaction.reply({
            embeds: [
              new EmbedBuilder()
                .setTitle(`Success!`)
                .setDescription(
                  `${roleMention(role.id)} is now a manager role for ${escapeMarkdown(guild.name)}`,
                )
                .setTimestamp()
                .setFooter({
                  text: `${interaction.client.user.username} ${process.env.BUILD_VERSION}`,
                }),
            ],
          }),
        ),
      ),
      Effect.asVoid,
      Effect.withSpan("handleAddManagerRole", {
        captureStackTrace: true,
      }),
    ),
  )
  .build();

const handleAdd =
  chatInputSubcommandGroupHandlerContextWithSubcommandHandlerBuilder()
    .data(
      new SlashCommandSubcommandGroupBuilder()
        .setName("add")
        .setDescription("Add a config to the server"),
    )
    .addSubcommandHandler(handleAddManagerRole)
    .build();

const handleRemoveManagerRole = chatInputSubcommandHandlerContextBuilder()
  .data(
    new SlashCommandSubcommandBuilder()
      .setName("manager_role")
      .setDescription("Remove a manager role from the server")
      .addRoleOption((option) =>
        option
          .setName("role")
          .setDescription("The role to remove")
          .setRequired(true),
      )
      .addStringOption((option) =>
        option
          .setName("server_id")
          .setDescription("The server id to remove the manager role from"),
      ),
  )
  .handler(
    pipe(
      Effect.Do,
      Effect.bind("interaction", () =>
        InteractionContext.interaction<ChatInputCommandInteraction>(),
      ),
      Effect.bindAll(({ interaction }) => ({
        role: Effect.try(() => interaction.options.getRole("role", true)),
        serverId: pipe(
          Effect.try(
            () =>
              interaction.options.getString("server_id") ?? interaction.guildId,
          ),
          Effect.flatMap(Option.fromNullable),
        ),
        memberPermissions: Option.fromNullable(interaction.memberPermissions),
      })),
      Effect.bind("guild", ({ serverId, interaction }) =>
        Effect.tryPromise(() => interaction.client.guilds.fetch(serverId)),
      ),
      Effect.tap(({ memberPermissions }) =>
        !memberPermissions.has(PermissionFlagsBits.ManageGuild)
          ? Effect.fail("You do not have permission to manage the server")
          : Effect.void,
      ),
      Effect.tap(({ guild, role }) =>
        GuildConfigService.removeManagerRole(guild.id, role.id),
      ),
      Effect.bind("response", ({ guild, role, interaction }) =>
        Effect.tryPromise(() =>
          interaction.reply({
            embeds: [
              new EmbedBuilder()
                .setTitle(`Success!`)
                .setDescription(
                  `${roleMention(role.id)} is no longer a manager role for ${escapeMarkdown(guild.name)}`,
                )
                .setTimestamp()
                .setFooter({
                  text: `${interaction.client.user.username} ${process.env.BUILD_VERSION}`,
                }),
            ],
          }),
        ),
      ),
      Effect.asVoid,
      Effect.withSpan("handleRemoveManagerRole", {
        captureStackTrace: true,
      }),
    ),
  )
  .build();

const handleRemove =
  chatInputSubcommandGroupHandlerContextWithSubcommandHandlerBuilder()
    .data(
      new SlashCommandSubcommandGroupBuilder()
        .setName("remove")
        .setDescription("Remove a config from the server"),
    )
    .addSubcommandHandler(handleRemoveManagerRole)
    .build();

const handleSetSheet = chatInputSubcommandHandlerContextBuilder()
  .data(
    new SlashCommandSubcommandBuilder()
      .setName("sheet")
      .setDescription("Set the sheet id for the server")
      .addStringOption((option) =>
        option
          .setName("sheet_id")
          .setDescription("The sheet id to set")
          .setRequired(true),
      )
      .addStringOption((option) =>
        option
          .setName("server_id")
          .setDescription("The server id to set the sheet id for"),
      ),
  )
  .handler(
    pipe(
      Effect.Do,
      Effect.bind("interaction", () =>
        InteractionContext.interaction<ChatInputCommandInteraction>(),
      ),
      Effect.bindAll(({ interaction }) => ({
        sheetId: Effect.try(() =>
          interaction.options.getString("sheet_id", true),
        ),
        serverId: pipe(
          Effect.try(
            () =>
              interaction.options.getString("server_id") ?? interaction.guildId,
          ),
          Effect.flatMap(Option.fromNullable),
        ),
        memberPermissions: Option.fromNullable(interaction.memberPermissions),
      })),
      Effect.bind("guild", ({ serverId, interaction }) =>
        Effect.tryPromise(() => interaction.client.guilds.fetch(serverId)),
      ),
      Effect.tap(({ memberPermissions }) =>
        !memberPermissions.has(PermissionFlagsBits.ManageGuild)
          ? Effect.fail("You do not have permission to manage the server")
          : Effect.void,
      ),
      Effect.tap(({ guild, sheetId }) =>
        GuildConfigService.updateConfig(guild.id, {
          sheetId,
        }),
      ),
      Effect.bind("response", ({ guild, sheetId, interaction }) =>
        Effect.tryPromise(() =>
          interaction.reply({
            embeds: [
              new EmbedBuilder()
                .setTitle(`Success!`)
                .setDescription(
                  `Sheet id for ${escapeMarkdown(guild.name)} is now set to ${escapeMarkdown(sheetId)}`,
                )
                .setTimestamp()
                .setFooter({
                  text: `${interaction.client.user.username} ${process.env.BUILD_VERSION}`,
                }),
            ],
          }),
        ),
      ),
      Effect.asVoid,
      Effect.withSpan("handleSetSheet", { captureStackTrace: true }),
    ),
  )
  .build();

const handleSetScript = chatInputSubcommandHandlerContextBuilder()
  .data(
    new SlashCommandSubcommandBuilder()
      .setName("script")
      .setDescription("Set the script id for the server")
      .addStringOption((option) =>
        option
          .setName("script_id")
          .setDescription("The script id to set")
          .setRequired(true),
      )
      .addStringOption((option) =>
        option
          .setName("server_id")
          .setDescription("The server id to set the script id for"),
      ),
  )
  .handler(
    pipe(
      Effect.Do,
      Effect.bind("interaction", () =>
        InteractionContext.interaction<ChatInputCommandInteraction>(),
      ),
      Effect.bindAll(({ interaction }) => ({
        scriptId: Effect.try(() =>
          interaction.options.getString("script_id", true),
        ),
        serverId: pipe(
          Effect.try(
            () =>
              interaction.options.getString("server_id") ?? interaction.guildId,
          ),
          Effect.flatMap(Option.fromNullable),
        ),
      })),
      Effect.bind("guild", ({ serverId, interaction }) =>
        Effect.tryPromise(() => interaction.client.guilds.fetch(serverId)),
      ),
      Effect.tap(({ interaction }) =>
        PermissionService.checkOwner(interaction),
      ),
      Effect.tap(({ guild, scriptId }) =>
        GuildConfigService.updateConfig(guild.id, {
          scriptId,
        }),
      ),
      Effect.bind("response", ({ guild, scriptId, interaction }) =>
        Effect.tryPromise(() =>
          interaction.reply({
            embeds: [
              new EmbedBuilder()
                .setTitle(`Success!`)
                .setDescription(
                  `Script id for ${escapeMarkdown(guild.name)} is now set to ${escapeMarkdown(scriptId)}`,
                )
                .setTimestamp()
                .setFooter({
                  text: `${interaction.client.user.username} ${process.env.BUILD_VERSION}`,
                }),
            ],
          }),
        ),
      ),
      Effect.asVoid,
      Effect.withSpan("handleSetScript", { captureStackTrace: true }),
    ),
  )
  .build();

const handleSet =
  chatInputSubcommandGroupHandlerContextWithSubcommandHandlerBuilder()
    .data(
      new SlashCommandSubcommandGroupBuilder()
        .setName("set")
        .setDescription("Set the config of the server"),
    )
    .addSubcommandHandler(handleSetSheet)
    .addSubcommandHandler(handleSetScript)
    .build();

export const command =
  chatInputCommandHandlerContextWithSubcommandHandlerBuilder()
    .data(
      new SlashCommandBuilder()
        .setName("server")
        .setDescription("Server commands")
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
    .addSubcommandGroupHandler(handleAdd)
    .addSubcommandGroupHandler(handleRemove)
    .addSubcommandGroupHandler(handleSet)
    .addSubcommandHandler(handleListConfig)
    .build();
