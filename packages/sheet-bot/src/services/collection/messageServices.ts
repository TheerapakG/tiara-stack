import {
  BaseMessageT,
  MessageContext,
  MessageKind,
  MessageT,
} from "@/services/message";
import { Effect, Layer, pipe } from "effect";

export const messageServices = <M extends BaseMessageT = MessageT>(
  message: MessageKind<M>,
) =>
  pipe(
    Layer.succeedContext(MessageContext.make<M>(message)),
    Effect.succeed,
    Effect.withSpan("messageServices", {
      captureStackTrace: true,
      attributes: {
        messageId: message.id,
      },
    }),
    Layer.unwrapEffect,
  );
