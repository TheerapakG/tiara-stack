import {
  ButtonInteractionT,
  CachedInteractionContext,
  ClientService,
  FormatService,
  guildServicesFromInteraction,
  InteractionContext,
  MessageSlotService,
  SheetService,
} from "@/services";
import { ButtonHandlerVariantT, handlerVariantContextBuilder } from "@/types";
import { bindObject } from "@/utils";
import { ButtonStyle, ComponentType, MessageFlags } from "discord.js";
import {
  Array,
  Chunk,
  Effect,
  HashMap,
  Number,
  Order,
  pipe,
  String,
} from "effect";
import { Schema } from "sheet-apis";

const getSlotMessage = (day: number) =>
  pipe(
    Effect.Do,
    bindObject({
      daySchedule: pipe(
        SheetService.daySchedules(day),
        Effect.map(
          HashMap.reduce(HashMap.empty<number, Schema.Schedule>(), (acc, a) =>
            HashMap.union(acc, a),
          ),
        ),
      ),
    }),
    Effect.bindAll(({ daySchedule }) => ({
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
    Effect.map(({ openSlots, filledSlots }) => ({
      open: {
        title: `Day ${day} Open Slots~`,
        description: openSlots,
      },
      filled: {
        title: `Day ${day} Filled Slots~`,
        description: filledSlots,
      },
    })),
  );

export const button = handlerVariantContextBuilder<ButtonHandlerVariantT>()
  .data({
    type: ComponentType.Button,
    customId: "interaction:slot",
    label: "Open slots",
    style: ButtonStyle.Primary,
  })
  .handler(
    Effect.provide(guildServicesFromInteraction())(
      pipe(
        Effect.Do,
        InteractionContext.deferReply.tap(() => ({
          flags: MessageFlags.Ephemeral,
        })),
        CachedInteractionContext.message<ButtonInteractionT>().bind("message"),
        Effect.bind("messageSlotData", ({ message }) =>
          MessageSlotService.getMessageSlotData(message.id),
        ),
        Effect.bind("slotMessage", ({ messageSlotData }) =>
          getSlotMessage(messageSlotData.day),
        ),
        InteractionContext.editReply.tapEffect(({ slotMessage }) =>
          pipe(
            Effect.all({
              openEmbed: ClientService.makeEmbedBuilder(),
              filledEmbed: ClientService.makeEmbedBuilder(),
            }),
            Effect.map(({ openEmbed, filledEmbed }) => ({
              embeds: [
                openEmbed
                  .setTitle(slotMessage.open.title)
                  .setDescription(slotMessage.open.description),
                filledEmbed
                  .setTitle(slotMessage.filled.title)
                  .setDescription(slotMessage.filled.description),
              ],
            })),
          ),
        ),
        Effect.asVoid,
        Effect.withSpan("handleInteractionSlot", {
          captureStackTrace: true,
        }),
      ),
    ),
  )
  .build();
