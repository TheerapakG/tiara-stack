import {
  ClientService,
  GuildConfigService,
  guildServicesFromInteractionOption,
  InteractionContext,
  PermissionService,
} from "@/services";
import {
  chatInputCommandSubcommandHandlerContextBuilder,
  ChatInputSubcommandHandlerVariantT,
  handlerVariantContextBuilder,
} from "@/types";
import { bindObject } from "@/utils";
import {
  ApplicationIntegrationType,
  channelMention,
  escapeMarkdown,
  InteractionContextType,
  PermissionFlagsBits,
  roleMention,
  SlashCommandBuilder,
  SlashCommandSubcommandBuilder,
} from "discord.js";
import { Effect, Option, pipe } from "effect";
import { GuildConfig } from "sheet-apis/schema";

const configFields = (config: GuildConfig.GuildChannelConfig) => [
  {
    name: "Name",
    value: pipe(
      config.name,
      Option.map(escapeMarkdown),
      Option.getOrElse(() => "None!"),
    ),
  },
  {
    name: "Running channel",
    value: config.running ? "Yes" : "No",
  },
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

const handleListConfig = handlerVariantContextBuilder<ChatInputSubcommandHandlerVariantT>()
  .data(
    new SlashCommandSubcommandBuilder()
      .setName("list_config")
      .setDescription("List the config for the channel"),
  )
  .handler(
    Effect.provide(guildServicesFromInteractionOption("server_id"))(
      pipe(
        Effect.all({
          channel: InteractionContext.channel(true).sync(),
        }),
        InteractionContext.deferReply.tap(),
        PermissionService.checkPermissions.tap(() => ({
          permissions: PermissionFlagsBits.ManageGuild,
        })),
        Effect.bind("config", ({ channel }) =>
          GuildConfigService.getGuildRunningChannelById(channel.id),
        ),
        InteractionContext.editReply.tapEffect(({ config }) =>
          pipe(
            ClientService.makeEmbedBuilder(),
            Effect.map((embed) => ({
              embeds: [
                embed.setTitle(`Config for this channel`).addFields(...configFields(config)),
              ],
            })),
          ),
        ),
        Effect.withSpan("handleListConfig", {
          captureStackTrace: true,
        }),
      ),
    ),
  )
  .build();

const handleSet = handlerVariantContextBuilder<ChatInputSubcommandHandlerVariantT>()
  .data(
    new SlashCommandSubcommandBuilder()
      .setName("set")
      .setDescription("Set the config for the channel")
      .addBooleanOption((option) =>
        option.setName("running").setDescription("The running flag for the channel"),
      )
      .addStringOption((option) => option.setName("name").setDescription("The name of the channel"))
      .addRoleOption((option) =>
        option.setName("role").setDescription("The role to assign to the channel"),
      )
      .addChannelOption((option) =>
        option
          .setName("checkin_channel")
          .setDescription("The channel to send check in messages to"),
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
        InteractionContext.channel(true).bind("channel"),
        bindObject({
          running: InteractionContext.getBoolean("running"),
          name: InteractionContext.getString("name"),
          role: InteractionContext.getRole("role"),
          checkinChannel: InteractionContext.getChannel("checkin_channel"),
        }),
        Effect.bind("config", ({ channel, running, name, role, checkinChannel }) =>
          pipe(
            GuildConfigService.upsertGuildChannelConfig(channel.id, {
              ...(Option.isSome(running) ? { running: running.value } : {}),
              ...(Option.isSome(name) ? { name: name.value } : {}),
              ...(Option.isSome(role) ? { roleId: role.value.id } : {}),
              ...(Option.isSome(checkinChannel)
                ? { checkinChannelId: checkinChannel.value.id }
                : {}),
            }),
          ),
        ),
        InteractionContext.editReply.tapEffect(({ channel, config }) =>
          pipe(
            ClientService.makeEmbedBuilder(),
            Effect.map((embed) => ({
              embeds: [
                embed
                  .setTitle(`Success!`)
                  .setDescription(`${channelMention(channel.id)} configuration updated`)
                  .addFields(...configFields(config)),
              ],
            })),
          ),
        ),
        Effect.withSpan("handleSet", {
          captureStackTrace: true,
        }),
      ),
    ),
  )
  .build();

const handleUnset = handlerVariantContextBuilder<ChatInputSubcommandHandlerVariantT>()
  .data(
    new SlashCommandSubcommandBuilder()
      .setName("unset")
      .setDescription("Unset the config for the channel")
      .addBooleanOption((option) =>
        option.setName("name").setDescription("Unset the name of the channel"),
      )
      .addBooleanOption((option) =>
        option.setName("role").setDescription("Unset the role of the channel"),
      )
      .addBooleanOption((option) =>
        option
          .setName("checkin_channel")
          .setDescription("Unset the checkin channel of the channel"),
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
        InteractionContext.channel(true).bind("channel"),
        bindObject({
          name: InteractionContext.getBoolean("name"),
          role: InteractionContext.getBoolean("role"),
          checkinChannel: InteractionContext.getBoolean("checkin_channel"),
        }),
        Effect.bind("config", ({ channel, name, role, checkinChannel }) =>
          pipe(
            GuildConfigService.upsertGuildChannelConfig(channel.id, {
              ...(Option.getOrUndefined(name) ? { name: null } : {}),
              ...(Option.getOrUndefined(role) ? { roleId: null } : {}),
              ...(Option.getOrUndefined(checkinChannel) ? { checkinChannelId: null } : {}),
            }),
          ),
        ),
        InteractionContext.editReply.tapEffect(({ channel, config }) =>
          pipe(
            ClientService.makeEmbedBuilder(),
            Effect.map((embed) => ({
              embeds: [
                embed
                  .setTitle(`Success!`)
                  .setDescription(`${channelMention(channel.id)} configuration updated`)
                  .addFields(...configFields(config)),
              ],
            })),
          ),
        ),
        Effect.withSpan("handleUnset", {
          captureStackTrace: true,
        }),
      ),
    ),
  )
  .build();

export const command = chatInputCommandSubcommandHandlerContextBuilder()
  .data(
    new SlashCommandBuilder()
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
      ),
  )
  .addSubcommandHandler(handleListConfig)
  .addSubcommandHandler(handleSet)
  .addSubcommandHandler(handleUnset)
  .build();
