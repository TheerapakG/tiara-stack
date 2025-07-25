import {
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  EmbedBuilder,
  MessageFlags,
  MessageFlagsBitField,
} from "discord.js";
import { Chunk, Effect, Option, pipe, Ref } from "effect";
import { observeEffectSignalOnce } from "typhoon-core/signal";
import { ChannelConfigService } from "../services/channelConfigService";
import { ScheduleService } from "../services/scheduleService";
import { buttonInteractionHandlerContextBuilder } from "../types";

const getSlotMessage = (day: number, serverId: string) =>
  pipe(
    Effect.Do,
    Effect.bind("daySchedule", () => ScheduleService.listDay(day, serverId)),
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
      Effect.bind("channelConfig", ({ channel }) =>
        observeEffectSignalOnce(ChannelConfigService.getConfig(channel.id)),
      ),
      Effect.bind("day", ({ channelConfig }) =>
        Option.fromNullable(channelConfig[0].day),
      ),
      Effect.bind("slotMessage", ({ day, serverId }) =>
        getSlotMessage(day, serverId),
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
