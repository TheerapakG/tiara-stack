import {
  ClientService,
  GuildChannelConfig,
  GuildConfigService,
  guildSheetServicesFromInteractionOption,
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
import { Effect, Function, Option, pipe } from "effect";

const configFields = (config: GuildChannelConfig) => [
  {
    name: "Name",
    value: pipe(
      config.name,
      Option.match({
        onSome: (name) => escapeMarkdown(name),
        onNone: () => "None!",
      }),
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
      Option.match({
        onSome: (roleId) => roleMention(roleId),
        onNone: () => "None!",
      }),
    ),
  },
  {
    name: "Checkin channel",
    value: pipe(
      config.checkinChannelId,
      Option.match({
        onSome: (channelId) => channelMention(channelId),
        onNone: () => "None!",
      }),
    ),
  },
];

const handleSet =
  handlerVariantContextBuilder<ChatInputSubcommandHandlerVariantT>()
    .data(
      new SlashCommandSubcommandBuilder()
        .setName("set")
        .setDescription("Set the config for the channel")
        .addBooleanOption((option) =>
          option
            .setName("running")
            .setDescription("The running flag for the channel"),
        )
        .addStringOption((option) =>
          option.setName("name").setDescription("The name of the channel"),
        )
        .addRoleOption((option) =>
          option
            .setName("role")
            .setDescription("The role to assign to the channel"),
        )
        .addChannelOption((option) =>
          option
            .setName("checkin_channel")
            .setDescription("The channel to send check in messages to"),
        ),
    )
    .handler(
      Effect.provide(guildSheetServicesFromInteractionOption("server_id"))(
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
          Effect.bind(
            "config",
            ({ channel, running, name, role, checkinChannel }) =>
              pipe(
                GuildConfigService.setChannelConfig(channel.id, {
                  running: Option.getOrUndefined(running),
                  name: Option.getOrUndefined(name),
                  roleId: pipe(
                    role,
                    Option.map((r) => r.id),
                    Option.getOrUndefined,
                  ),
                  checkinChannelId: pipe(
                    checkinChannel,
                    Option.map((c) => c.id),
                    Option.getOrUndefined,
                  ),
                }),
                Effect.flatMap(Function.identity),
              ),
          ),
          InteractionContext.editReply.tapEffect(({ channel, config }) =>
            pipe(
              ClientService.makeEmbedBuilder(),
              Effect.map((embed) => ({
                embeds: [
                  embed
                    .setTitle(`Success!`)
                    .setDescription(
                      `${channelMention(channel.id)} configuration updated`,
                    )
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

const handleUnset =
  handlerVariantContextBuilder<ChatInputSubcommandHandlerVariantT>()
    .data(
      new SlashCommandSubcommandBuilder()
        .setName("unset")
        .setDescription("Unset the config for the channel")
        .addBooleanOption((option) =>
          option
            .setName("name")
            .setDescription("Unset the name of the channel"),
        )
        .addBooleanOption((option) =>
          option
            .setName("role")
            .setDescription("Unset the role of the channel"),
        )
        .addBooleanOption((option) =>
          option
            .setName("checkin_channel")
            .setDescription("Unset the checkin channel of the channel"),
        ),
    )
    .handler(
      Effect.provide(guildSheetServicesFromInteractionOption("server_id"))(
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
              GuildConfigService.setChannelConfig(channel.id, {
                name: Option.getOrUndefined(name) ? null : undefined,
                roleId: Option.getOrUndefined(role) ? null : undefined,
                checkinChannelId: Option.getOrUndefined(checkinChannel)
                  ? null
                  : undefined,
              }),
              Effect.flatMap(Function.identity),
            ),
          ),
          InteractionContext.editReply.tapEffect(({ channel, config }) =>
            pipe(
              ClientService.makeEmbedBuilder(),
              Effect.map((embed) => ({
                embeds: [
                  embed
                    .setTitle(`Success!`)
                    .setDescription(
                      `${channelMention(channel.id)} configuration updated`,
                    )
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
  .addSubcommandHandler(handleSet)
  .addSubcommandHandler(handleUnset)
  .build();
