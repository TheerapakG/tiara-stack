import {
  ClientService,
  GuildConfigService,
  GuildService,
  guildServicesFromInteractionOption,
  InteractionContext,
  PermissionService,
} from "@/services";
import {
  chatInputCommandSubcommandHandlerContextBuilder,
  chatInputSubcommandGroupSubcommandHandlerContextBuilder,
  ChatInputSubcommandHandlerVariantT,
  handlerVariantContextBuilder,
} from "@/types";
import { bindObject } from "@/utils";
import {
  ApplicationIntegrationType,
  escapeMarkdown,
  InteractionContextType,
  PermissionFlagsBits,
  roleMention,
  SlashCommandBuilder,
  SlashCommandSubcommandBuilder,
  SlashCommandSubcommandGroupBuilder,
} from "discord.js";
import { Array, Effect, Number, Option, Order, pipe } from "effect";
import { UntilObserver } from "typhoon-core/signal";

const handleListConfig = handlerVariantContextBuilder<ChatInputSubcommandHandlerVariantT>()
  .data(
    new SlashCommandSubcommandBuilder()
      .setName("list_config")
      .setDescription("List the config for the server")
      .addStringOption((option) =>
        option.setName("server_id").setDescription("The server id to list the config for"),
      ),
  )
  .handler(
    Effect.provide(guildServicesFromInteractionOption("server_id"))(
      pipe(
        Effect.Do,
        InteractionContext.deferReply.tap(),
        PermissionService.checkPermissions.tap(() => ({
          permissions: PermissionFlagsBits.ManageGuild,
        })),
        Effect.bind("guildName", () => GuildService.getName()),
        Effect.bind("guildConfig", () =>
          pipe(
            GuildConfigService.getGuildConfigByGuildId(),
            UntilObserver.observeUntilRpcResultResolved(),
            Effect.tap((config) => Effect.log(config)),
            Effect.flatten,
          ),
        ),
        Effect.bind("managerRoles", () =>
          pipe(
            GuildConfigService.getGuildManagerRoles(),
            UntilObserver.observeUntilRpcResultResolved(),
            Effect.flatten,
          ),
        ),
        Effect.bindAll(({ guildConfig }) => ({
          sheetId: pipe(
            guildConfig.sheetId,
            Option.map(escapeMarkdown),
            Option.getOrElse(() => "None"),
            Effect.succeed,
          ),
          scriptId: pipe(
            guildConfig.scriptId,
            Option.map(escapeMarkdown),
            Option.getOrElse(() => "None"),
            Effect.succeed,
          ),
          autoCheckin: pipe(guildConfig.autoCheckin, Effect.succeed),
        })),
        InteractionContext.editReply.tapEffect(
          ({ guildName, sheetId, scriptId, autoCheckin, managerRoles }) =>
            pipe(
              ClientService.makeEmbedBuilder(),
              Effect.map((embed) => ({
                embeds: [
                  embed.setTitle(`Config for ${escapeMarkdown(guildName)}`).setDescription(
                    [
                      `Sheet id: ${sheetId}`,
                      `Script id: ${scriptId}`,
                      `Auto check-in: ${autoCheckin ? "Enabled" : "Disabled"}`,
                      `Manager roles: ${
                        pipe(managerRoles, Array.length, Order.greaterThan(Number.Order)(0))
                          ? pipe(
                              managerRoles,
                              Array.map((role) => roleMention(role.roleId)),
                              Array.join(", "),
                            )
                          : "None"
                      }`,
                    ].join("\n"),
                  ),
                ],
              })),
            ),
        ),
        Effect.withSpan("handleServerListConfig", {
          captureStackTrace: true,
        }),
      ),
    ),
  )
  .build();

