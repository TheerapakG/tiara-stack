import {
  ApplicationIntegrationType,
  channelMention,
  ChatInputCommandInteraction,
  EmbedBuilder,
  escapeMarkdown,
  InteractionContextType,
  PermissionFlagsBits,
  roleMention,
  SlashCommandBuilder,
  SlashCommandSubcommandBuilder,
} from "discord.js";
import { Effect, Layer, Option, pipe } from "effect";
import {
  GuildConfigService,
  guildServices,
  PermissionService,
} from "../../services";
import {
  chatInputCommandHandlerContextWithSubcommandHandlerBuilder,
  chatInputSubcommandHandlerContextBuilder,
  InteractionContext,
} from "../../types";

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
      InteractionContext.interaction<ChatInputCommandInteraction>(),
      Effect.flatMap((interaction) =>
        pipe(
          Effect.Do,
          PermissionService.tapCheckPermissions(
            PermissionFlagsBits.ManageGuild,
          ),
          Effect.bindAll(
            () => ({
              running: InteractionContext.getBoolean("running"),
              name: InteractionContext.getString("name"),
              role: InteractionContext.getRole("role"),
              channel: Option.fromNullable(interaction.channel),
            }),
            { concurrency: "unbounded" },
          ),
          Effect.let("roleId", ({ role }) =>
            pipe(
              role,
              Option.map((r) => r.id),
            ),
          ),
          Effect.bind("config", ({ name, channel, running, roleId }) =>
            GuildConfigService.setChannelConfig(channel.id, {
              running: Option.getOrElse(running, () => false),
              name: Option.getOrElse(name, () => undefined),
              roleId: Option.getOrElse(roleId, () => undefined),
            }),
          ),
          Effect.bind("response", ({ channel, config }) =>
            InteractionContext.reply({
              embeds: [
                new EmbedBuilder()
                  .setTitle(`Success!`)
                  .setDescription(
                    `${channelMention(channel.id)} configuration updated`,
                  )
                  .addFields(
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
                      value: config.roleId
                        ? roleMention(config.roleId)
                        : "None!",
                    },
                  )
                  .setTimestamp()
                  .setFooter({
                    text: `${interaction.client.user.username} ${process.env.BUILD_VERSION}`,
                  }),
              ],
            }),
          ),
          Effect.provide(
            pipe(
              interaction.guildId,
              Option.fromNullable,
              Effect.map(guildServices),
              Layer.unwrapEffect,
            ),
          ),
        ),
      ),
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
    .build();
