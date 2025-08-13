import { type } from "arktype";
import {
  ActionRowBuilder,
  ApplicationIntegrationType,
  ButtonBuilder,
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
import { slotButton } from "../../buttons";
import {
  ChannelConfigService,
  ClientService,
  GuildConfigService,
  guildServicesFromInteractionOption,
  PermissionService,
  ScheduleService,
} from "../../services";
import { SheetService } from "../../services/guild/sheetService";
import {
  chatInputCommandHandlerContextWithSubcommandHandlerBuilder,
  chatInputSubcommandHandlerContextBuilder,
  InteractionContext,
} from "../../types";

const getSlotMessage = (day: number) =>
  pipe(
    Effect.Do,
    Effect.bindAll(
      () => ({
        eventConfig: SheetService.getEventConfig(),
        daySchedule: SheetService.getDaySchedules(day),
      }),
      { concurrency: "unbounded" },
    ),
    Effect.bind("slotMessages", ({ eventConfig, daySchedule }) =>
      pipe(
        daySchedule,
        HashMap.values,
        Array.sortBy(Order.mapInput(Order.number, ({ hour }) => hour)),
        Effect.forEach((schedule) =>
          ScheduleService.formatEmptySlots(eventConfig.startTime, schedule),
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
      PermissionService.tapCheckOwner({ allowSameGuild: true }),
      Effect.bindAll(() => ({
        messageFlags: Ref.make(new MessageFlagsBitField()),
        day: InteractionContext.getNumber("day", true),
        messageType: pipe(
          InteractionContext.getString("message_type"),
          Effect.map(Option.getOrElse(() => "ephemeral")),
          Effect.flatMap(validate(type.enumerated("persistent", "ephemeral"))),
        ),
        user: InteractionContext.user(),
      })),
      Effect.bind("managerRoles", () =>
        pipe(
          GuildConfigService.getManagerRoles(),
          Effect.flatMap((computed) => observeOnce(computed.value)),
        ),
      ),
      Effect.tap(({ messageType, managerRoles }) =>
        messageType !== "ephemeral"
          ? PermissionService.checkRoles(
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
      Effect.bind("slotMessage", ({ day }) => getSlotMessage(day)),
      Effect.bind("flags", ({ messageFlags }) => Ref.get(messageFlags)),
      Effect.bind("response", ({ day, slotMessage, flags }) =>
        pipe(
          ClientService.makeEmbedBuilder(),
          Effect.tap((embed) =>
            InteractionContext.reply({
              embeds: [
                embed
                  .setTitle(`Day ${day} Slots~`)
                  .setDescription(
                    slotMessage === "" ? "All Filled :3" : slotMessage,
                  ),
              ],
              flags: flags.bitfield,
            }),
          ),
        ),
      ),
      Effect.provide(guildServicesFromInteractionOption("server_id")),
      Effect.withSpan("handleSlotList", { captureStackTrace: true }),
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
      PermissionService.tapCheckOwner({ allowSameGuild: true }),
      PermissionService.tapCheckRoles(
        pipe(
          GuildConfigService.getManagerRoles(),
          Effect.flatMap((computed) => observeOnce(computed.value)),
          Effect.map((managerRoles) => managerRoles.map((role) => role.roleId)),
        ),
        "You can only make buttons as a manager",
      ),
      Effect.bindAll(
        () => ({
          day: InteractionContext.getNumber("day", true),
          channel: pipe(
            InteractionContext.channel(),
            Effect.flatMap(Option.fromNullable),
          ),
          user: InteractionContext.user(),
        }),
        { concurrency: "unbounded" },
      ),
      Effect.tap(({ channel, day }) =>
        ChannelConfigService.updateConfig(channel.id, {
          day,
        }),
      ),
      Effect.bind("response", ({ day }) =>
        InteractionContext.reply({
          content: `Press the button below to get the current open slots for day ${day}`,
          components: [
            new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
              new ButtonBuilder(slotButton.data),
            ),
          ],
        }),
      ),
      Effect.provide(guildServicesFromInteractionOption("server_id")),
      Effect.withSpan("handleSlotButton", { captureStackTrace: true }),
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
