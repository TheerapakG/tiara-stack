import {
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  MessageFlags,
  MessageFlagsBitField,
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
      Effect.bindAll(() => ({
        messageFlags: Ref.make(
          new MessageFlagsBitField().add(MessageFlags.Ephemeral),
        ),
        channel: pipe(
          InteractionContext.channel(),
          Effect.flatMap(Option.fromNullable),
        ),
      })),
      Effect.bind("channelConfig", ({ channel }) =>
        pipe(
          ChannelConfigService.getConfig(channel.id),
          Effect.flatMap((computed) => observeOnce(computed.value)),
        ),
      ),
      Effect.bind("day", ({ channelConfig }) =>
        pipe(
          channelConfig,
          Array.head,
          Option.flatMap(({ day }) => Option.fromNullable(day)),
        ),
      ),
      Effect.bind("slotMessage", ({ day }) => getSlotMessage(day)),
      Effect.bind("flags", ({ messageFlags }) => Ref.get(messageFlags)),
      Effect.let("updateButton", () =>
        new ButtonBuilder()
          .setCustomId("update")
          .setLabel("Update")
          .setStyle(ButtonStyle.Primary),
      ),
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
      Effect.provide(guildServicesFromInteraction()),
      Effect.asVoid,
    ),
  )
  .build();
