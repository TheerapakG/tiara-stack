import { slotButton } from "@/messageComponents";
import {
  ChannelConfigService,
  ClientService,
  FormatService,
  GuildConfigService,
  guildServicesFromInteractionOption,
  InteractionContext,
  PermissionService,
  SheetService,
} from "@/services";
import {
  chatInputCommandSubcommandHandlerContextBuilder,
  ChatInputSubcommandHandlerVariantT,
  handlerVariantContextBuilder,
} from "@/types";
import { bindObject } from "@/utils";
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

const getSlotMessage = (day: number) =>
  pipe(
    Effect.Do,
    bindObject({
      daySchedule: SheetService.getDaySchedules(day),
    }),
    Effect.bindAll(({ daySchedule }) => ({
      title: Effect.succeed(`Day ${day} Slots~`),
      description: pipe(
        daySchedule,
        HashMap.values,
        Array.sortBy(Order.mapInput(Order.number, ({ hour }) => hour)),
        Effect.forEach((schedule) => FormatService.formatEmptySlots(schedule)),
        Effect.map(Chunk.fromIterable),
        Effect.map(Chunk.dedupeAdjacent),
        Effect.map(Chunk.join("\n")),
        Effect.map((description) =>
          description === "" ? "All Filled :3" : description,
        ),
      ),
    })),
    Effect.map(({ title, description }) => ({ title, description })),
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
      Effect.provide(guildServicesFromInteractionOption("server_id"))(
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
                validate(type.enumerated("persistent", "ephemeral")),
              ),
            ),
          }),
          Effect.tap(({ messageFlags, messageType }) =>
            Ref.update(messageFlags, (flags) =>
              flags.add(
                messageType === "ephemeral" ? MessageFlags.Ephemeral : 0,
              ),
            ),
          ),
          Effect.bind("flags", ({ messageFlags }) => Ref.get(messageFlags)),
          Effect.tap(({ flags }) =>
            pipe(
              PermissionService.checkRoles.effect(
                pipe(
                  GuildConfigService.getManagerRoles(),
                  Effect.flatMap(observeOnce),
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
                    .setDescription(slotMessage.description),
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
      Effect.provide(guildServicesFromInteractionOption("server_id"))(
        pipe(
          Effect.Do,
          InteractionContext.deferReply.tap(),
          PermissionService.checkOwner.tap(() => ({ allowSameGuild: true })),
          PermissionService.checkRoles.tapEffect(() =>
            pipe(
              GuildConfigService.getManagerRoles(),
              Effect.flatMap(observeOnce),
              Effect.map(Array.map((role) => role.roleId)),
              Effect.map((roles) => ({
                roles,
                reason: "You can only make buttons as a manager",
              })),
            ),
          ),
          InteractionContext.channel(true).bind("channel"),
          bindObject({
            day: InteractionContext.getNumber("day", true),
          }),
          Effect.tap(({ channel, day }) =>
            ChannelConfigService.upsertConfig(channel.id, {
              day,
            }),
          ),
          InteractionContext.editReply.tap(({ day }) => ({
            content: `Press the button below to get the current open slots for day ${day}`,
            components: [
              new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
                new ButtonBuilder(slotButton.data),
              ),
            ],
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
