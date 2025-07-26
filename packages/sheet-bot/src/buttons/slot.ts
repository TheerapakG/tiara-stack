import {
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  EmbedBuilder,
  MessageFlags,
  MessageFlagsBitField,
} from "discord.js";
import { Array, Chunk, Effect, Option, pipe, Ref } from "effect";
import { observeEffectSignalOnce } from "typhoon-core/signal";
import { SheetService } from "../services";
import { ChannelConfigService } from "../services/channelConfigService";
import { ScheduleService } from "../services/scheduleService";
import { buttonInteractionHandlerContextBuilder } from "../types";

const getSlotMessage = (day: number) =>
  pipe(
    Effect.Do,
    Effect.bind("daySchedule", () => ScheduleService.listDay(day)),
    Effect.bind("slotMessages", ({ daySchedule: { start, schedules } }) =>
      Effect.forEach(schedules, (schedule) =>
        ScheduleService.formatEmptySlots(start, schedule),
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
        observeEffectSignalOnce(ChannelConfigService.getConfig(channel.id)),
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
