import { type } from "arktype";
import {
  ActionRowBuilder,
  ApplicationIntegrationType,
  ButtonBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  InteractionContextType,
  MessageActionRowComponentBuilder,
  MessageFlags,
  MessageFlagsBitField,
  SlashCommandBuilder,
  SlashCommandSubcommandBuilder,
} from "discord.js";
import {
  Array,
  Chunk,
  Effect,
  HashMap,
  Option,
  Order,
  pipe,
  Ref,
} from "effect";
import { validate } from "typhoon-core/schema";
import { observeOnce } from "typhoon-server/signal";
import { button as slotButton } from "../../buttons/slot";
import {
  ChannelConfigService,
  GuildConfigService,
  PermissionService,
  ScheduleService,
} from "../../services";
import { SheetService } from "../../services/sheetService";
import {
  chatInputCommandHandlerContextWithSubcommandHandlerBuilder,
  chatInputSubcommandHandlerContextBuilder,
  InteractionContext,
} from "../../types";

const getSlotMessage = (day: number) =>
  pipe(
    Effect.Do,
    Effect.bind("daySchedule", () => SheetService.getDaySchedules(day)),
    Effect.bind("slotMessages", ({ daySchedule: { start, schedules } }) =>
      pipe(
        schedules,
        HashMap.values,
        Array.sortBy(Order.mapInput(Order.number, ({ hour }) => hour)),
        Effect.forEach((schedule) =>
          ScheduleService.formatEmptySlots(start, schedule),
        ),
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
  .handler(
    pipe(
      Effect.Do,
      Effect.bind("interaction", () =>
        InteractionContext.interaction<ChatInputCommandInteraction>(),
      ),
      Effect.bindAll(({ interaction }) => ({
        messageFlags: Ref.make(new MessageFlagsBitField()),
        day: Effect.try(() => interaction.options.getNumber("day", true)),
        serverId: pipe(
          Effect.try(
            () =>
              interaction.options.getString("server_id") ?? interaction.guildId,
          ),
          Effect.flatMap(Option.fromNullable),
        ),
        messageType: pipe(
          Effect.try(
            () => interaction.options.getString("message_type") ?? "ephemeral",
          ),
          Effect.flatMap(validate(type.enumerated("persistent", "ephemeral"))),
        ),
        user: Effect.succeed(interaction.user),
      })),
      Effect.tap(({ serverId, interaction }) =>
        serverId !== interaction.guildId
          ? PermissionService.checkOwner(interaction)
          : Effect.void,
      ),
      Effect.bind("managerRoles", ({ serverId }) =>
        serverId
          ? pipe(
              GuildConfigService.getManagerRoles(serverId),
              Effect.flatMap((computed) => observeOnce(computed.value)),
            )
          : Effect.succeed([]),
      ),
      Effect.tap(({ messageType, managerRoles, interaction }) =>
        messageType !== "ephemeral"
          ? PermissionService.checkRoles(
              interaction,
              managerRoles.map((role) => role.roleId),
              "You can only make persistent messages as a manager",
            )
          : Effect.void,
      ),
      Effect.tap(({ messageType, messageFlags }) =>
        messageType === "ephemeral"
          ? Ref.update(messageFlags, (flags) =>
              flags.add(MessageFlags.Ephemeral),
            )
          : Effect.void,
      ),
      Effect.bind("sheetService", ({ serverId }) =>
        SheetService.ofGuild(serverId),
      ),
      Effect.bind("slotMessage", ({ day, sheetService }) =>
        pipe(getSlotMessage(day), Effect.provide(sheetService)),
      ),
      Effect.bind("flags", ({ messageFlags }) => Ref.get(messageFlags)),
      Effect.bind("response", ({ day, slotMessage, flags, interaction }) =>
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
  .handler(
    pipe(
      Effect.Do,
      Effect.bind("interaction", () =>
        InteractionContext.interaction<ChatInputCommandInteraction>(),
      ),
      Effect.bindAll(({ interaction }) => ({
        day: Effect.try(() => interaction.options.getNumber("day", true)),
        serverId: pipe(
          Effect.try(
            () =>
              interaction.options.getString("server_id") ?? interaction.guildId,
          ),
          Effect.flatMap(Option.fromNullable),
        ),
        channel: Option.fromNullable(interaction.channel),
        user: Effect.succeed(interaction.user),
      })),
      Effect.tap(({ serverId, interaction }) =>
        serverId !== interaction.guildId
          ? PermissionService.checkOwner(interaction)
          : Effect.void,
      ),
      Effect.bind("managerRoles", ({ serverId }) =>
        serverId
          ? pipe(
              GuildConfigService.getManagerRoles(serverId),
              Effect.flatMap((computed) => observeOnce(computed.value)),
            )
          : Effect.succeed([]),
      ),
      Effect.tap(({ managerRoles, interaction }) =>
        PermissionService.checkRoles(
          interaction,
          managerRoles.map((role) => role.roleId),
          "You can only make buttons as a manager",
        ),
      ),
      Effect.tap(({ channel, day }) =>
        ChannelConfigService.updateConfig(channel.id, {
          day,
        }),
      ),
      Effect.bind("response", ({ day, interaction }) =>
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
