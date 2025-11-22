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
  Either,
  Number,
  Order,
  Option,
  pipe,
  String,
} from "effect";
import { Schema } from "sheet-apis";
import { Result } from "typhoon-core/schema";
import { Computed, UntilObserver } from "typhoon-core/signal";

const getSlotMessage = (day: number) =>
  pipe(
    Effect.Do,
    bindObject({
      daySchedule: pipe(
        SheetService.daySchedules(day),
        Effect.map(
          Array.map((s) =>
            pipe(
              s.hour,
              Option.map(() => s),
            ),
          ),
        ),
        Effect.map(Array.getSomes),
      ),
    }),
    Effect.bindAll(({ daySchedule }) => ({
      openSlots: pipe(
        daySchedule,
        Array.sortBy(
          Order.mapInput(Option.getOrder(Number.Order), ({ hour }) => hour),
        ),
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
        Array.sortBy(
          Order.mapInput(Option.getOrder(Number.Order), ({ hour }) => hour),
        ),
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
        Effect.bind(
          "messageSlotData",
          ({ message }) =>
            pipe(
              MessageSlotService.getMessageSlotData(message.id),
              Effect.flatMap((signal) =>
                pipe(
                  Effect.succeed(signal),
                  Computed.map(
                    Result.fromRpcReturningResult<
                      Either.Either<
                        Schema.MessageSlot,
                        Schema.Error.Core.ArgumentError
                      >
                    >(
                      Either.left(
                        Schema.Error.Core.makeArgumentError(
                          "Loading message slot",
                        ),
                      ),
                    ),
                  ),
                  UntilObserver.observeUntilScoped(Result.isComplete),
                  Effect.map((result) => result.value),
                  Effect.flatMap(
                    Either.match({
                      onLeft: Effect.die,
                      onRight: Effect.succeed,
                    }),
                  ),
                ),
              ),
            ) as unknown as Effect.Effect<Schema.MessageSlot>,
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
