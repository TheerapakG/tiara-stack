import { wrap, wrapOptional } from "@/utils";
import { Message, MessageEditOptions, MessagePayload } from "discord.js";
import { Context, Effect, HKT, pipe, Types } from "effect";
import { DiscordError, NotInGuildError } from "~~/src/types";

export interface MessageT extends HKT.TypeLambda {
  readonly type: this["Target"] extends boolean ? Message<this["Target"]> : Message;
}

export type MessageKind<F extends BaseMessageT, B extends boolean = boolean> = HKT.Kind<
  F,
  never,
  never,
  never,
  B
>;

export interface BaseMessageT extends HKT.TypeLambda {
  readonly type: Message<boolean>;
}

export class MessageContext<M extends BaseMessageT = MessageT> {
  $inferMessageType: Types.Contravariant<M> = undefined as unknown as Types.Contravariant<M>;

  static messageTag = <M extends BaseMessageT = MessageT>() =>
    Context.GenericTag<MessageContext<M>, MessageKind<M>>("MessageContext");

  static message = <M extends BaseMessageT = MessageT>() =>
    wrapOptional(() => MessageContext.messageTag<M>());

  static make<M extends BaseMessageT = MessageT>(message: MessageKind<M>) {
    return Context.make(this.messageTag<M>(), message);
  }

  static edit = wrap((content: string | MessageEditOptions | MessagePayload) =>
    pipe(
      MessageContext.message<MessageT>().sync(),
      Effect.flatMap((message) => DiscordError.wrapTryPromise(() => message.edit(content))),
      Effect.withSpan("MessageContext.edit", {
        captureStackTrace: true,
      }),
    ),
  );
}

export class InGuildMessageContext {
  static message = <
    M extends BaseMessageT = MessageT,
    Kind extends MessageKind<M, true> = MessageKind<M, true>,
  >() =>
    wrapOptional(() =>
      pipe(
        MessageContext.message<M>().sync(),
        Effect.flatMap((message) =>
          !message.inGuild() ? Effect.fail(new NotInGuildError()) : Effect.succeed(message as Kind),
        ),
      ),
    );

  static edit = wrap((content: string | MessageEditOptions | MessagePayload) =>
    pipe(
      InGuildMessageContext.message<MessageT>().sync(),
      Effect.flatMap((message) => DiscordError.wrapTryPromise(() => message.edit(content))),
      Effect.withSpan("InGuildMessageContext.edit", {
        captureStackTrace: true,
      }),
    ),
  );
}
