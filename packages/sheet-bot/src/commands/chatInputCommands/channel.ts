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
import {
  ChannelConfig,
  ClientService,
  GuildConfigService,
  guildServicesFromInteractionOption,
  PermissionService,
} from "../../services";
import {
  chatInputCommandHandlerContextWithSubcommandHandlerBuilder,
  chatInputSubcommandHandlerContextBuilder,
  InteractionContext,
} from "../../types";
import { bindObject } from "../../utils";

const configFields = (config: ChannelConfig) => [
  {
    name: "Name",
    value: escapeMarkdown(config.name ?? "None!"),
  },
  {
    name: "Running channel",
    value: config.running ? "Yes" : "No",
  },
  {
    name: "Role",
    value: config.roleId ? roleMention(config.roleId) : "None!",
  },
];

const handleSet = chatInputSubcommandHandlerContextBuilder()
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
      ),
  )
  .handler(
    pipe(
      Effect.Do,
      PermissionService.tapCheckPermissions(PermissionFlagsBits.ManageGuild),
      bindObject({
        channel: InteractionContext.channel(true),
        running: InteractionContext.getBoolean("running"),
        name: InteractionContext.getString("name"),
        role: InteractionContext.getRole("role"),
      }),
      Effect.bind("config", ({ channel, running, name, role }) =>
        GuildConfigService.setChannelConfig(channel.id, {
          running: Option.getOrUndefined(running),
          name: Option.getOrUndefined(name),
          roleId: pipe(
            role,
            Option.map((r) => r.id),
            Option.getOrUndefined,
          ),
        }),
      ),
      Effect.tap(({ channel, config }) =>
        pipe(
          ClientService.makeEmbedBuilder(),
          Effect.tap((embed) =>
            InteractionContext.reply({
              embeds: [
                embed
                  .setTitle(`Success!`)
                  .setDescription(
                    `${channelMention(channel.id)} configuration updated`,
                  )
                  .addFields(...configFields(config)),
              ],
            }),
          ),
        ),
      ),
      Effect.provide(guildServicesFromInteractionOption("server_id")),
      Effect.withSpan("handlesSetRunning", {
        captureStackTrace: true,
      }),
    ),
  )
  .build();

const handleUnset = chatInputSubcommandHandlerContextBuilder()
  .data(
    new SlashCommandSubcommandBuilder()
      .setName("unset")
      .setDescription("Unset the config for the channel")
      .addBooleanOption((option) =>
        option.setName("name").setDescription("Unset the name of the channel"),
      )
      .addBooleanOption((option) =>
        option.setName("role").setDescription("Unset the role of the channel"),
      ),
  )
  .handler(
    pipe(
      Effect.Do,
      PermissionService.tapCheckPermissions(PermissionFlagsBits.ManageGuild),
      bindObject({
        channel: InteractionContext.channel(true),
        name: InteractionContext.getBoolean("name"),
        role: InteractionContext.getBoolean("role"),
      }),
      Effect.bind("config", ({ channel, name, role }) =>
        GuildConfigService.setChannelConfig(channel.id, {
          name: Option.getOrUndefined(name) ? null : undefined,
          roleId: Option.getOrUndefined(role) ? null : undefined,
        }),
      ),
      Effect.tap(({ channel, config }) =>
        pipe(
          ClientService.makeEmbedBuilder(),
          Effect.tap((embed) =>
            InteractionContext.reply({
              embeds: [
                embed
                  .setTitle(`Success!`)
                  .setDescription(
                    `${channelMention(channel.id)} configuration updated`,
                  )
                  .addFields(...configFields(config)),
              ],
            }),
          ),
        ),
      ),
      Effect.provide(guildServicesFromInteractionOption("server_id")),
      Effect.withSpan("handlesSetRunning", {
        captureStackTrace: true,
      }),
    ),
  )
  .build();

export const command =
  chatInputCommandHandlerContextWithSubcommandHandlerBuilder()
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
