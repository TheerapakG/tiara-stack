import { Effect } from "effect";
import type { DiscordRestService } from "dfx/DiscordREST";
import {
  tentativeRoomOrderActionRow,
  tentativeRoomOrderPinActionRow,
} from "../messageComponents/buttons/roomOrderComponents";

const MIN_FILL_COUNT = 5;
const TENTATIVE_PREFIX = "(tentative)";

type TentativeRoomOrderSender = Pick<DiscordRestService, "createMessage" | "updateMessage">;

type TentativeRoomOrderGenerator = {
  generate: (payload: {
    guildId: string;
    channelId?: string | undefined;
    channelName?: string | undefined;
    hour?: number | undefined;
    healNeeded?: number | undefined;
  }) => Effect.Effect<
    {
      content: string;
      range: { minRank: number; maxRank: number };
      rank: number;
      hour: number;
      monitor: string | null;
      previousFills: ReadonlyArray<string>;
      fills: ReadonlyArray<string>;
      entries: ReadonlyArray<{
        rank: number;
        position: number;
        hour: number;
        team: string;
        tags: ReadonlyArray<string>;
        effectValue: number;
      }>;
    },
    unknown,
    unknown
  >;
};

type TentativeMessageRoomOrderService = {
  persistMessageRoomOrder: (
    messageId: string,
    payload: {
      data: {
        previousFills: ReadonlyArray<string>;
        fills: ReadonlyArray<string>;
        hour: number;
        rank: number;
        monitor: string | null | undefined;
        guildId: string | null;
        messageChannelId: string | null;
        createdByUserId: string | null;
      };
      entries: ReadonlyArray<{
        rank: number;
        position: number;
        hour: number;
        team: string;
        tags: ReadonlyArray<string>;
        effectValue: number;
      }>;
    },
  ) => Effect.Effect<unknown, unknown, unknown>;
};

export const hasTentativeRoomOrderPrefix = (content: string): boolean =>
  content === TENTATIVE_PREFIX || content.startsWith(`${TENTATIVE_PREFIX}\n`);

export const stripTentativeRoomOrderPrefix = (content: string): string =>
  hasTentativeRoomOrderPrefix(content)
    ? content.slice(TENTATIVE_PREFIX.length).replace(/^\n/, "")
    : content;

export const formatTentativeRoomOrderContent = (content: string): string =>
  hasTentativeRoomOrderPrefix(content) ? content : [TENTATIVE_PREFIX, content].join("\n");

export const shouldSendTentativeRoomOrder = (fillCount: number): boolean =>
  fillCount >= MIN_FILL_COUNT;

export const sendTentativeRoomOrder = Effect.fn("sendTentativeRoomOrder")(function* ({
  guildId,
  runningChannelId,
  hour,
  fillCount,
  roomOrderService,
  messageRoomOrderService,
  sender,
  createdByUserId,
}: {
  guildId: string;
  runningChannelId: string;
  hour: number;
  fillCount: number;
  roomOrderService: TentativeRoomOrderGenerator;
  messageRoomOrderService: TentativeMessageRoomOrderService;
  sender: TentativeRoomOrderSender;
  createdByUserId: string | null;
}) {
  if (!shouldSendTentativeRoomOrder(fillCount)) {
    return;
  }

  yield* Effect.gen(function* () {
    const generated = yield* roomOrderService.generate({
      guildId,
      channelId: runningChannelId,
      hour,
    });

    const sentMessage = yield* sender.createMessage(runningChannelId, {
      content: formatTentativeRoomOrderContent(generated.content),
      components: [tentativeRoomOrderActionRow(generated.range, generated.rank).toJSON()],
    });

    yield* Effect.gen(function* () {
      yield* messageRoomOrderService.persistMessageRoomOrder(sentMessage.id, {
        data: {
          previousFills: generated.previousFills,
          fills: generated.fills,
          hour: generated.hour,
          rank: generated.rank,
          monitor: generated.monitor,
          guildId,
          messageChannelId: sentMessage.channel_id,
          createdByUserId,
        },
        entries: generated.entries,
      });
    }).pipe(
      Effect.catchCause((cause) =>
        Effect.logError("Failed to persist tentative room order").pipe(
          Effect.annotateLogs({
            guildId,
            runningChannelId,
            hour,
            messageId: sentMessage.id,
          }),
          Effect.andThen(Effect.logError(cause)),
          Effect.andThen(
            sender
              .updateMessage(sentMessage.channel_id, sentMessage.id, {
                components: [tentativeRoomOrderPinActionRow().toJSON()],
              })
              .pipe(
                Effect.catchCause((updateCause) =>
                  Effect.logError(
                    "Failed to persist tentative room order and downgrade buttons",
                  ).pipe(
                    Effect.annotateLogs({
                      guildId,
                      runningChannelId,
                      hour,
                      messageId: sentMessage.id,
                    }),
                    Effect.andThen(Effect.logError(cause)),
                    Effect.andThen(Effect.logError(updateCause)),
                  ),
                ),
              ),
          ),
        ),
      ),
    );
  }).pipe(
    Effect.catchCause((cause) =>
      Effect.logError("Failed to send tentative room order").pipe(
        Effect.annotateLogs({
          guildId,
          runningChannelId,
          hour,
        }),
        Effect.andThen(Effect.logError(cause)),
      ),
    ),
  );
});
