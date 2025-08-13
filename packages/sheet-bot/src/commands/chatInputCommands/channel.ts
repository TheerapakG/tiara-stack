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
      Effect.bindAll(
        () => ({
          running: InteractionContext.getBoolean("running"),
          name: InteractionContext.getString("name"),
          role: InteractionContext.getRole("role"),
          channel: pipe(
            InteractionContext.channel(),
            Effect.flatMap(Option.fromNullable),
          ),
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
                  ),
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
    .build();
