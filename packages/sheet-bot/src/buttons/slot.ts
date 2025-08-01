import {
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  EmbedBuilder,
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
import { SheetService } from "../services";
import { ChannelConfigService } from "../services/channelConfigService";
import { ScheduleService } from "../services/scheduleService";
import { buttonInteractionHandlerContextBuilder } from "../types";

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

export const button = buttonInteractionHandlerContextBuilder()
  .data({
    type: ComponentType.Button,
    customId: "interaction:slot",
    label: "Open slots",
    style: ButtonStyle.Primary,
  })
  .handler((interaction) =>
    pipe(
      Effect.Do,
      Effect.bindAll(() => ({
        messageFlags: Ref.make(
          new MessageFlagsBitField().add(MessageFlags.Ephemeral),
        ),
        serverId: Option.fromNullable(interaction.guildId),
        channel: Option.fromNullable(interaction.channel),
      })),
      Effect.bind("sheetService", ({ serverId }) =>
        SheetService.ofGuild(serverId),
      ),
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
      Effect.bind("slotMessage", ({ day, sheetService }) =>
        pipe(getSlotMessage(day), Effect.provide(sheetService)),
      ),
      Effect.bind("flags", ({ messageFlags }) => Ref.get(messageFlags)),
      Effect.let("updateButton", () =>
        new ButtonBuilder()
          .setCustomId("update")
          .setLabel("Update")
          .setStyle(ButtonStyle.Primary),
      ),
      Effect.bind("response", ({ day, slotMessage, flags }) =>
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
    ),
  )
  .build();
