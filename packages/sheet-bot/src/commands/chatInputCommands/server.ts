import {
  ApplicationIntegrationType,
  channelMention,
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
} from "../../types";

const handleListConfig = chatInputSubcommandHandlerContextBuilder()
  .data(
    new SlashCommandSubcommandBuilder()
      .setName("list_config")
      .setDescription("List the config for the server"),
  )
  .handler((interaction) =>
    pipe(
      Effect.Do,
      Effect.bindAll(() => ({
        guild: Option.fromNullable(interaction.guild),
        memberPermissions: Option.fromNullable(interaction.memberPermissions),
      })),
      Effect.tap(({ memberPermissions }) =>
        !memberPermissions.has(PermissionFlagsBits.ManageGuild)
          ? Effect.fail("You do not have permission to manage the server")
          : Effect.void,
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
      Effect.bind("response", ({ guild, sheetId, scriptId, managerRoles }) =>
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
      ),
  )
  .handler((interaction) =>
    pipe(
      Effect.Do,
      Effect.bindAll(() => ({
        role: Effect.try(() => interaction.options.getRole("role", true)),
        guild: Option.fromNullable(interaction.guild),
        memberPermissions: Option.fromNullable(interaction.memberPermissions),
      })),
      Effect.tap(({ memberPermissions }) =>
        !memberPermissions.has(PermissionFlagsBits.ManageGuild)
          ? Effect.fail("You do not have permission to manage the server")
          : Effect.void,
      ),
      Effect.tap(({ guild, role }) =>
        GuildConfigService.addManagerRole(guild.id, role.id),
      ),
      Effect.bind("response", ({ guild, role }) =>
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
    ),
  )
  .build();

const handleAddRunningChannel = chatInputSubcommandHandlerContextBuilder()
  .data(
    new SlashCommandSubcommandBuilder()
      .setName("running_channel")
      .setDescription("Add a running channel for the server")
      .addChannelOption((option) =>
        option
          .setName("channel")
          .setDescription("The channel to add")
          .setRequired(true),
      )
      .addStringOption((option) =>
        option
          .setName("name")
          .setDescription("The name of the running channel")
          .setRequired(true),
      ),
  )
  .handler((interaction) =>
    pipe(
      Effect.Do,
      Effect.bindAll(() => ({
        name: Effect.try(() => interaction.options.getString("name", true)),
        channel: Effect.try(() =>
          interaction.options.getChannel("channel", true),
        ),
        guild: Option.fromNullable(interaction.guild),
        memberPermissions: Option.fromNullable(interaction.memberPermissions),
      })),
      Effect.tap(({ memberPermissions }) =>
        !memberPermissions.has(PermissionFlagsBits.ManageGuild)
          ? Effect.fail("You do not have permission to manage the server")
          : Effect.void,
      ),
      Effect.tap(({ guild, name, channel }) =>
        GuildConfigService.addRunningChannel(guild.id, channel.id, name),
      ),
      Effect.bind("response", ({ guild, name, channel }) =>
        Effect.tryPromise(() =>
          interaction.reply({
            embeds: [
              new EmbedBuilder()
                .setTitle(`Success!`)
                .setDescription(
                  `${escapeMarkdown(name)} (${channelMention(channel.id)}) is now a running channel for ${escapeMarkdown(guild.name)}`,
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
    .addSubcommandHandler(handleAddRunningChannel)
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
      ),
  )
  .handler((interaction) =>
    pipe(
      Effect.Do,
      Effect.bindAll(() => ({
        role: Effect.try(() => interaction.options.getRole("role", true)),
        guild: Option.fromNullable(interaction.guild),
        memberPermissions: Option.fromNullable(interaction.memberPermissions),
      })),
      Effect.tap(({ memberPermissions }) =>
        !memberPermissions.has(PermissionFlagsBits.ManageGuild)
          ? Effect.fail("You do not have permission to manage the server")
          : Effect.void,
      ),
      Effect.tap(({ guild, role }) =>
        GuildConfigService.removeManagerRole(guild.id, role.id),
      ),
      Effect.bind("response", ({ guild, role }) =>
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
    ),
  )
  .build();

const handleRemoveRunningChannel = chatInputSubcommandHandlerContextBuilder()
  .data(
    new SlashCommandSubcommandBuilder()
      .setName("running_channel")
      .setDescription("Remove a running channel from the server")
      .addStringOption((option) =>
        option
          .setName("name")
          .setDescription("The name of the running channel")
          .setRequired(true),
      ),
  )
  .handler((interaction) =>
    pipe(
      Effect.Do,
      Effect.bindAll(() => ({
        name: Effect.try(() => interaction.options.getString("name", true)),
        guild: Option.fromNullable(interaction.guild),
        memberPermissions: Option.fromNullable(interaction.memberPermissions),
      })),
      Effect.tap(({ memberPermissions }) =>
        !memberPermissions.has(PermissionFlagsBits.ManageGuild)
          ? Effect.fail("You do not have permission to manage the server")
          : Effect.void,
      ),
      Effect.bind("runningChannel", ({ guild, name }) =>
        pipe(
          GuildConfigService.removeRunningChannel(guild.id, name),
          Effect.flatMap(Array.head),
        ),
      ),
      Effect.bind("response", ({ guild, name, runningChannel }) =>
        Effect.tryPromise(() =>
          interaction.reply({
            embeds: [
              new EmbedBuilder()
                .setTitle(`Success!`)
                .setDescription(
                  `${escapeMarkdown(name)} (${channelMention(runningChannel.channelId)}) is no longer a running channel for ${escapeMarkdown(guild.name)}`,
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
    .addSubcommandHandler(handleRemoveRunningChannel)
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
      ),
  )
  .handler((interaction) =>
    pipe(
      Effect.Do,
      Effect.bindAll(() => ({
        sheetId: Effect.try(() =>
          interaction.options.getString("sheet_id", true),
        ),
        guild: Option.fromNullable(interaction.guild),
        memberPermissions: Option.fromNullable(interaction.memberPermissions),
      })),
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
      Effect.bind("response", ({ guild, sheetId }) =>
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
      ),
  )
  .handler((interaction) =>
    pipe(
      Effect.Do,
      Effect.bindAll(() => ({
        scriptId: Effect.try(() =>
          interaction.options.getString("script_id", true),
        ),
        guild: Option.fromNullable(interaction.guild),
      })),
      Effect.tap(() => PermissionService.checkOwner(interaction)),
      Effect.tap(({ guild, scriptId }) =>
        GuildConfigService.updateConfig(guild.id, {
          scriptId,
        }),
      ),
      Effect.bind("response", ({ guild, scriptId }) =>
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
