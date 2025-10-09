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
  Function,
  HashMap,
  Number,
  Order,
  pipe,
  String,
} from "effect";
import { OnceObserver } from "typhoon-core/signal";
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
          pipe(
            MessageSlotService.getMessageSlotData(message.id),
            Effect.flatMap(OnceObserver.observeOnce),
            Effect.flatMap(Function.identity),
          ),
        ),
        Effect.bind("slotMessage", ({ messageSlotData }) =>
          getSlotMessage(messageSlotData.day),
        ),
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
        Effect.asVoid,
        Effect.withSpan("handleInteractionSlot", {
          captureStackTrace: true,
        }),
      ),
    ),
  )
  .build();
