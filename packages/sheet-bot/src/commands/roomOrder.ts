import { InteractionsRegistry } from "dfx/gateway";
import {
  ApplicationIntegrationType,
  InteractionContextType,
  MessageFlags,
} from "discord-api-types/v10";
import { Ix } from "dfx/index";
import { Effect, Layer, Option, pipe } from "effect";
import { DiscordGatewayLayerLive } from "dfx-discord-utils/discord";
import { CommandHelper } from "dfx-discord-utils/utils";
import { Interaction } from "dfx-discord-utils/utils";
import { MessageRoomOrderService, RoomOrderService, SheetApisRequestContext } from "../services";
import { roomOrderActionRow } from "../messageComponents/buttons";

const makeManualSubCommand = Effect.gen(function* () {
  const messageRoomOrderService = yield* MessageRoomOrderService;
  const roomOrderService = yield* RoomOrderService;

  return yield* CommandHelper.makeSubCommand(
    (builder) =>
      builder
        .setName("manual")
        .setDescription("Manual room order commands")
        .addStringOption((option) =>
          option.setName("channel_name").setDescription("The name of the running channel"),
        )
        .addNumberOption((option) =>
          option.setName("hour").setDescription("The hour to order rooms for"),
        )
        .addNumberOption((option) => option.setName("heal").setDescription("The healer needed"))
        .addStringOption((option) =>
          option.setName("server_id").setDescription("The server to order rooms for"),
        ),
    Effect.fn("room_order.manual")(function* (command) {
      yield* command.deferReply({ flags: MessageFlags.Ephemeral });

      const serverId = command.optionValueOptional("server_id");
      const interactionUser = yield* Interaction.user();
      const interactionGuild = yield* Interaction.guild();
      const guildId =
        Option.getOrUndefined(serverId) ??
        pipe(
          interactionGuild,
          Option.map((guild) => guild.id),
          Option.getOrThrow,
        );

      const channelNameOption = command.optionValueOptional("channel_name");
      const interactionChannel = yield* Interaction.channel();
      const generated = yield* roomOrderService.generate({
        guildId,
        ...(Option.isSome(channelNameOption)
          ? { channelName: channelNameOption.value }
          : {
              channelId: pipe(
                interactionChannel,
                Option.map((channel) => channel.id),
                Option.getOrThrow,
              ),
            }),
        ...pipe(
          command.optionValueOptional("hour"),
          Option.match({
            onSome: (hour) => ({ hour }),
            onNone: () => ({}),
          }),
        ),
        ...pipe(
          command.optionValueOptional("heal"),
          Option.match({
            onSome: (healNeeded) => ({ healNeeded }),
            onNone: () => ({}),
          }),
        ),
      });

      const messageResult = yield* command.editReply({
        payload: {
          content: generated.content,
          components: [roomOrderActionRow(generated.range, generated.rank).toJSON()],
        },
      });

      yield* messageRoomOrderService.upsertMessageRoomOrder(messageResult.id, {
        previousFills: generated.previousFills,
        fills: generated.fills,
        hour: generated.hour,
        rank: generated.rank,
        monitor: generated.monitor,
        guildId,
        messageChannelId: messageResult.channel_id,
        createdByUserId: interactionUser.id,
      });

      yield* messageRoomOrderService.upsertMessageRoomOrderEntry(
        messageResult.id,
        generated.entries,
      );
    }),
  );
});

const makeRoomOrderCommand = Effect.gen(function* () {
  const manualSubCommand = yield* makeManualSubCommand;

  return yield* CommandHelper.makeCommand(
    (builder) =>
      builder
        .setName("room_order")
        .setDescription("Room order commands")
        .setIntegrationTypes(
          ApplicationIntegrationType.GuildInstall,
          ApplicationIntegrationType.UserInstall,
        )
        .setContexts(
          InteractionContextType.BotDM,
          InteractionContextType.Guild,
          InteractionContextType.PrivateChannel,
        )
        .addSubcommand(() => manualSubCommand.data),
    SheetApisRequestContext.asInteractionUser((command) =>
      command.subCommands({
        manual: manualSubCommand.handler,
      }),
    ),
  );
});

const makeGlobalRoomOrderCommand = Effect.gen(function* () {
  const roomOrderCommand = yield* makeRoomOrderCommand;

  return CommandHelper.makeGlobalCommand(roomOrderCommand.data, roomOrderCommand.handler);
});

export const RoomOrderCommandLive = Layer.scopedDiscard(
  Effect.gen(function* () {
    const registry = yield* InteractionsRegistry;
    const command = yield* makeGlobalRoomOrderCommand;

    yield* registry.register(Ix.builder.add(command).catchAllCause(Effect.log));
  }),
).pipe(
  Layer.provide(
    Layer.mergeAll(
      DiscordGatewayLayerLive,
      RoomOrderService.Default,
      MessageRoomOrderService.Default,
    ),
  ),
);
