import { slotButton } from "@/messageComponents";
import {
  channelServicesFromInteraction,
  ClientService,
  FormatService,
  GuildConfigService,
  guildSheetServicesFromInteractionOption,
  InteractionContext,
  MessageSlotService,
  PermissionService,
  SendableChannelContext,
  SheetService,
} from "@/services";
import {
  chatInputCommandSubcommandHandlerContextBuilder,
  ChatInputSubcommandHandlerVariantT,
  handlerVariantContextBuilder,
} from "@/types";
import { bindObject } from "@/utils";
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
  Layer,
  Number,
  Option,
  Order,
  pipe,
  Ref,
  Schema,
  String,
} from "effect";
import { Validate } from "typhoon-core/validator";

const getSlotMessage = (day: number) =>
  pipe(
    Effect.Do,
    bindObject({
      daySchedule: SheetService.getDaySchedules(day),
    }),
    Effect.bindAll(({ daySchedule }) => ({
      title: Effect.succeed(`Day ${day} Slots~`),
      openSlots: pipe(
        daySchedule,
        HashMap.values,
        Array.sortBy(Order.mapInput(Number.Order, ({ hour }) => hour)),
        Effect.forEach((schedule) => FormatService.formatOpenSlot(schedule)),
        Effect.map(Chunk.fromIterable),
        Effect.map(Chunk.dedupeAdjacent),
        Effect.map(Chunk.join("\n")),
        Effect.map((description) =>
          String.Equivalence(description, String.empty)
            ? "All Filled :3"
            : description,
        ),
      ),
      filledSlots: pipe(
        daySchedule,
        HashMap.values,
        Array.sortBy(Order.mapInput(Number.Order, ({ hour }) => hour)),
        Effect.forEach((schedule) => FormatService.formatFilledSlot(schedule)),
        Effect.map(Chunk.fromIterable),
        Effect.map(Chunk.dedupeAdjacent),
        Effect.map(Chunk.join("\n")),
        Effect.map((description) =>
          String.Equivalence(description, String.empty)
            ? "All Open :3"
            : description,
        ),
      ),
    })),
    Effect.map(({ title, openSlots, filledSlots }) => ({
      title,
      fields: [
        { name: "Open Slots", value: openSlots },
        { name: "Filled Slots", value: filledSlots },
      ],
    })),
  );

const handleList =
  handlerVariantContextBuilder<ChatInputSubcommandHandlerVariantT>()
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
      Effect.provide(guildSheetServicesFromInteractionOption("server_id"))(
        pipe(
          Effect.Do,
          PermissionService.checkOwner.tap(() => ({ allowSameGuild: true })),
          bindObject({
            messageFlags: Ref.make(new MessageFlagsBitField()),
            day: InteractionContext.getNumber("day", true),
            messageType: pipe(
              InteractionContext.getString("message_type"),
              Effect.map(Option.getOrElse(() => "ephemeral")),
              Effect.flatMap(
                Validate.validate(
                  pipe(
                    Schema.Literal("persistent", "ephemeral"),
                    Schema.standardSchemaV1,
                  ),
                ),
              ),
            ),
          }),
          Effect.tap(({ messageFlags, messageType }) =>
            pipe(
              Ref.update(messageFlags, (flags) =>
                flags.add(MessageFlags.Ephemeral),
              ),
              Effect.when(() => String.Equivalence(messageType, "ephemeral")),
            ),
          ),
          Effect.bind("flags", ({ messageFlags }) => Ref.get(messageFlags)),
          Effect.tap(({ flags }) =>
            pipe(
              PermissionService.checkRoles.effect(
                pipe(
                  GuildConfigService.getGuildManagerRoles(),
                  Effect.map(Array.map((role) => role.roleId)),
                  Effect.map((roles) => ({
                    roles,
                    reason:
                      "You can only make persistent messages as a manager",
                  })),
                ),
              ),
              Effect.unless(() => flags.has(MessageFlags.Ephemeral)),
            ),
          ),
          InteractionContext.deferReply.tap(({ flags }) => ({
            flags: flags.bitfield,
          })),
          Effect.bind("slotMessage", ({ day }) => getSlotMessage(day)),
          InteractionContext.editReply.tapEffect(({ slotMessage }) =>
            pipe(
              ClientService.makeEmbedBuilder(),
              Effect.map((embed) => ({
                embeds: [
                  embed
                    .setTitle(slotMessage.title)
                    .setFields(...slotMessage.fields),
                ],
              })),
            ),
          ),
          Effect.withSpan("handleSlotList", { captureStackTrace: true }),
        ),
      ),
    )
    .build();

const handleButton =
  handlerVariantContextBuilder<ChatInputSubcommandHandlerVariantT>()
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
      Effect.provide(
        Layer.mergeAll(
          guildSheetServicesFromInteractionOption("server_id"),
          channelServicesFromInteraction(),
        ),
      )(
        pipe(
          Effect.Do,
          InteractionContext.deferReply.tap(() => ({
            flags: MessageFlags.Ephemeral,
          })),
          PermissionService.checkOwner.tap(() => ({ allowSameGuild: true })),
          PermissionService.checkRoles.tapEffect(() =>
            pipe(
              GuildConfigService.getGuildManagerRoles(),
              Effect.map(Array.map((role) => role.roleId)),
              Effect.map((roles) => ({
                roles,
                reason: "You can only make buttons as a manager",
              })),
            ),
          ),
          bindObject({
            day: InteractionContext.getNumber("day", true),
          }),
          SendableChannelContext.send().bind("message", ({ day }) => ({
            content: `Press the button below to get the current open slots for day ${day}`,
            components: [
              new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
                new ButtonBuilder(slotButton.data),
              ),
            ],
          })),
          Effect.tap(({ message, day }) =>
            MessageSlotService.upsertMessageSlotData(message.id, {
              day,
            }),
          ),
          InteractionContext.editReply.tap(() => ({
            content: "Slot button sent!",
          })),
          Effect.withSpan("handleSlotButton", { captureStackTrace: true }),
        ),
      ),
    )
    .build();

export const command = chatInputCommandSubcommandHandlerContextBuilder()
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
