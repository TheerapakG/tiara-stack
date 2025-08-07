import {
  ApplicationIntegrationType,
  channelMention,
  ChatInputCommandInteraction,
  EmbedBuilder,
  escapeMarkdown,
  InteractionContextType,
  PermissionFlagsBits,
  SlashCommandBuilder,
  SlashCommandSubcommandBuilder,
} from "discord.js";
import { Effect, Option, pipe } from "effect";
import { GuildConfigService } from "../../services";
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
      ),
  )
  .handler(
    pipe(
      Effect.Do,
      Effect.bind("interaction", () =>
        InteractionContext.interaction<ChatInputCommandInteraction>(),
      ),
      Effect.bindAll(({ interaction }) => ({
        running: pipe(
          Effect.try(() => interaction.options.getBoolean("running")),
          Effect.map(Option.fromNullable),
        ),
        name: pipe(
          Effect.try(() => interaction.options.getString("name")),
          Effect.map(Option.fromNullable),
        ),
        channel: Option.fromNullable(interaction.channel),
        guild: Option.fromNullable(interaction.guild),
        memberPermissions: Option.fromNullable(interaction.memberPermissions),
      })),
      Effect.tap(({ memberPermissions }) =>
        !memberPermissions.has(PermissionFlagsBits.ManageGuild)
          ? Effect.fail("You do not have permission to manage the server")
          : Effect.void,
      ),
      Effect.bind("config", ({ guild, name, channel, running }) =>
        GuildConfigService.setChannelConfig(guild.id, channel.id, {
          running: Option.getOrElse(running, () => false),
          name: Option.getOrElse(name, () => undefined),
        }),
      ),
      Effect.bind("response", ({ channel, interaction, config }) =>
        Effect.tryPromise(() =>
          interaction.reply({
            embeds: [
              new EmbedBuilder()
                .setTitle(`Success!`)
                .setDescription(
                  `${channelMention(channel.id)} configuration updated`,
                )
                .addFields(
                  {
                    name: "Running channel",
                    value: config.running ? "Yes" : "No",
                  },
                  {
                    name: "Name",
                    value: escapeMarkdown(config.name ?? "None!"),
                  },
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