const handleAddManagerRole = handlerVariantContextBuilder<ChatInputSubcommandHandlerVariantT>()
  .data(
    new SlashCommandSubcommandBuilder()
      .setName("manager_role")
      .setDescription("Add a manager role for the server")
      .addRoleOption((option) =>
        option.setName("role").setDescription("The role to add").setRequired(true),
      )
      .addStringOption((option) =>
        option.setName("server_id").setDescription("The server id to add the manager role to"),
      ),
  )
  .handler(
    Effect.provide(guildServicesFromInteractionOption("server_id"))(
      pipe(
        Effect.Do,
        InteractionContext.deferReply.tap(),
        PermissionService.checkPermissions.tap(() => ({
          permissions: PermissionFlagsBits.ManageGuild,
        })),
        bindObject({
          guildName: GuildService.getName(),
          role: InteractionContext.getRole("role", true),
        }),
        Effect.tap(({ role }) => GuildConfigService.addGuildManagerRole(role.id)),
        InteractionContext.editReply.tapEffect(({ guildName, role }) =>
          pipe(
            ClientService.makeEmbedBuilder(),
            Effect.map((embed) => ({
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

const handleAdd = chatInputSubcommandGroupSubcommandHandlerContextBuilder()
  .data(
    new SlashCommandSubcommandGroupBuilder()
      .setName("add")
      .setDescription("Add a config to the server"),
  )
  .addSubcommandHandler(handleAddManagerRole)
  .build();

const handleRemoveManagerRole = handlerVariantContextBuilder<ChatInputSubcommandHandlerVariantT>()
  .data(
    new SlashCommandSubcommandBuilder()
      .setName("manager_role")
      .setDescription("Remove a manager role from the server")
      .addRoleOption((option) =>
        option.setName("role").setDescription("The role to remove").setRequired(true),
      )
      .addStringOption((option) =>
        option.setName("server_id").setDescription("The server id to remove the manager role from"),
      ),
  )
  .handler(
    Effect.provide(guildServicesFromInteractionOption("server_id"))(
      pipe(
        Effect.Do,
        InteractionContext.deferReply.tap(),
        PermissionService.checkPermissions.tap(() => ({
          permissions: PermissionFlagsBits.ManageGuild,
        })),
        bindObject({
          guildName: GuildService.getName(),
          role: InteractionContext.getRole("role", true),
        }),
        Effect.tap(({ role }) => GuildConfigService.removeGuildManagerRole(role.id)),
        InteractionContext.editReply.tapEffect(({ guildName, role }) =>
          pipe(
            ClientService.makeEmbedBuilder(),
            Effect.map((embed) => ({
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

const handleRemove = chatInputSubcommandGroupSubcommandHandlerContextBuilder()
  .data(
    new SlashCommandSubcommandGroupBuilder()
      .setName("remove")
      .setDescription("Remove a config from the server"),
  )
  .addSubcommandHandler(handleRemoveManagerRole)
  .build();

const handleSetSheet = handlerVariantContextBuilder<ChatInputSubcommandHandlerVariantT>()
  .data(
    new SlashCommandSubcommandBuilder()
      .setName("sheet")
      .setDescription("Set the sheet id for the server")
      .addStringOption((option) =>
        option.setName("sheet_id").setDescription("The sheet id to set").setRequired(true),
      )
      .addStringOption((option) =>
        option.setName("server_id").setDescription("The server id to set the sheet id for"),
      ),
  )
  .handler(
    Effect.provide(guildServicesFromInteractionOption("server_id"))(
      pipe(
        Effect.Do,
        InteractionContext.deferReply.tap(),
        PermissionService.checkPermissions.tap(() => ({
          permissions: PermissionFlagsBits.ManageGuild,
        })),
        bindObject({
          sheetId: InteractionContext.getString("sheet_id", true),
          guildName: GuildService.getName(),
        }),
        Effect.tap(({ sheetId }) =>
          GuildConfigService.upsertGuildConfig({
            sheetId,
          }),
        ),
        InteractionContext.editReply.tapEffect(({ guildName, sheetId }) =>
          pipe(
            ClientService.makeEmbedBuilder(),
            Effect.map((embed) => ({
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

const handleSetScript = handlerVariantContextBuilder<ChatInputSubcommandHandlerVariantT>()
  .data(
    new SlashCommandSubcommandBuilder()
      .setName("script")
      .setDescription("Set the script id for the server")
      .addStringOption((option) =>
        option.setName("script_id").setDescription("The script id to set").setRequired(true),
      )
      .addStringOption((option) =>
        option.setName("server_id").setDescription("The server id to set the script id for"),
      ),
  )
  .handler(
    Effect.provide(guildServicesFromInteractionOption("server_id"))(
      pipe(
        Effect.Do,
        InteractionContext.deferReply.tap(),
        PermissionService.checkOwner.tap(() => ({ allowSameGuild: false })),
        bindObject({
          scriptId: InteractionContext.getString("script_id", true),
          guildName: GuildService.getName(),
        }),
        Effect.tap(({ scriptId }) =>
          GuildConfigService.upsertGuildConfig({
            scriptId,
          }),
        ),
        InteractionContext.editReply.tapEffect(({ guildName, scriptId }) =>
          pipe(
            ClientService.makeEmbedBuilder(),
            Effect.map((embed) => ({
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

const handleSetAutoCheckin = handlerVariantContextBuilder<ChatInputSubcommandHandlerVariantT>()
  .data(
    new SlashCommandSubcommandBuilder()
      .setName("auto_checkin")
      .setDescription("Set whether automatic check-in is enabled")
      .addBooleanOption((option) =>
        option
          .setName("auto_checkin")
          .setDescription("Enable automatic check-in")
          .setRequired(true),
      )
      .addStringOption((option) =>
        option.setName("server_id").setDescription("The server id to set auto check-in for"),
      ),
  )
  .handler(
    Effect.provide(guildServicesFromInteractionOption("server_id"))(
      pipe(
        Effect.Do,
        InteractionContext.deferReply.tap(),
        PermissionService.checkPermissions.tap(() => ({
          permissions: PermissionFlagsBits.ManageGuild,
        })),
        bindObject({
          enabled: InteractionContext.getBoolean("auto_checkin", true),
          guildName: GuildService.getName(),
        }),
        Effect.tap(({ enabled }) =>
          GuildConfigService.upsertGuildConfig({
            autoCheckin: enabled,
          }),
        ),
        InteractionContext.editReply.tapEffect(({ guildName, enabled }) =>
          pipe(
            ClientService.makeEmbedBuilder(),
            Effect.map((embed) => ({
              embeds: [
                embed
                  .setTitle(`Success!`)
                  .setDescription(
                    `Auto check-in for ${escapeMarkdown(guildName)} is now ${enabled ? "enabled" : "disabled"}.`,
                  ),
              ],
            })),
          ),
        ),
        Effect.withSpan("handleServerSetAutoCheckin", {
          captureStackTrace: true,
        }),
      ),
    ),
  )
  .build();

const handleSet = chatInputSubcommandGroupSubcommandHandlerContextBuilder()
  .data(
    new SlashCommandSubcommandGroupBuilder()
      .setName("set")
      .setDescription("Set the config of the server"),
  )
  .addSubcommandHandler(handleSetSheet)
  .addSubcommandHandler(handleSetScript)
  .addSubcommandHandler(handleSetAutoCheckin)
  .build();

export const command = chatInputCommandSubcommandHandlerContextBuilder()
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
