import { match, type } from "arktype";
import {
  ActionRowBuilder,
  ApplicationIntegrationType,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  InteractionContextType,
  MessageActionRowComponentBuilder,
  MessageFlags,
  MessageFlagsBitField,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import { eq } from "drizzle-orm";
import { Array, Chunk, Effect, Option, pipe, Ref } from "effect";
import { configGuild } from "sheet-db-schema";
import { validate } from "typhoon-core/schema";
import {
  DBSubscriptionContext,
  query,
  run,
  subscribe,
} from "typhoon-server/db";
import { observeOnce } from "typhoon-server/signal";
import { DB } from "../db";
import { GoogleSheets } from "../google";
import { defineCommand } from "../types";

const getSlotMessage = (day: number, serverId: string) =>
  DB.use((db) =>
    pipe(
      Effect.Do,
      Effect.bind("guildConfigsSubscription", () =>
        pipe(
          DBSubscriptionContext,
          Effect.flatMap((ctx) =>
            pipe(
              subscribe(
                run(
                  query(
                    db
                      .select()
                      .from(configGuild)
                      .where(eq(configGuild.guildId, serverId)),
                  ),
                ),
              ),
              Effect.provideService(DBSubscriptionContext, ctx),
            ),
          ),
        ),
      ),
      Effect.bind("guildConfigObserver", ({ guildConfigsSubscription }) =>
        observeOnce(guildConfigsSubscription.value),
      ),
      Effect.bind(
        "guildConfig",
        ({ guildConfigObserver }) => guildConfigObserver.value,
      ),
      Effect.bind("sheet", ({ guildConfig }) =>
        GoogleSheets.get({
          spreadsheetId: guildConfig[0].sheetId,
          ranges: [
            "'Time + event stuff'!X32",
            `'Day ${day}'!C3:C`,
            `'Day ${day}'!J3:O`,
          ],
        }),
      ),
      Effect.let("daySchedule", ({ sheet }) => {
        const [starts, breaks, schedules] = sheet.data.valueRanges ?? [];

        return {
          start: Number(starts.values?.[0][0]),
          schedules:
            Array.zip(breaks.values ?? [], schedules.values ?? [])
              ?.map(([[breakHour], [hour, p1, p2, p3, p4, p5]]) => {
                return {
                  hour: Number(hour),
                  breakHour: breakHour === "TRUE",
                  players: [
                    p1 !== undefined ? String(p1) : undefined,
                    p2 !== undefined ? String(p2) : undefined,
                    p3 !== undefined ? String(p3) : undefined,
                    p4 !== undefined ? String(p4) : undefined,
                    p5 !== undefined ? String(p5) : undefined,
                  ],
                };
              })
              ?.map(({ hour, breakHour, players }) => ({
                hour,
                breakHour,
                players,
                empty: 5 - players.filter(Boolean).length,
              }))
              ?.filter(({ hour }) => !isNaN(hour)) ?? [],
        };
      }),
      Effect.let("slotMessages", ({ daySchedule: { start, schedules } }) =>
        schedules.map(({ hour, empty, breakHour }) =>
          empty > 0 && !breakHour
            ? `**+${empty} Hour ${hour}** <t:${start + (hour - 1) * 3600}:t> to <t:${start + hour * 3600}:t>`
            : "",
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
    ),
  );

export const command = defineCommand(
  new SlashCommandBuilder()
    .setName("slot")
    .setDescription("Day slots commands")
    .addSubcommand((subcommand) =>
      subcommand
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
    .setIntegrationTypes(
      ApplicationIntegrationType.GuildInstall,
      ApplicationIntegrationType.UserInstall,
    )
    .setContexts(
      InteractionContextType.BotDM,
      InteractionContextType.Guild,
      InteractionContextType.PrivateChannel,
    ),
  (interaction) =>
    match({})
      .case("'list'", () =>
        pipe(
          Effect.Do,
          Effect.bindAll(() => ({
            messageFlags: Ref.make(new MessageFlagsBitField()),
            day: Effect.try(() => interaction.options.getNumber("day", true)),
            serverIdOption: Effect.try(() =>
              interaction.options.getString("server_id"),
            ),
            messageTypeOption: Effect.try(() =>
              interaction.options.getString("message_type"),
            ),
            channel: Effect.succeed(interaction.channel),
            user: Option.fromNullable(interaction.user),
          })),
          Effect.tap(({ messageTypeOption, channel, user }) =>
            channel &&
            !channel.isDMBased() &&
            !channel
              .permissionsFor(user)
              ?.has(PermissionFlagsBits.ManageMessages) &&
            messageTypeOption !== undefined
              ? Effect.fail(
                  "You can only request non-ephemeral messages in a channel with the Manage Messages permission",
                )
              : Effect.void,
          ),
          Effect.bindAll(({ serverIdOption, messageTypeOption }) => ({
            serverId: pipe(
              serverIdOption ?? interaction.guildId,
              Option.fromNullable,
            ),
            messageType: pipe(
              validate(type.enumerated("persistent", "ephemeral"))(
                messageTypeOption,
              ),
              Effect.catchTag("ValidationError", () =>
                Effect.succeed("ephemeral" as const),
              ),
            ),
          })),
          Effect.tap(({ messageType, messageFlags }) =>
            messageType === "ephemeral"
              ? Ref.update(messageFlags, (flags) =>
                  flags.add(MessageFlags.Ephemeral),
                )
              : Effect.void,
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
          Effect.let("row", ({ updateButton }) =>
            new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
              updateButton,
            ),
          ),
          Effect.bind("response", ({ day, slotMessage, flags, row }) =>
            Effect.tryPromise(() =>
              interaction.reply({
                embeds: [
                  new EmbedBuilder()
                    .setTitle(`Day ${day} Slots~`)
                    .setDescription(
                      slotMessage === "" ? "All Filled :3" : slotMessage,
                    )
                    .setTimestamp(),
                ],
                flags: flags.bitfield,
                components: [row],
                withResponse: true,
              }),
            ),
          ),
          Effect.bind(
            "context",
            Effect.context<DB | GoogleSheets | DBSubscriptionContext>,
          ),
          Effect.let(
            "updateCollector",
            ({ response, day, serverId, flags, row, context }) => {
              const collector =
                response.resource?.message?.createMessageComponentCollector({
                  filter: (interaction) => interaction.customId === "update",
                  time: 1000 * 60 * 10,
                });

              collector?.on("collect", (i) =>
                Effect.runPromise(
                  pipe(
                    Effect.Do,
                    Effect.bind("slotMessage", () =>
                      getSlotMessage(day, serverId),
                    ),
                    Effect.tap(({ slotMessage }) =>
                      i.update({
                        embeds: [
                          new EmbedBuilder()
                            .setTitle(`Day ${day} Slots~`)
                            .setDescription(
                              slotMessage === ""
                                ? "All Filled :3"
                                : slotMessage,
                            )
                            .setTimestamp(),
                        ],
                        flags: flags.bitfield,
                        components: [row],
                      }),
                    ),
                    Effect.provide(context),
                  ),
                ),
              );

              return collector;
            },
          ),
        ),
      )
      .default(() => Effect.void)(interaction.options.getSubcommand()),
);
