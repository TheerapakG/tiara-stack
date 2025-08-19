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
  InteractionContext,
  PermissionService,
} from "../../services";
import {
  chatInputCommandHandlerContextWithSubcommandHandlerBuilder,
  chatInputSubcommandGroupHandlerContextWithSubcommandHandlerBuilder,
  chatInputSubcommandHandlerContextBuilder,
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
    Effect.provide(guildServicesFromInteractionOption("server_id"))(
      pipe(
        Effect.Do,
        PermissionService.tapCheckPermissions(() => ({
          permissions: PermissionFlagsBits.ManageGuild,
        })),
        bindObject({
          guildName: GuildService.getName(),
          guildConfig: pipe(
            GuildConfigService.getConfig(),
            Effect.flatMap(observeOnce),
          ),
          managerRoles: pipe(
            GuildConfigService.getManagerRoles(),
            Effect.flatMap(observeOnce),
          ),
        }),
        Effect.bindAll(({ guildConfig }) => ({
          sheetId: pipe(
            guildConfig,
            Option.flatMap((guildConfig) => guildConfig.sheetId),
            Option.match({
              onSome: (sheetId) => Effect.succeed(escapeMarkdown(sheetId)),
              onNone: () => Effect.succeed("None"),
            }),
          ),
          scriptId: pipe(
            guildConfig,
            Option.flatMap((guildConfig) => guildConfig.scriptId),
            Option.match({
              onSome: (scriptId) => Effect.succeed(escapeMarkdown(scriptId)),
              onNone: () => Effect.succeed("None"),
            }),
          ),
        })),
        InteractionContext.tapReply(
          ({ guildName, sheetId, scriptId, managerRoles }) => ({
            embeds: [
              new EmbedBuilder()
                .setTitle(`Config for ${escapeMarkdown(guildName)}`)
                .setDescription(
                  [
                    `Sheet id: ${sheetId}`,
                    `Script id: ${scriptId}`,
                    `Manager roles: ${managerRoles.length > 0 ? managerRoles.map((role) => roleMention(role.roleId)).join(", ") : "None"}`,
                  ].join("\n"),
                ),
            ],
          }),
        ),
        Effect.withSpan("handleServerListConfig", {
          captureStackTrace: true,
        }),
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
      )
      .addStringOption((option) =>
        option
          .setName("server_id")
          .setDescription("The server id to add the manager role to"),
      ),
  )
  .handler(
    Effect.provide(guildServicesFromInteractionOption("server_id"))(
      pipe(
        Effect.Do,
        PermissionService.tapCheckPermissions(() => ({
          permissions: PermissionFlagsBits.ManageGuild,
        })),
        bindObject({
          guildName: GuildService.getName(),
          role: InteractionContext.getRole("role", true),
        }),
        Effect.tap(({ role }) => GuildConfigService.addManagerRole(role.id)),
        Effect.tap(({ guildName, role }) =>
          pipe(
            ClientService.makeEmbedBuilder(),
            InteractionContext.tapReply((embed) => ({
              embeds: [
                embed
                  .setTitle(`Success!`)
                  .setDescription(
                    `${roleMention(role.id)} is now a manager role for ${escapeMarkdown(guildName)}`,
                  ),
              ],
            })),
          ),
        ),
        Effect.withSpan("handleServerAddManagerRole", {
          captureStackTrace: true,
        }),
      ),
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
    Effect.provide(guildServicesFromInteractionOption("server_id"))(
      pipe(
        Effect.Do,
        PermissionService.tapCheckPermissions(() => ({
          permissions: PermissionFlagsBits.ManageGuild,
        })),
        bindObject({
          guildName: GuildService.getName(),
          role: InteractionContext.getRole("role", true),
        }),
        Effect.tap(({ role }) => GuildConfigService.removeManagerRole(role.id)),
        Effect.tap(({ guildName, role }) =>
          pipe(
            ClientService.makeEmbedBuilder(),
            InteractionContext.tapReply((embed) => ({
              embeds: [
                embed
                  .setTitle(`Success!`)
                  .setDescription(
                    `${roleMention(role.id)} is no longer a manager role for ${escapeMarkdown(guildName)}`,
                  ),
              ],
            })),
          ),
        ),
        Effect.withSpan("handleServerRemoveManagerRole", {
          captureStackTrace: true,
        }),
      ),
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
    Effect.provide(guildServicesFromInteractionOption("server_id"))(
      pipe(
        Effect.Do,
        PermissionService.tapCheckPermissions(() => ({
          permissions: PermissionFlagsBits.ManageGuild,
        })),
        bindObject({
          sheetId: InteractionContext.getString("sheet_id", true),
          guildName: GuildService.getName(),
        }),
        Effect.tap(({ sheetId }) =>
          GuildConfigService.upsertConfig({
            sheetId,
          }),
        ),
        Effect.tap(({ guildName, sheetId }) =>
          pipe(
            ClientService.makeEmbedBuilder(),
            InteractionContext.tapReply((embed) => ({
              embeds: [
                embed
                  .setTitle(`Success!`)
                  .setDescription(
                    `Sheet id for ${escapeMarkdown(guildName)} is now set to ${escapeMarkdown(sheetId)}`,
                  ),
              ],
            })),
          ),
        ),
        Effect.withSpan("handleServerSetSheet", { captureStackTrace: true }),
      ),
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
    Effect.provide(guildServicesFromInteractionOption("server_id"))(
      pipe(
        Effect.Do,
        PermissionService.tapCheckOwner(() => ({ allowSameGuild: false })),
        bindObject({
          scriptId: InteractionContext.getString("script_id", true),
          guildName: GuildService.getName(),
        }),
        Effect.tap(({ scriptId }) =>
          GuildConfigService.upsertConfig({
            scriptId,
          }),
        ),
        Effect.tap(({ guildName, scriptId }) =>
          pipe(
            ClientService.makeEmbedBuilder(),
            InteractionContext.tapReply((embed) => ({
              embeds: [
                embed
                  .setTitle(`Success!`)
                  .setDescription(
                    `Script id for ${escapeMarkdown(guildName)} is now set to ${escapeMarkdown(scriptId)}`,
                  ),
              ],
            })),
          ),
        ),
        Effect.withSpan("handleServerSetScript", { captureStackTrace: true }),
      ),
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
