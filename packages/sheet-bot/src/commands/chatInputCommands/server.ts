import {
  ApplicationIntegrationType,
  EmbedBuilder,
  escapeMarkdown,
  InteractionContextType,
  PermissionFlagsBits,
  roleMention,
  SlashCommandBuilder,
  SlashCommandSubcommandBuilder,
  SlashCommandSubcommandGroupBuilder,
} from "discord.js";
import { Effect, Option, pipe } from "effect";
import { observeOnce } from "typhoon-server/signal";
import {
  ClientService,
  GuildConfigService,
  GuildService,
  guildServicesFromInteractionOption,
  PermissionService,
} from "../../services";
import {
  chatInputCommandHandlerContextWithSubcommandHandlerBuilder,
  chatInputSubcommandGroupHandlerContextWithSubcommandHandlerBuilder,
  chatInputSubcommandHandlerContextBuilder,
  InteractionContext,
} from "../../types";
import { bindObject } from "../../utils";

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
      PermissionService.tapCheckPermissions(PermissionFlagsBits.ManageGuild),
      bindObject({
        guild: GuildService.getGuild(),
        guildConfig: pipe(
          GuildConfigService.getConfig(),
          Effect.flatMap(observeOnce),
          Effect.map(Option.getOrUndefined),
        ),
        managerRoles: pipe(
          GuildConfigService.getManagerRoles(),
          Effect.flatMap(observeOnce),
        ),
      }),
      Effect.tap(({ guild, guildConfig, managerRoles }) =>
        InteractionContext.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle(`Config for ${escapeMarkdown(guild.name)}`)
              .setDescription(
                [
                  `Sheet id: ${escapeMarkdown(guildConfig?.sheetId ?? "None")}`,
                  `Script id: ${escapeMarkdown(guildConfig?.scriptId ?? "None")}`,
                  `Manager roles: ${managerRoles.length > 0 ? managerRoles.map((role) => roleMention(role.roleId)).join(", ") : "None"}`,
                ].join("\n"),
              ),
          ],
        }),
      ),
      Effect.provide(guildServicesFromInteractionOption("server_id")),
      Effect.withSpan("handleServerListConfig", {
        captureStackTrace: true,
      }),
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
      PermissionService.tapCheckPermissions(PermissionFlagsBits.ManageGuild),
      bindObject({
        guild: GuildService.getGuild(),
        role: InteractionContext.getRole("role", true),
      }),
      Effect.tap(({ role }) => GuildConfigService.addManagerRole(role.id)),
      Effect.tap(({ guild, role }) =>
        pipe(
          ClientService.makeEmbedBuilder(),
          Effect.tap((embed) =>
            InteractionContext.reply({
              embeds: [
                embed
                  .setTitle(`Success!`)
                  .setDescription(
                    `${roleMention(role.id)} is now a manager role for ${escapeMarkdown(guild.name)}`,
                  ),
              ],
            }),
          ),
        ),
      ),
      Effect.provide(guildServicesFromInteractionOption("server_id")),
      Effect.withSpan("handleServerAddManagerRole", {
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
      PermissionService.tapCheckPermissions(PermissionFlagsBits.ManageGuild),
      bindObject({
        guild: GuildService.getGuild(),
        role: InteractionContext.getRole("role", true),
      }),
      Effect.tap(({ role }) => GuildConfigService.removeManagerRole(role.id)),
      Effect.tap(({ guild, role }) =>
        pipe(
          ClientService.makeEmbedBuilder(),
          Effect.tap((embed) =>
            InteractionContext.reply({
              embeds: [
                embed
                  .setTitle(`Success!`)
                  .setDescription(
                    `${roleMention(role.id)} is no longer a manager role for ${escapeMarkdown(guild.name)}`,
                  ),
              ],
            }),
          ),
        ),
      ),
      Effect.provide(guildServicesFromInteractionOption("server_id")),
      Effect.withSpan("handleServerRemoveManagerRole", {
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
      PermissionService.tapCheckPermissions(PermissionFlagsBits.ManageGuild),
      bindObject({
        sheetId: InteractionContext.getString("sheet_id", true),
        guild: GuildService.getGuild(),
      }),
      Effect.tap(({ sheetId }) =>
        GuildConfigService.updateConfig({
          sheetId,
        }),
      ),
      Effect.tap(({ guild, sheetId }) =>
        pipe(
          ClientService.makeEmbedBuilder(),
          Effect.tap((embed) =>
            InteractionContext.reply({
              embeds: [
                embed
                  .setTitle(`Success!`)
                  .setDescription(
                    `Sheet id for ${escapeMarkdown(guild.name)} is now set to ${escapeMarkdown(sheetId)}`,
                  ),
              ],
            }),
          ),
        ),
      ),
      Effect.provide(guildServicesFromInteractionOption("server_id")),
      Effect.withSpan("handleServerSetSheet", { captureStackTrace: true }),
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
      PermissionService.tapCheckOwner({ allowSameGuild: false }),
      bindObject({
        scriptId: InteractionContext.getString("script_id", true),
        guild: GuildService.getGuild(),
      }),
      Effect.tap(({ scriptId }) =>
        GuildConfigService.updateConfig({
          scriptId,
        }),
      ),
      Effect.tap(({ guild, scriptId }) =>
        pipe(
          ClientService.makeEmbedBuilder(),
          Effect.tap((embed) =>
            InteractionContext.reply({
              embeds: [
                embed
                  .setTitle(`Success!`)
                  .setDescription(
                    `Script id for ${escapeMarkdown(guild.name)} is now set to ${escapeMarkdown(scriptId)}`,
                  ),
              ],
            }),
          ),
        ),
      ),
      Effect.provide(guildServicesFromInteractionOption("server_id")),
      Effect.withSpan("handleServerSetScript", { captureStackTrace: true }),
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
