import { Effect } from "effect";

const MIN_FILL_COUNT = 5;
const TENTATIVE_PREFIX = "(tentative)";

type TentativeRoomOrderSender = {
  createMessage: (
    channelId: string,
    payload: { content: string },
  ) => Effect.Effect<unknown, unknown, never>;
};

type TentativeRoomOrderGenerator = {
  generate: (payload: {
    guildId: string;
    channelId?: string | undefined;
    channelName?: string | undefined;
    hour?: number | undefined;
    healNeeded?: number | undefined;
  }) => Effect.Effect<{ content: string }, unknown, never>;
};

export const formatTentativeRoomOrderContent = (content: string): string =>
  [TENTATIVE_PREFIX, content].join("\n");

export const shouldSendTentativeRoomOrder = (fillCount: number): boolean =>
  fillCount >= MIN_FILL_COUNT;

export const sendTentativeRoomOrder = Effect.fn("sendTentativeRoomOrder")(function* ({
  guildId,
  runningChannelId,
  hour,
  fillCount,
  roomOrderService,
  sender,
}: {
  guildId: string;
  runningChannelId: string;
  hour: number;
  fillCount: number;
  roomOrderService: TentativeRoomOrderGenerator;
  sender: TentativeRoomOrderSender;
}) {
  if (!shouldSendTentativeRoomOrder(fillCount)) {
    return;
  }

  yield* roomOrderService
    .generate({
      guildId,
      channelId: runningChannelId,
      hour,
    })
    .pipe(
      Effect.flatMap((generated) =>
        sender.createMessage(runningChannelId, {
          content: formatTentativeRoomOrderContent(generated.content),
        }),
      ),
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
