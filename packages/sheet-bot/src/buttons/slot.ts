import { ButtonStyle, ComponentType, MessageFlags } from "discord.js";
import { Array, Chunk, Effect, HashMap, Option, Order, pipe } from "effect";
import { observeOnce } from "typhoon-server/signal";
import {
  ChannelConfigService,
  ClientService,
  guildServicesFromInteraction,
  ScheduleService,
  SheetService,
} from "../services";
import {
  buttonInteractionHandlerContextBuilder,
  InteractionContext,
} from "../types";
import { bindObject } from "../utils";

const getSlotMessage = (day: number) =>
  pipe(
    Effect.Do,
    bindObject({
      eventConfig: SheetService.getEventConfig(),
      daySchedule: SheetService.getDaySchedules(day),
    }),
    Effect.bindAll(({ eventConfig, daySchedule }) => ({
      title: Effect.succeed(`Day ${day} Slots~`),
      description: pipe(
        daySchedule,
        HashMap.values,
        Array.sortBy(Order.mapInput(Order.number, ({ hour }) => hour)),
        Effect.forEach((schedule) =>
          ScheduleService.formatEmptySlots(eventConfig.startTime, schedule),
        ),
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

export const button = buttonInteractionHandlerContextBuilder()
  .data({
    type: ComponentType.Button,
    customId: "interaction:slot",
    label: "Open slots",
    style: ButtonStyle.Primary,
  })
  .handler(
    pipe(
      Effect.Do,
      InteractionContext.tapDeferReply({ flags: MessageFlags.Ephemeral }),
      bindObject({
        channel: pipe(
          InteractionContext.channel(),
          Effect.flatMap(Option.fromNullable),
        ),
      }),
      Effect.bind("channelConfig", ({ channel }) =>
        pipe(
          ChannelConfigService.getConfig(channel.id),
          Effect.flatMap(observeOnce),
        ),
      ),
      Effect.bind("day", ({ channelConfig }) =>
        pipe(
          channelConfig,
          Option.map(({ day }) => day),
          Option.flatMap(Option.fromNullable),
        ),
      ),
      Effect.bind("slotMessage", ({ day }) => getSlotMessage(day)),
      Effect.tap(({ slotMessage }) =>
        pipe(
          ClientService.makeEmbedBuilder(),
          Effect.tap((embed) =>
            InteractionContext.editReply({
              embeds: [
                embed
                  .setTitle(slotMessage.title)
                  .setDescription(slotMessage.description),
              ],
            }),
          ),
        ),
      ),
      Effect.provide(guildServicesFromInteraction()),
      Effect.asVoid,
    ),
  )
  .build();
