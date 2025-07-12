import {
  ApplicationIntegrationType,
  EmbedBuilder,
  InteractionContextType,
  PermissionFlagsBits,
  SlashCommandBuilder,
  SlashCommandSubcommandBuilder,
  SlashCommandSubcommandGroupBuilder,
  escapeMarkdown,
} from "discord.js";
import { Effect, Option, pipe } from "effect";
import { observeOnce } from "typhoon-core/signal";
import { GuildConfigService } from "../../services/guildConfigService";
import {
  SubcommandHandler,
  chatInputCommandHandlerContextBuilder,
  chatInputSubcommandGroupHandlerContextBuilder,
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
      Effect.bind("guildConfigsSubscription", ({ guild }) =>
        GuildConfigService.getConfig(guild.id),
      ),
      Effect.bind("guildConfigObserver", ({ guildConfigsSubscription }) =>
        observeOnce(guildConfigsSubscription.value),
      ),
      Effect.bind(
        "guildConfig",
        ({ guildConfigObserver }) => guildConfigObserver.value,
      ),
      Effect.bind("sheetId", ({ guildConfig }) =>
        Option.fromNullable(guildConfig[0].sheetId),
      ),
      Effect.bind("response", ({ guild, sheetId }) =>
        Effect.tryPromise(() =>
          interaction.reply({
            embeds: [
              new EmbedBuilder()
                .setTitle(`Config for ${escapeMarkdown(guild.name)}`)
                .setDescription(`Sheet id: ${escapeMarkdown(sheetId)}`),
            ],
          }),
        ),
      ),
    ),
  )
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

const handleSetConfig = chatInputSubcommandGroupHandlerContextBuilder()
  .data(
    new SlashCommandSubcommandGroupBuilder()
      .setName("set_config")
      .setDescription("Set config for the server")
      .addSubcommand(handleSetSheet.data),
  )
  .handler(
    pipe(
      SubcommandHandler.empty(),
      SubcommandHandler.addSubcommandHandler(handleSetSheet),
      SubcommandHandler.handler,
    ),
  )
  .build();

export const command = chatInputCommandHandlerContextBuilder()
  .data(
    new SlashCommandBuilder()
      .setName("server")
      .setDescription("Server commands")
      .addSubcommand(handleListConfig.data)
      .addSubcommandGroup(handleSetConfig.data)
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
  .handler(
    pipe(
      SubcommandHandler.empty(),
      SubcommandHandler.addSubcommandGroupHandler(handleSetConfig),
      SubcommandHandler.addSubcommandHandler(handleListConfig),
      SubcommandHandler.handler,
    ),
  )
  .build();
