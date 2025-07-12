import { type } from "arktype";
import {
  ActionRowBuilder,
  ApplicationIntegrationType,
  ButtonBuilder,
  EmbedBuilder,
  InteractionContextType,
  MessageActionRowComponentBuilder,
  MessageFlags,
  MessageFlagsBitField,
  PermissionFlagsBits,
  SlashCommandBuilder,
  SlashCommandSubcommandBuilder,
} from "discord.js";
import { Chunk, Effect, Option, pipe, Ref } from "effect";
import { validate } from "typhoon-core/schema";
import { button as slotButton } from "../../buttons/slot";
import { ChannelConfigService } from "../../services/channelConfigService";
import { ScheduleService } from "../../services/scheduleService";
import {
  chatInputCommandHandlerContextWithSubcommandHandlerBuilder,
  chatInputSubcommandHandlerContextBuilder,
} from "../../types";

const getSlotMessage = (day: number, serverId: string) =>
  pipe(
    Effect.Do,
    Effect.bind("daySchedule", () => ScheduleService.list(day, serverId)),
    Effect.bind("slotMessages", ({ daySchedule: { start, schedules } }) =>
      Effect.forEach(schedules, (schedule) =>
        ScheduleService.formatEmptySlots(start, schedule),
      ),
    ),
    Effect.let("slotMessage", ({ slotMessages }) =>
      pipe(
        Chunk.fromIterable(slotMessages),
        Chunk.dedupeAdjacent,
        Chunk.join("\n"),
      ),
    ),
    Effect.map(({ slotMessage }) => slotMessage),
  );

const handleList = chatInputSubcommandHandlerContextBuilder()
  .data(
    new SlashCommandSubcommandBuilder()
      .setName("list")
      .setDescription("Get the open slots for the day")
      .addNumberOption((option) =>
        option
          .setName("day")
          .setDescription("The day to get the slots for")
          .setRequired(true),
      )
      .addStringOption((option) =>
        option
          .setName("server_id")
          .setDescription("The server to get the teams for"),
      )
      .addStringOption((option) =>
        option
          .setName("message_type")
          .setDescription("The type of message to send")
          .addChoices(
            { name: "persistent", value: "persistent" },
            { name: "ephemeral", value: "ephemeral" },
          ),
      ),
  )
  .handler((interaction) =>
    pipe(
      Effect.Do,
      Effect.bindAll(() => ({
        messageFlags: Ref.make(new MessageFlagsBitField()),
        day: Effect.try(() => interaction.options.getNumber("day", true)),
        serverIdOption: Effect.try(() =>
          interaction.options.getString("server_id"),
        ),
        messageTypeOption: Effect.try(() =>
          interaction.options.getString("message_type"),
        ),
        channel: Effect.succeed(interaction.channel),
        user: Option.fromNullable(interaction.user),
      })),
      Effect.tap(({ messageTypeOption, channel, user }) =>
        channel &&
        !channel.isDMBased() &&
        !channel
          .permissionsFor(user)
          ?.has(PermissionFlagsBits.ManageMessages) &&
        messageTypeOption !== undefined
          ? Effect.fail(
              "You can only request non-ephemeral messages in a channel with the Manage Messages permission",
            )
          : Effect.void,
      ),
      Effect.bindAll(({ serverIdOption, messageTypeOption }) => ({
        serverId: pipe(
          serverIdOption ?? interaction.guildId,
          Option.fromNullable,
        ),
        messageType: pipe(
          validate(type.enumerated("persistent", "ephemeral"))(
            messageTypeOption,
          ),
          Effect.catchTag("ValidationError", () =>
            Effect.succeed("ephemeral" as const),
          ),
        ),
      })),
      Effect.tap(({ messageType, messageFlags }) =>
        messageType === "ephemeral"
          ? Ref.update(messageFlags, (flags) =>
              flags.add(MessageFlags.Ephemeral),
            )
          : Effect.void,
      ),
      Effect.bind("slotMessage", ({ day, serverId }) =>
        getSlotMessage(day, serverId),
      ),
      Effect.bind("flags", ({ messageFlags }) => Ref.get(messageFlags)),
      Effect.bind("response", ({ day, slotMessage, flags }) =>
        Effect.tryPromise(() =>
          interaction.reply({
            embeds: [
              new EmbedBuilder()
                .setTitle(`Day ${day} Slots~`)
                .setDescription(
                  slotMessage === "" ? "All Filled :3" : slotMessage,
                )
                .setTimestamp()
                .setFooter({
                  text: `${interaction.client.user.username} ${process.env.BUILD_VERSION}`,
                }),
            ],
            flags: flags.bitfield,
          }),
        ),
      ),
      Effect.asVoid,
    ),
  )
  .build();

const handleButton = chatInputSubcommandHandlerContextBuilder()
  .data(
    new SlashCommandSubcommandBuilder()
      .setName("button")
      .setDescription("show the button to get the open slots")
      .addNumberOption((option) =>
        option
          .setName("day")
          .setDescription("The day to get the slots for")
          .setRequired(true),
      ),
  )
  .handler((interaction) =>
    pipe(
      Effect.Do,
      Effect.bindAll(() => ({
        day: Effect.try(() => interaction.options.getNumber("day", true)),
        serverIdOption: Effect.try(() =>
          interaction.options.getString("server_id"),
        ),
        channel: Option.fromNullable(interaction.channel),
        user: Option.fromNullable(interaction.user),
      })),
      Effect.tap(({ channel, user }) =>
        !channel.isDMBased() &&
        !channel.permissionsFor(user)?.has(PermissionFlagsBits.ManageMessages)
          ? Effect.fail(
              "You do not have permission to manage messages in this channel",
            )
          : Effect.void,
      ),
      Effect.tap(({ channel, day }) =>
        ChannelConfigService.updateConfig(channel.id, {
          day,
        }),
      ),
      Effect.bind("response", ({ day }) =>
        Effect.tryPromise(() =>
          interaction.reply({
            content: `Press the button below to get the current open slots for day ${day}`,
            components: [
              new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
                new ButtonBuilder(slotButton.data),
              ),
            ],
          }),
        ),
      ),
      Effect.asVoid,
    ),
  )
  .build();

export const command =
  chatInputCommandHandlerContextWithSubcommandHandlerBuilder()
    .data(
      new SlashCommandBuilder()
        .setName("slot")
        .setDescription("Day slots commands")
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
    .addSubcommandHandler(handleList)
    .addSubcommandHandler(handleButton)
    .build();
