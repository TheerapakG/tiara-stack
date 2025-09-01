import {
  ChannelConfigService,
  ClientService,
  FormatService,
  guildSheetServicesFromInteraction,
  InteractionContext,
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
  Option,
  Order,
  pipe,
  String,
} from "effect";
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
          String.Equivalence(description, String.empty)
            ? "All Filled :3"
            : description,
        ),
      ),
    })),
    Effect.map(({ title, description }) => ({ title, description })),
  );

export const button = handlerVariantContextBuilder<ButtonHandlerVariantT>()
  .data({
    type: ComponentType.Button,
    customId: "interaction:slot",
    label: "Open slots",
    style: ButtonStyle.Primary,
  })
  .handler(
    Effect.provide(guildSheetServicesFromInteraction())(
      pipe(
        Effect.Do,
        InteractionContext.deferReply.tap(() => ({
          flags: MessageFlags.Ephemeral,
        })),
        InteractionContext.channel(true).bind("channel"),
        Effect.bind("channelConfig", ({ channel }) =>
          pipe(
            ChannelConfigService.getConfig(channel.id),
            Effect.flatMap(observeOnce),
          ),
        ),
        Effect.bind("day", ({ channelConfig }) =>
          pipe(
            channelConfig,
            Option.flatMap(({ day }) => day),
          ),
        ),
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
        Effect.asVoid,
        Effect.withSpan("handleInteractionSlot", {
          captureStackTrace: true,
        }),
      ),
    ),
  )
  .build();
